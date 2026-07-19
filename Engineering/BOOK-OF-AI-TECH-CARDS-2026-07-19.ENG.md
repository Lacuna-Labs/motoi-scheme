# Book of AI Tech Cards — engineering report

**Author:** Ada (book-of-ai-tech-cards-author)
**Date:** 2026-07-19
**Status:** landed and audited
**Time budget:** ~6-10h authored
**Feeds:** motoi-v8-partial (NOT v7)

## Context

Alfred directive 2026-07-19:

> I want to reframe how we talk about them. I don't want to talk about them as products. But in the framing of computer science and engineering. SG is in there. DEC is in there. Why not Anthropic? Claude isn't a shell script.

New scheme-book: `book-of-ai-tech-cards`. Engineering-firm register — same tone as we'd give DEC, SGI, Xerox PARC, Bell Labs, Sun. Facts about AI firms and their contributions to the field. No product marketing. No rankings. No recommendations.

## Deliverables landed

- **Book directory:** `~/code/motoi-scheme/scheme-books/book-of-ai-tech-cards/`
- **Files:** 17 total
  - `cover.book.slatl`
  - `MANIFEST.slat`
  - `README.slat`
  - 8 company cards: `01-anthropic` through `08-xai`
  - 6 technology cards: `09-transformer` through `14-whisper-and-clip`
- **Word count total:** ~13,048
- **Training pairs:** 396 at `~/.forge/corpus/motoi-v8-partial/ai-tech-history-cards-2026-07-19.jsonl`

## Cards content summary

| # | Card | Year | Who | Shipped |
|---|---|---|---|---|
| 1 | Anthropic | 2021 | Dario + Daniela Amodei | Claude · Constitutional AI (2022) · MCP (2024) |
| 2 | OpenAI | 2015 | Altman · Brockman · Sutskever · Musk · Schulman · Zaremba | GPT · ChatGPT · Whisper · CLIP · DALL-E · InstructGPT |
| 3 | Google DeepMind | DeepMind 2010; merger April 2023 | Hassabis · Legg · Suleyman | transformer paper 2017 · AlphaGo 2016 · AlphaFold 2020 · Gemini · Gemma |
| 4 | Meta AI | FAIR 2013 | LeCun | PyTorch 2016 · Llama 2023 · SAM 2023 |
| 5 | Mistral | April 2023 | Mensch · Lample · Lacroix | Mistral 7B (Sep 2023) · Mixtral 8x7B (Dec 2023) Apache 2.0 |
| 6 | DeepSeek | 2023 | Liang Wenfeng | DeepSeek-V3 (Dec 2024) · DeepSeek-R1 (Jan 2025) open-weights |
| 7 | Cohere | 2019 | Gomez · Zhang · Frosst | Command · Embed · Rerank · Aya |
| 8 | xAI | July 2023 | Musk | Grok · Colossus (Memphis) · Grok-1 open-weights |
| 9 | Transformer | June 2017, arxiv 1706.03762 | Vaswani + 7 co-authors | the architecture underneath every modern LLM |
| 10 | MCP | November 2024 | Anthropic | open protocol: JSON-RPC over stdio/HTTP |
| 11 | Constitutional AI | December 2022, arxiv 2212.08073 | Bai et al. Anthropic | self-critique + RLAIF methodology |
| 12 | RLHF | March 2022 InstructGPT, arxiv 2203.02155 | Ouyang et al. OpenAI + Christiano 2017 arxiv 1706.03741 | 3-stage: SFT + reward model + PPO |
| 13 | LoRA | June 2021, arxiv 2106.09685 | Hu et al. Microsoft | low-rank adapters — Motoi's own training tech |
| 14 | Whisper + CLIP | Whisper Sep 2022 arxiv 2212.04356; CLIP Jan 2021 arxiv 2103.00020 | Radford et al. OpenAI | PARC-shaped open contributions |

## Ranking-language audit

**Target:** 0 affirmative ranking hits.

**Cards scan** with regex `is the best | is the leader | leader in | ahead of | behind on | is ahead | is behind | the best at | superior to | inferior to | outperforms | dominates | leads the | beat the competition | number one | #1`:
- 12 hits total, **all inside `I do not say X` refusal blocks** in the Motoi-voice section of each card
- Sample: `01-anthropic.book.slatl:107: I do not say Anthropic is the leader in AI safety. That is a ranking.`

**Pairs scan** with same regex plus `winning` and `wins the race`:
- 3 hits, **all false positives** — the phrase `methodology behind ChatGPT` uses `behind` in the "underneath / powering" sense, not the ranking sense.
- **Affirmative ranking-language hits: 0.**

Conclusion: zero affirmative ranking language. All matches in cards are the doctrine-required refusal shapes ("I do not say X — that is a ranking"), which teach the model the refusal pattern.

## Ranking-language safeguards

- **Cards:** every card has a `What Motoi does not say` section listing ranking language explicitly, so the model absorbs the refusal shape.
- **Pairs:** ~35 refusal-shape pairs across the corpus with explicit `I don't rank them` / `I don't recommend AI systems` responses to ranking-style prompts (which / best / should / better / ahead / winning / etc).
- **Coverage:** every company card has at least one ranking-refusal pair for that firm. Cross-cutting refusal pairs at cover level handle general "who's ahead" / "AI race" / "which is best" style prompts.

## Provenance chain

