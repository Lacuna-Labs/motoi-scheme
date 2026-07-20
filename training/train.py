#!/usr/bin/env python3
"""
Motoi Copilot — training entry point.

STATUS: SKELETON. Not-yet-runnable end-to-end.
Blockers listed in README.slat under :what-still-gates-training.

Run pattern (when unblocked):

    cd motoi-scheme/training
    python train.py --config config.yaml
    # or with accelerate for multi-GPU:
    accelerate launch train.py --config config.yaml

The recipe (full FT, 3 epochs, lr 5e-5, batch 128, cosine decay, seed
20260716) is locked in config.yaml. This script only wires it up.

Doctrine:
- The reference IS the language. Reference-manual verbs are ground truth.
- No fabrication. If a corpus loader can't parse a pair, log + skip; do
  not invent replacement content.
- Held-out contract: any pair with `"held_out": true` MUST be filtered
  from the training stream. See README.slat.
"""

from __future__ import annotations

import argparse
import glob
import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import yaml

logger = logging.getLogger("motoi.train")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def load_config(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Data loading — respects the held-out contract.
# ---------------------------------------------------------------------------

def iter_pairs(jsonl_path: Path, drop_provenance: bool = True) -> Iterable[dict]:
    """Yield each training pair from a JSONL, skipping headers and held-out."""
    with open(jsonl_path) as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning("skip bad line %s:%d — %s", jsonl_path.name, line_no, e)
                continue
            if drop_provenance and rec.get("_provenance_header"):
                continue
            # HELD-OUT CONTRACT — see training-data/held-out/README.slat
            if rec.get("held_out"):
                continue
            if "messages" not in rec:
                logger.warning("skip no-messages line %s:%d", jsonl_path.name, line_no)
                continue
            yield rec


def load_train_corpus(train_glob: str, drop_provenance: bool = True) -> list[dict]:
    """Load all training JSONLs matching the glob, filtering held-out."""
    paths = sorted(Path(p) for p in glob.glob(train_glob))
    if not paths:
        raise FileNotFoundError(f"No training files matched: {train_glob}")
    out: list[dict] = []
    for p in paths:
        n_before = len(out)
        for rec in iter_pairs(p, drop_provenance=drop_provenance):
            out.append(rec)
        logger.info("loaded %d pairs from %s", len(out) - n_before, p.name)
    logger.info("train corpus: %d total pairs", len(out))
    return out


def load_heldout(path: str) -> list[dict]:
    """Load the held-out set — every pair here MUST carry held_out=true."""
    out: list[dict] = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            if rec.get("_provenance_header"):
                continue
            if not rec.get("held_out"):
                raise ValueError(f"heldout file has unmarked pair: {path}")
            out.append(rec)
    logger.info("held-out set: %d pairs", len(out))
    return out


# ---------------------------------------------------------------------------
# Tokenization — uses the model's chat template.
# ---------------------------------------------------------------------------

def build_tokenizer(model_path_or_id: str):
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_path_or_id, use_fast=True)
    # Qwen2.5-Coder-Instruct ships with a chat template; pad token defaults
    # to eos which is fine for causal LM fine-tune.
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    return tok


def encode_pair(rec: dict, tokenizer, max_length: int) -> dict:
    """Encode {messages: [...]} → {input_ids, attention_mask, labels}.
    Masks user tokens (labels = -100) so loss is only on assistant tokens.
    """
    messages = rec["messages"]
    # Full sequence: user + assistant, chat-templated.
    # transformers 5.x requires return_dict=True to get raw list[int] ids.
    full = tokenizer.apply_chat_template(
        messages, tokenize=True, add_generation_prompt=False,
        return_dict=True, truncation=True, max_length=max_length,
    )["input_ids"]
    # Prompt-only prefix: everything except the last assistant turn.
    if messages and messages[-1]["role"] == "assistant":
        prompt = tokenizer.apply_chat_template(
            messages[:-1], tokenize=True, add_generation_prompt=True,
            return_dict=True, truncation=True, max_length=max_length,
        )["input_ids"]
    else:
        prompt = full
    labels = list(full)
    # Mask everything in the prompt prefix
    prefix_len = min(len(prompt), len(labels))
    for i in range(prefix_len):
        labels[i] = -100
    return {
        "input_ids": full,
        "attention_mask": [1] * len(full),
        "labels": labels,
    }


