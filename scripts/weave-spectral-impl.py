#!/usr/bin/env python3
"""Spectral Surgery implementation for Motoi Mk 1 LoRA adapter.

Per Weave 0.75 doctrine (engineering/WEAVE-RECIPE.md) + arXiv:2603.03995
(Spectral Surgery: Training-Free Refinement of LoRA via Gradient-Guided
Singular Value Reweighting).

Mechanism, per doctrine and paper:
  For each LoRA-injected layer:
    1. Load A (rank × in) and B (out × rank).
    2. Effective delta ΔW = B @ A (rank <= r_LoRA = 128).
    3. SVD: ΔW = U · diag(σ) · V^T.
    4. Score each singular direction i by its ACTIVATION MAGNITUDE on the
       calibration set: for prompt p, extract input activation x_p to the
       LoRA-injected linear, project onto row i of V^T (i.e. V^T @ x_p),
       multiply by σ_i, and sum abs across calibration set.
    5. Rank directions by score. Amplify top --amplify-top-frac by
       --amplify-factor. Shrink bottom --shrink-bottom-frac by
       --shrink-factor. Middle untouched.
    6. Reconstruct: A' = diag(σ') · V^T,  B' = U   (both truncated to r_LoRA).
       Then B' @ A' = ΔW'.
  Save {A',B'} for all layers to output safetensors.
  Emit per-layer JSON report: top-5 amplified + bottom-5 shrunk with
  original σ + scaled σ.

Called by scripts/weave-spectral.mjs (Node wrapper). Called directly for
debug via --help.

Constraints (per task doctrine):
  - SFT adapter IMMUTABLE — never overwrite --input.
  - No LLM generation of calibration content.
  - Local only. No external CDN/HF calls (mlx_lm.load may cache Qwen base
    from HF — that model is already present on disk).
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict

import numpy as np
from safetensors.numpy import load_file, save_file


# --- Adapter I/O ---------------------------------------------------------

def parse_key(key):
    # key looks like: model.layers.<L>.<attn|mlp>.<proj>.lora_a|lora_b
    parts = key.split(".")
    if len(parts) < 6:
        return None
    layer = int(parts[2])
    module = parts[3]      # "self_attn" | "mlp"
    proj = parts[4]         # e.g. "q_proj", "down_proj"
    role = parts[5]         # "lora_a" | "lora_b"
    return layer, module, proj, role


def group_adapter(tensors):
    """tensors: dict[key -> np.ndarray]. Group into
    { (layer, module, proj) -> {"lora_a": A, "lora_b": B, "keys": {...}} }
    """
    grouped = defaultdict(dict)
    for k, v in tensors.items():
        info = parse_key(k)
        if info is None:
            continue
        layer, module, proj, role = info
        gk = (layer, module, proj)
        grouped[gk][role] = v
        grouped[gk].setdefault("keys", {})[role] = k
    return grouped


# --- Calibration corpus loading ------------------------------------------

def load_calibration(path):
    prompts = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            prompts.append(r)
    return prompts


# --- Activation extraction via mlx_lm ------------------------------------

def collect_activations(base_model_name, calib_prompts, adapter_path,
                       max_tokens_per_prompt=64, verbose=True):
    """Run each calibration prompt through the base+adapter model, capture
    the input activation into each LoRA-injected linear.

    Returns: dict[(layer, module, proj) -> np.ndarray of shape (N_tokens, in_dim)]
    """
    from mlx_lm import load
    from mlx_lm.tuner.lora import LoRALinear
    import mlx.core as mx

    if verbose:
        print(f"Loading base model + adapter: {base_model_name}", file=sys.stderr)
        print(f"  Adapter: {adapter_path}", file=sys.stderr)
    model, tokenizer = load(base_model_name, adapter_path=adapter_path)

    if verbose:
        print(f"Model loaded. Registering activation hooks (class-level patch)...", file=sys.stderr)

    # Tag each LoRALinear instance with (layer, module, proj)
    layers = model.model.layers
    hooks_installed = 0
    for layer_idx, layer in enumerate(layers):
        attn = layer.self_attn
        for proj_name in ["q_proj", "k_proj", "v_proj", "o_proj"]:
            mod = getattr(attn, proj_name, None)
            if mod is None or "LoRA" not in type(mod).__name__:
                continue
            mod._weave_tag = (layer_idx, "self_attn", proj_name)
            hooks_installed += 1
        mlp = layer.mlp
        for proj_name in ["gate_proj", "up_proj", "down_proj"]:
            mod = getattr(mlp, proj_name, None)
            if mod is None or "LoRA" not in type(mod).__name__:
                continue
            mod._weave_tag = (layer_idx, "mlp", proj_name)
            hooks_installed += 1

    if verbose:
        print(f"  Tagged {hooks_installed} LoRALinear instances", file=sys.stderr)

    # Class-level monkey patch of LoRALinear.__call__ — instance-level
    # attribute assignment does NOT work with MLX modules (call goes via
    # type(module).__call__, not the instance).
    activations = defaultdict(list)  # (layer, module, proj) -> [np arrays]
    orig_call = LoRALinear.__call__

    def patched_call(self, x):
        tag = getattr(self, "_weave_tag", None)
        if tag is not None:
            # Cast to float32 in mlx BEFORE numpy conversion — bfloat16 has
            # no numpy dtype and fails PEP 3118 buffer conversion.
            x_f32 = x.astype(mx.float32)
            mx.eval(x_f32)
            arr = np.array(x_f32)
            if arr.ndim >= 2:
                arr = arr.reshape(-1, arr.shape[-1])
            activations[tag].append(arr)
        return orig_call(self, x)

    LoRALinear.__call__ = patched_call

    # Run forward pass — no generation, just prompt encoding pass through
    # the model to fill activations. Use tokenizer to encode + apply chat
    # template so the token distribution matches inference-time.
    t0 = time.time()
    for i, entry in enumerate(calib_prompts):
        prompt_text = entry["prompt"]
        messages = [{"role": "user", "content": prompt_text}]
        try:
            templated = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True)
        except Exception:
            templated = prompt_text
        try:
            ids = tokenizer.encode(templated)
        except Exception as e:
            if verbose:
                print(f"  [{i+1}] encode failed: {e}", file=sys.stderr)
            continue
        # Cap to max_tokens for activation collection cost control
        ids = ids[: max(8, max_tokens_per_prompt)]
        x = mx.array(ids)[None, :]
        try:
            _ = model(x)
            mx.eval(_)
        except Exception as e:
            if verbose:
                print(f"  [{i+1}] forward failed: {e}", file=sys.stderr)
            continue
        if verbose and ((i + 1) % 10 == 0 or i == 0):
            elapsed = time.time() - t0
            print(f"  [{i+1}/{len(calib_prompts)}] elapsed {elapsed:.1f}s", file=sys.stderr)

    total_elapsed = time.time() - t0
    if verbose:
        print(f"Forward passes complete in {total_elapsed:.1f}s.", file=sys.stderr)

    # Restore original class-level __call__
    LoRALinear.__call__ = orig_call

    # Collapse per-key list into a single (N, in_dim) array
    collapsed = {}
    for gk, arrs in activations.items():
        if not arrs:
            continue
        collapsed[gk] = np.concatenate(arrs, axis=0)
    return collapsed


# --- Spectral rescaling ---------------------------------------------------

def rescale_layer(A, B, X, amplify_top_frac, shrink_bottom_frac,
                  amplify_factor, shrink_factor):
    """Given LoRA A (rank, in_dim) and B (out_dim, rank), and activation
    matrix X (N_tokens, in_dim), rescale singular values of ΔW = B @ A.

    Returns:
      A_new (rank, in_dim), B_new (out_dim, rank),
      report dict per-direction.
    """
    rank_lora, in_dim = A.shape
    out_dim, rank_lora_b = B.shape
    assert rank_lora == rank_lora_b, f"rank mismatch: A={A.shape}, B={B.shape}"

    # Effective delta = B @ A
    W = B.astype(np.float64) @ A.astype(np.float64)  # (out_dim, in_dim)

    # SVD full — for rank r_LoRA <= 128, only first r_LoRA singular values
    # are potentially nonzero. econ SVD.
    U, S, Vt = np.linalg.svd(W, full_matrices=False)
    # U: (out_dim, k)   S: (k,)   Vt: (k, in_dim)   k = min(out_dim, in_dim)
    # But delta = B@A has rank <= r_LoRA, so S[r_LoRA:] are ~0
    # Truncate to r_LoRA for efficiency + numerical clarity
    r = min(rank_lora, len(S))
    U = U[:, :r]
    S = S[:r]
    Vt = Vt[:r, :]

    # Activation-based score per direction:
    #   For each row i of Vt (shape in_dim), compute mean-abs of Vt[i] @ X.T
    #   weighted by S[i]. This is a proxy for gradient-guided score (paper
    #   uses gradient; we use activation, which correlates well and is
    #   cheap on a 100-prompt calibration).
    # X is (N, in_dim). Vt @ X.T -> (r, N)
    if X.shape[0] == 0:
        # No activations captured — fall back to pure S-based ranking
        scores = S.copy()
    else:
        # Cast to float32 for the projection (X may be large)
        Xf = X.astype(np.float32)
        Vtf = Vt.astype(np.float32)
        proj = Vtf @ Xf.T   # (r, N)
        # per-direction score = S[i] * mean(|proj[i]|)
        mean_abs = np.mean(np.abs(proj), axis=1)  # (r,)
        scores = S.astype(np.float32) * mean_abs

    # Rank descending
    order = np.argsort(-scores)
    n_amp = max(1, int(np.round(amplify_top_frac * r)))
    n_shrink = max(1, int(np.round(shrink_bottom_frac * r)))
    top_ids = set(order[:n_amp].tolist())
    bottom_ids = set(order[-n_shrink:].tolist())

    scale = np.ones(r, dtype=np.float64)
    for i in top_ids:
        scale[i] = amplify_factor
    for i in bottom_ids:
        # If a direction is both in top and bottom (impossible unless r < n_amp+n_shrink),
        # amplification wins
        if i not in top_ids:
            scale[i] = shrink_factor

    S_new = S * scale

    # Refactor into LoRA form: A_new (r, in_dim), B_new (out_dim, r)
    # such that B_new @ A_new = U @ diag(S_new) @ Vt.
    # Choice: absorb S_new into A_new.
    A_new = (np.diag(S_new) @ Vt).astype(np.float32)     # (r, in_dim)
    B_new = U.astype(np.float32)                          # (out_dim, r)

    # If original LoRA rank was 128 but effective rank r < 128, we need to
    # pad back to rank 128 to keep the safetensors shape identical.
    if r < rank_lora:
        A_pad = np.zeros((rank_lora, in_dim), dtype=np.float32)
        B_pad = np.zeros((out_dim, rank_lora), dtype=np.float32)
        A_pad[:r, :] = A_new
        B_pad[:, :r] = B_new
        A_new = A_pad
        B_new = B_pad

    report = {
        "rank_effective": int(r),
        "n_amplified": int(n_amp),
        "n_shrunk": int(n_shrink),
        "top_ids": sorted(int(i) for i in top_ids),
        "bottom_ids": sorted(int(i) for i in bottom_ids),
        "s_original_max": float(S[0]) if len(S) else 0.0,
        "s_original_min": float(S[-1]) if len(S) else 0.0,
        "s_scaled_max": float(np.max(S_new)) if len(S_new) else 0.0,
        "s_scaled_min": float(np.min(S_new)) if len(S_new) else 0.0,
        "delta_frob_orig": float(np.linalg.norm(S)),
        "delta_frob_new": float(np.linalg.norm(S_new)),
        # Top-5 amplified: (idx, s_orig, s_new)
        "top5_amplified": [
            {"idx": int(order[j]), "s_orig": float(S[order[j]]),
             "s_new": float(S_new[order[j]]), "score": float(scores[order[j]])}
            for j in range(min(5, n_amp))
        ],
        # Bottom-5 shrunk
        "bottom5_shrunk": [
            {"idx": int(order[-1-j]), "s_orig": float(S[order[-1-j]]),
             "s_new": float(S_new[order[-1-j]]), "score": float(scores[order[-1-j]])}
            for j in range(min(5, n_shrink))
        ],
    }
    return A_new, B_new, report


# --- Main ----------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Spectral Surgery for MLX LoRA")
    parser.add_argument("--input", required=True, help="SFT adapter (immutable, safetensors)")
    parser.add_argument("--calibration", required=True, help="Calibration JSONL")
    parser.add_argument("--output", required=True, help="Output safetensors")
    parser.add_argument("--report", required=True, help="Output JSON report")
    parser.add_argument("--amplify-top-frac", type=float, default=0.15)
    parser.add_argument("--shrink-bottom-frac", type=float, default=0.30)
    parser.add_argument("--amplify-factor", type=float, default=1.5)
    parser.add_argument("--shrink-factor", type=float, default=0.5)
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-Coder-1.5B-Instruct")
    parser.add_argument("--max-tokens-per-prompt", type=int, default=64)
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    verbose = not args.quiet

    # Load adapter
    if verbose:
        print(f"Loading SFT adapter: {args.input}", file=sys.stderr)
    tensors = load_file(args.input)
    if verbose:
        print(f"  {len(tensors)} tensor keys.", file=sys.stderr)
    grouped = group_adapter(tensors)
    if verbose:
        print(f"  Grouped into {len(grouped)} (layer, module, proj) triples.", file=sys.stderr)

    # Load calibration
    if verbose:
        print(f"Loading calibration: {args.calibration}", file=sys.stderr)
    calib = load_calibration(args.calibration)
    if verbose:
        print(f"  {len(calib)} calibration prompts.", file=sys.stderr)

    # Collect activations by running the base+adapter model on calibration
    activations = collect_activations(
        args.base_model, calib, adapter_path=os.path.dirname(args.input),
        max_tokens_per_prompt=args.max_tokens_per_prompt, verbose=verbose)
    if verbose:
        print(f"Activations captured for {len(activations)} layer/proj triples.", file=sys.stderr)

    # Actually — collect_activations was pointed at adapter_path which is the
    # PARENT DIR of the input file. mlx_lm's load() takes a directory, so we
    # need to point at the archive dir. But the archive contains our
    # SFT-final .safetensors named specifically; mlx_lm.load looks for
    # 'adapters.safetensors'. Instead of pointing at _archive, we already
    # copied adapter_config.json to weave-0.75-spectral in step 4 — but
    # spectral runs BEFORE step 4. So we prep the load dir ourselves:
    # link input as adapters.safetensors + config in a tmp dir.
    # (Handled by caller wrapper — see spectral.mjs. Here, we assume caller
    # passed a path where the SFT adapter is loadable.)

    # Now rescale each layer's LoRA delta.
    if verbose:
        print("Rescaling per-layer LoRA delta via SVD...", file=sys.stderr)

    new_tensors = {}
    per_layer_reports = {}
    for gk, group in grouped.items():
        A = group.get("lora_a")
        B = group.get("lora_b")
        if A is None or B is None:
            continue
        # mlx_lm layout: lora_a shape (in_dim, rank), lora_b shape (rank, out_dim)
        # But we saw in inspection:
        #   model.layers.0.mlp.down_proj.lora_a  shape=(8960, 128)  <- (in, r)
        #   model.layers.0.mlp.down_proj.lora_b  shape=(128, 1536)  <- (r, out)
        # So the LoRA output = x @ A @ B where x has last dim = in_dim.
        # Delta = A @ B has shape (in, out). But in the paper, ΔW is the
        # WEIGHT delta (out, in). Different convention, mathematically OK.
        # We compute delta = A @ B directly here.
        in_dim, rank_a = A.shape
        rank_b, out_dim = B.shape
        assert rank_a == rank_b, f"rank mismatch at {gk}: A={A.shape} B={B.shape}"

        # Fetch activations (N, in_dim). May be missing if hooks failed for
        # this projection — fall back to no-activation (S-only) score.
        X = activations.get(gk)
        if X is None:
            X = np.zeros((0, in_dim), dtype=np.float32)

        # Rescale. Our rescale_layer expects A (r, in) and B (out, r), so
        # transpose the mlx_lm layout.
        A_ri = A.T   # (r, in)
        B_or = B.T   # (out, r)
        A_new_ri, B_new_or, report = rescale_layer(
            A_ri, B_or, X,
            amplify_top_frac=args.amplify_top_frac,
            shrink_bottom_frac=args.shrink_bottom_frac,
            amplify_factor=args.amplify_factor,
            shrink_factor=args.shrink_factor)
        # Transpose back to mlx_lm layout
        A_new = A_new_ri.T   # (in, r)
        B_new = B_new_or.T   # (r, out)

        new_tensors[group["keys"]["lora_a"]] = A_new
        new_tensors[group["keys"]["lora_b"]] = B_new
        per_layer_reports[f"L{gk[0]:02d}.{gk[1]}.{gk[2]}"] = report

    # For any tensors we didn't rescale (shouldn't be any if all layers have
    # both lora_a and lora_b), pass them through.
    for k, v in tensors.items():
        if k not in new_tensors:
            new_tensors[k] = v

    # Save
    if verbose:
        print(f"Saving rescaled adapter: {args.output}", file=sys.stderr)
    save_file(new_tensors, args.output)

    # Write report
    if verbose:
        print(f"Writing report: {args.report}", file=sys.stderr)
    report_out = {
        "input": args.input,
        "output": args.output,
        "calibration": args.calibration,
        "n_calibration_prompts": len(calib),
        "hyperparameters": {
            "amplify_top_frac": args.amplify_top_frac,
            "shrink_bottom_frac": args.shrink_bottom_frac,
            "amplify_factor": args.amplify_factor,
            "shrink_factor": args.shrink_factor,
            "max_tokens_per_prompt": args.max_tokens_per_prompt,
        },
        "n_layers_rescaled": len(per_layer_reports),
        "activations_captured_for": sorted([f"L{gk[0]:02d}.{gk[1]}.{gk[2]}"
                                            for gk in activations.keys()]),
        "per_layer": per_layer_reports,
    }
    with open(args.report, "w") as f:
        json.dump(report_out, f, indent=2)

    if verbose:
        print("Spectral Surgery complete.", file=sys.stderr)


if __name__ == "__main__":
    main()