Doctrine applied:
- `project_ai_company_tech_facts_yes_recommendations_no_2026_07_19`
- `project_motoi_personality_2026_07_17`
- `project_no_contaminants_provenance_rule_2026_07_17`

Papers cited (all traceable to public arxiv or Nature):
- Vaswani 2017 arxiv 1706.03762 (transformer)
- Brown 2020 arxiv 2005.14165 (GPT-3)
- Ouyang 2022 arxiv 2203.02155 (InstructGPT)
- Christiano 2017 arxiv 1706.03741 (earlier RLHF)
- Bai 2022 arxiv 2212.08073 (Constitutional AI)
- Radford 2022 arxiv 2212.04356 (Whisper)
- Radford 2021 arxiv 2103.00020 (CLIP)
- Touvron 2023 arxiv 2302.13971 (LLaMA)
- Jiang 2023 arxiv 2310.06825 (Mistral 7B)
- Jiang 2024 arxiv 2401.04088 (Mixtral)
- DeepSeek-AI arxiv 2412.19437 (V3)
- DeepSeek-AI arxiv 2501.12948 (R1)
- Rafailov 2023 arxiv 2305.18290 (DPO)
- Hu 2021 arxiv 2106.09685 (LoRA)
- Dettmers 2023 arxiv 2305.14314 (QLoRA)
- Liu 2024 arxiv 2402.09353 (DoRA)
- Silver 2016 Nature 529, 484-489 (AlphaGo)
- Jumper 2021 Nature 596, 583-589 (AlphaFold 2)

Specifications:
- `modelcontextprotocol.io` — MCP spec + reference SDKs

**No contaminants:** every fact traces to a public paper, founding announcement, or protocol specification cited above. No fabrication.

## Engineering notes

- **Card length:** each card ~500-1200 words prose per directive. Mix of history + technical mechanics + register-refusal-examples.
- **AlphaGo arxiv caveat:** AlphaGo's primary reference is Nature (Silver et al. 2016), not arxiv. Handled with a specific pair that says so honestly.
- **Llama 2 arxiv caveat:** the specific Llama-2 arxiv ID wasn't in my substrate cleanly. One pair honestly admits this and points at Meta's site.
- **Cohere history:** founding year 2019 confirmed via founder biographies. Cohere for AI launched 2022.
- **xAI details:** Colossus location Memphis TN, Grok-1 314B MoE, from 2024 public announcements.
- **Alfred's `Anthropic is ahead` note:** memory-only per doctrine, not encoded in substrate. Motoi does not carry Alfred's ranking preference.

## 16-chapter invariant

- Current: **14** cards (8 company + 6 technology)
- Directive said seed with 8-12 cards is fine; 16-chapter invariant applies once expanded
- **14 is above the 8-12 seed range.** Book is seeded, not yet at 16-chapter invariant.

Future expansion candidates (not autonomous — awaits Alfred go):
- Alibaba Qwen research group (Motoi's own base model)
- Hugging Face (model hub / peft / transformers library)
- Diffusion models (Ho et al. 2020 arxiv 2006.11239)
- Chain-of-thought prompting (Wei et al. 2022 arxiv 2201.11903)
- Mixture-of-experts as its own technology card (Shazeer 2017 arxiv 1701.06538)

## Feeds v8

- **Corpus file:** `~/.forge/corpus/motoi-v8-partial/ai-tech-history-cards-2026-07-19.jsonl`
- **Pair count:** 396
- **Pair shape:** user + assistant, Motoi voice, dry-warm register, ranking-refusal shape embedded
- **Pair provenance:** every pair's `_meta._source` points at a card file (`01-anthropic`, `09-transformer`, `cover`, etc.)
- **Doctrine compliance:** no contaminants; every pair derives from an authored card paragraph. Provenance chain: `pair → _meta._source → card file → :provenance block → public paper/arxiv/spec`.
- **Notes:** v8 fold will fire when triggered by Alfred. Not autonomous. v7 training just refired at PID 26090 per directive; this is v8 substrate work.
- **Composability:** composes with `book-of-ml` — this book is the who / when / why; that book is the how.

## Do NOT touch

- No commits (per directive)
- No training fire (per directive; feeds v8, not currently training)
- No deletes (per repo doctrine)
- No Motoi personality changes (doctrine fixed; this book uses it, does not modify it)

## Needs Alfred

**None blocking.** Book seed is complete and audited. Ranking language clean. Provenance chain intact.

Open questions:
1. Do you want the book expanded to 16 chapters? Candidates listed above. **Not autonomous — awaits go.**
2. Is the cover mention of "Alfred: Anthropic is ahead" doctrine (memory only, not substrate) the right treatment? **Recommended: yes, per doctrine — Alfred's personal ranking preference does not become Motoi's.**

## Ada cosign

**Ada cosign — authoring pass complete.**

14 cards + cover + MANIFEST + README landed at `~/code/motoi-scheme/scheme-books/book-of-ai-tech-cards/`.

396 pairs at `~/.forge/corpus/motoi-v8-partial/ai-tech-history-cards-2026-07-19.jsonl`.

Zero affirmative ranking language in cards or pairs (12 negation-audit hits inside `I do not say` refusal blocks in cards — those are the doctrine-required refusal shapes, not violations).

Every date, name, arxiv ID traces to a public paper or founding announcement. Motoi's engineering-history voice preserved throughout: dry, factual, honest, humble about limits, no walk-back. DEC / PARC / Bell Labs register consistently applied.

**No commits. No training fired. v8-partial only.**

Ready for Alfred review.
