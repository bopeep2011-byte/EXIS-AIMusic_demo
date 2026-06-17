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

## Netlify 部署

站点示例：[mxisai-muisc-demo.netlify.app](https://mxisai-muisc-demo.netlify.app/)

Netlify **只能托管静态页面**，本仓库已包含 `netlify.toml` + `netlify/functions/api.mjs`：

| 能力 | Netlify 单独部署 | + Flask 后端 |
|------|------------------|--------------|
| NDA 登录 `/api/access/policy` | ✅ | ✅ |
| 页面 / 文明架构文案 | ✅ | ✅ |
| M1–M4 音频 / 模型推理 | ❌ | ✅ |

### 部署步骤

1. Netlify 连接 GitHub 仓库 [EXIS-AIMusic_demo](https://github.com/bopeep2011-byte/EXIS-AIMusic_demo)
2. Build command 留空，Publish directory = `.`（根目录）
3. 重新 Deploy

### 完整音频体验（可选）

在 Netlify → **Site settings → Environment variables** 添加：

```
EXIS_API_ORIGIN = https://你的-flask-服务器地址
```

将 `demo_server.py` 部署到云主机 / Railway / Render，或用 ngrok 暴露本地 `8765` 端口。

未配置时，M1–M4 会提示 `backend_required`，本地完整体验仍用 `start_demo.bat`。
