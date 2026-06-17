# EXIS AI Music Demo

Partner preview · 音乐工业化生产工具 + 音乐综合智能体 · © winboy.ai

## Quick start

```bat
start_demo.bat
```

Open **http://127.0.0.1:8765** (keep the terminal window open).

## Requirements

- Python 3.11+ with `flask`, `torch`, `mido`
- Local `exis_studio` foundation dataset (paths in `config/demo_paths.json`)
- Reference audio library under `exis_studio/validation_outputs/musician_runtime/` (generated at runtime into `cache/audio/`)

## Repository layout

| Path | Purpose |
|------|---------|
| `server/` | Flask API (`demo_server.py`, `demo_audio.py`) |
| `assets/` | Frontend JS/CSS |
| `config/` | Demo catalog, access policy, civilization copy |
| `index.html` | NDA gate + M1–M5 modules |
| `cache/` | **Not in Git** — audio segments generated locally |

## Modules

- **M1** Music understanding (demo1)
- **M2** Music language model + continuation audio (demo2-A/B/C)
- **M3** FM Core preview (demo3)
- **M4** Controlled workflow (demo4–demo8)
- **M5** Audio runtime roadmap

## Git / large files

Do not commit `cache/`, `*.wav`, or model weights. See [GITHUB_SETUP.md](GITHUB_SETUP.md).

## Confidential

ORIGEN TRAIL NDA gate on first access. `config/access_registry.jsonl` is gitignored.
