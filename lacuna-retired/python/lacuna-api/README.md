# lacuna-api

The HTTP control surface for Lacuna's web console.

This is a thin FastAPI app that exposes the `/ctl/*` endpoints the Lacuna
dashboard (`lacuna-web/`) consumes: status, errors, pilot, host telemetry,
LLM backend selection, RAG state, playbooks, and an operator chat surface.

It imports `lacuna.state`, `lacuna.llm`, `lacuna.rag`, etc. from the
`lacuna-src/` sibling package; it does not depend on any code outside this
repository.

## Endpoints

```
GET  /healthz                    liveness
GET  /ctl/status                 pid, uptime, recent errors, host info
GET  /ctl/errors[?limit=N]       recent captured errors (newest first)
POST /ctl/errors/clear           clear the error log
POST /ctl/pilot                  record who's driving
GET  /ctl/host                   host telemetry (cpu/mem/disk)
GET  /ctl/llm-status             current backend + key provenance
GET  /ctl/ai/backends            per-backend availability
POST /ctl/ai/reset               clear 402/429 unhealthy marks
GET  /ctl/pilot-config           read ~/.lacuna/pilot.yaml
POST /ctl/pilot-config           write ~/.lacuna/pilot.yaml
GET  /ctl/ai/rag                 RAG index stats
GET  /ctl/config                 effective YAML config
GET  /ctl/playbooks              list available playbooks
GET  /ctl/playbooks/{name}       dry-run one playbook
POST /ctl/chat                   operator chat (uses lacuna's persona + LLM)
```

## Run

```sh
pip install --user -e .
python3 -m uvicorn lacuna_api.app:app --port 5051
```

## Configure

| Env var            | Default                  | Effect                         |
|--------------------|--------------------------|--------------------------------|
| `LACUNA_HOME`      | `~/.lacuna`              | persistent state directory     |
| `LACUNA_PORT`      | `5051`                   | port to bind                   |
| `LACUNA_HOST`      | `127.0.0.1`              | host to bind                   |
| `LACUNA_ENV`       | `dev`                    | environment label              |
| `LACUNA_ENV_FILE`  | `$LACUNA_HOME/.env`      | env file with API keys         |

## Test

```sh
python3 -m pytest tests/
```

Test suite uses `fastapi.testclient.TestClient`; no real network,
filesystem isolated to `tmp_path` per test.

## Layout

```
lacuna-api/
├── pyproject.toml
├── lacuna_api/
│   ├── __init__.py        (exports `app`)
│   └── app.py             (the FastAPI app + endpoints)
└── tests/
    ├── conftest.py        (fixtures: lacuna_home, app_client)
    └── test_endpoints.py  (26 tests covering every endpoint)
```