# ---------------------------------------------------------------------------
# Verb-recall metric — coarse hallucination probe on held-out completions.
# ---------------------------------------------------------------------------

def load_verb_set(verb_list_path: str) -> set[str]:
    """Parse the CORE verb SLAT list into a set of verb strings."""
    import re
    text = Path(verb_list_path).read_text()
    return set(re.findall(r'\((?:verb|constant)\s+"([^"]+)"\)', text))


def extract_first_verb(text: str) -> str | None:
    """Grab the first symbol after the first '(' inside a ```motoi fence."""
    import re
    m = re.search(r"```motoi\s*\n(.*?)```", text, re.DOTALL)
    if not m:
        return None
    body = m.group(1)
    m2 = re.search(r"\(\s*([^\s()]+)", body)
    return m2.group(1) if m2 else None


def compute_verb_recall(model, tokenizer, heldout: list[dict], known_verbs: set[str], device) -> dict:
    """Prompt-and-generate over held-out pairs with an assistant target;
    measure fraction of generations whose first Motoi verb is a known verb.
    """
    import torch
    model.eval()
    total = 0
    known = 0
    with_code = 0
    for rec in heldout:
        msgs = rec["messages"]
        if not msgs or msgs[-1]["role"] != "assistant":
            continue
        target = msgs[-1]["content"]
        if "```motoi" not in target:
            continue
        with_code += 1
        prompt_ids = tokenizer.apply_chat_template(
            msgs[:-1], tokenize=True, add_generation_prompt=True,
            return_dict=True, return_tensors="pt",
            truncation=True, max_length=2048,
        )["input_ids"].to(device)
        with torch.no_grad():
            out = model.generate(
                prompt_ids, max_new_tokens=200, do_sample=False,
                pad_token_id=tokenizer.pad_token_id,
            )
        gen = tokenizer.decode(out[0][prompt_ids.shape[1]:], skip_special_tokens=True)
        verb = extract_first_verb(gen)
        if verb is None:
            continue
        total += 1
        if verb in known_verbs:
            known += 1
    return {
        "verb_recall_total": total,
        "verb_recall_known": known,
        "verb_recall_pct": (known / total) if total else 0.0,
        "with_code_fence": with_code,
    }


# ---------------------------------------------------------------------------
# Main.
# ---------------------------------------------------------------------------

