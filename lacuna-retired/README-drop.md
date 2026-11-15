# motoi — archived pre-1.0 foreman and Python outskirts, kept whole

BLUF: these trees hold the retired JavaScript foreman and the retired Python services, CLI, and control plane, archived on 2026-11-10 with zero code deleted. Live runtime services (`lacuna.runtime`, `lacuna.frontend`, `lacuna.executor`, `lacuna.inference`, `lacuna.ci`) never import from `motoi/`; only historical conformance and burn-in harnesses load `motoi/lacuna-foreman/` to verify record and wire parity. Git history stays intact (`git log --follow motoi/<tree>`).

| Tree | Was | Lived | Retired because | Replaced by |
|---|---|---|---|---|
| `lacuna-foreman/` | the Node supervisor on :1139 and `foreman.sock`, its plist `ai.lacunalabs.foreman.slat`, its record writers, and its unit tests | 2026-10-20 → 11-10 | supervision, actors, cortex, and Slat wire moved into the C++23 Lacuna VM (`vm/` → `lvm`); pure record, floor, and cart readers moved into `lacuna-node/` | `vm/` (`lacuna.runtime` on `foreman.sock` and :1139), `lacuna-node/records/`, `lacuna-node/floor/`, `lacuna-node/carts/` |
| `python/` | the Python FastAPI control plane (`lacuna-api` on :1137), the Python CLI (`lacuna-src`), the Python brain gateway (`lacuna-box/brain`), the Python jail workers (`lacuna-box/jail`), and retired scripts/plists | 2026-04-27 → 11-10 | 281 of 281 HTTP routes run in Node (`lacuna.frontend` on :1138), inference runs on `lme-serve` (`lacuna.inference`), and genuine Forge scripts stay in `forge/` (`gguf_mend.py`, `seed.py`) | `lacuna-node/frontend/`, `lacuna-node/cli/`, `lacuna-executor/`, `lme/`, `forge/` |