def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument("--dry-run", action="store_true",
                        help="Load corpus + tokenizer only; skip model load and training.")
    args = parser.parse_args()

    cfg = load_config(args.config)
    logger.info("config: model=%s epochs=%d lr=%g seed=%d",
                cfg["model"]["base_model_id"],
                cfg["training"]["epochs"],
                cfg["training"]["learning_rate"],
                cfg["training"]["seed"])

    # Data — respects held-out contract.
    here = Path(args.config).resolve().parent
    train_glob = str((here / cfg["data"]["train_glob"]).resolve())
    heldout_path = str((here / cfg["data"]["heldout_path"]).resolve())
    train_recs = load_train_corpus(train_glob, drop_provenance=cfg["data"]["drop_provenance_headers"])
    heldout_recs = load_heldout(heldout_path)

    # Assert no leak — no train pair is a held-out pair.
    heldout_keys = {(r.get("_source_file"), r.get("_source_line")) for r in heldout_recs}
    leaks = 0
    for r in train_recs:
        k = (r.get("_source_file"), r.get("_source_line"))
        if k in heldout_keys and None not in k:
            leaks += 1
    if leaks:
        raise RuntimeError(f"held-out leak into train stream: {leaks} pairs")
    logger.info("held-out contract: 0 leaks")

    # Tokenizer — from local model dir (falls back to HF hub id).
    model_path = cfg["model"].get("local_path") or cfg["model"]["base_model_id"]
    model_path = str((here / model_path).resolve()) if not model_path.startswith("/") else model_path
    if not Path(model_path).exists():
        logger.warning("local model path missing: %s — falling back to HF id", model_path)
        model_path = cfg["model"]["base_model_id"]
    tokenizer = build_tokenizer(model_path)
    logger.info("tokenizer loaded — vocab_size=%d", tokenizer.vocab_size)

    if args.dry_run:
        # Quick tokenization sanity — encode a handful of pairs.
        sample = train_recs[:3]
        for rec in sample:
            enc = encode_pair(rec, tokenizer, cfg["data"]["max_seq_length"])
            logger.info("encoded pair — input_ids=%d labels_nonneg=%d",
                        len(enc["input_ids"]), sum(1 for l in enc["labels"] if l != -100))
        logger.info("dry-run complete — no model loaded, no training performed")
        return

    # Model + Trainer wiring — the actual training step.
    # BLOCKS: needs CUDA/MPS GPU. Do not run on CPU (would take days).
    from datasets import Dataset
    from transformers import (
        AutoModelForCausalLM,
        Trainer,
        TrainingArguments,
        DataCollatorForSeq2Seq,
        set_seed,
    )
    import torch

    set_seed(cfg["training"]["seed"])

    logger.info("loading base model — %s", model_path)
    dtype = torch.bfloat16 if cfg["model"]["torch_dtype"] == "bfloat16" else torch.float16
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=dtype,
        attn_implementation=cfg["model"].get("attn_implementation", "sdpa"),
    )
    if cfg["hardware"].get("gradient_checkpointing"):
        model.gradient_checkpointing_enable()

    logger.info("tokenizing corpus…")
    max_len = cfg["data"]["max_seq_length"]
    train_ds = Dataset.from_list(train_recs).map(
        lambda r: encode_pair(r, tokenizer, max_len),
        remove_columns=Dataset.from_list(train_recs).column_names,
    )
    heldout_ds = Dataset.from_list(heldout_recs).map(
        lambda r: encode_pair(r, tokenizer, max_len),
        remove_columns=Dataset.from_list(heldout_recs).column_names,
    )

    output_dir = str((here / cfg["output"]["output_dir"]).resolve())
    args_t = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=cfg["training"]["epochs"],
        per_device_train_batch_size=cfg["training"]["per_device_train_batch_size"],
        gradient_accumulation_steps=cfg["training"]["gradient_accumulation_steps"],
        learning_rate=cfg["training"]["learning_rate"],
        lr_scheduler_type=cfg["training"]["lr_scheduler_type"],
        warmup_ratio=cfg["training"]["warmup_ratio"],
        weight_decay=cfg["training"]["weight_decay"],
        max_grad_norm=cfg["training"]["max_grad_norm"],
        logging_steps=cfg["training"]["logging_steps"],
        save_strategy=cfg["training"]["save_strategy"],
        save_total_limit=cfg["training"]["save_total_limit"],
        eval_strategy=cfg["training"]["eval_strategy"],
        seed=cfg["training"]["seed"],
        bf16=cfg["hardware"].get("bf16", False),
        fp16=cfg["hardware"].get("fp16", False),
        gradient_checkpointing=cfg["hardware"].get("gradient_checkpointing", False),
        report_to=cfg["output"]["report_to"],
    )

    collator = DataCollatorForSeq2Seq(tokenizer, padding=True, label_pad_token_id=-100)
    trainer = Trainer(
        model=model,
        args=args_t,
        train_dataset=train_ds,
        eval_dataset=heldout_ds,
        data_collator=collator,
    )

    logger.info("training start — this fires the actual GPU run")
    trainer.train()
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Post-train — verb recall probe on held-out.
    if cfg["eval"].get("compute_verb_recall"):
        verbs = load_verb_set(str((here / cfg["eval"]["verb_recall_verb_list"]).resolve()))
        device = next(model.parameters()).device
        stats = compute_verb_recall(model, tokenizer, heldout_recs, verbs, device)
        logger.info("verb-recall — %s", json.dumps(stats))

    logger.info("done — checkpoint at %s", output_dir)


if __name__ == "__main__":
    main()
