# Netlify + M1–M4 完整音频/模型配置指南

站点示例：[mxisai-muisc-demo.netlify.app](https://mxisai-muisc-demo.netlify.app/)

## 架构说明

```
浏览器  →  Netlify（静态页面 + /api 函数）
              │
              ├─ 登录/文案：函数直接返回 config/*.json  ✅
              │
              └─ M1–M4 音频/模型：转发到 EXIS_API_ORIGIN  →  Flask demo_server.py
```

Netlify **不能**运行 Python / PyTorch。M1–M4 必须在另一台机器上跑 `demo_server.py`，再通过环境变量 `EXIS_API_ORIGIN` 告诉 Netlify 函数去转发请求。

---

## 后端必须包含什么

在你运行 Flask 的机器上，目录结构应类似：

```
D:\0000_AI Muisc\
├── EXIS_AIMusic Demo\          ← demo_server.py
└── exis_studio\
    ├── foundation_dataset\     ← 模型、标注、PYTHONPATH
    └── validation_outputs\musician_runtime\
        ├── rewire_r1_listen_pack_v1.json
        └── generation_rewire_r1_tracks\   ← *_REF.wav 音频库
            ├── 01_Lange_REF.wav
            ├── 02_amos_tori_REF.wav
            └── ...
```

`demo_paths.json` 使用相对路径指向上述资源；`listen_pack` 内 WAV 为**本机绝对路径**（当前为 `D:\0000_AI Muisc\...`），因此**最省事的做法是在你这台已配置好的 Windows 电脑上跑后端**，再用隧道暴露公网。

### Python 依赖

```powershell
py -3 -m pip install -r requirements.txt
```

需要：Python 3.11+、`flask`、`torch`、`mido`，以及本机 FluidSynth 相关组件（与本地 `start_demo.bat` 相同）。

---

## 方案 A（推荐）：本机后端 + 隧道 + Netlify

适合：合作方看 Netlify 页面，音频/模型仍从你电脑出。

### 步骤 1 — 启动本地完整 Demo

```bat
D:\0000_AI Muisc\EXIS_AIMusic Demo\start_demo.bat
```

确认本机可访问：http://127.0.0.1:8765/  
（M1–M4 在本机应全部正常）

### 步骤 2 — 暴露公网 HTTPS（二选一）

#### 选项 1：ngrok

1. 安装 [ngrok](https://ngrok.com/)
2. 运行：

```powershell
ngrok http 8765
```

3. 复制 **Forwarding** 里的 HTTPS 地址，例如：  
   `https://a1b2c3d4.ngrok-free.app`

#### 选项 2：Cloudflare Tunnel

```powershell
cloudflared tunnel --url http://127.0.0.1:8765
```

复制输出的 `https://xxxx.trycloudflare.com` 地址。

### 步骤 3 — 验证隧道

在浏览器打开（把地址换成你的）：

```
https://a1b2c3d4.ngrok-free.app/api/meta
```

应返回 JSON，含 `audio_catalog`、`demo_build` 等字段。

再测音频接口：

```
https://a1b2c3d4.ngrok-free.app/api/m1/audio
```

应返回含 `audio_url` 的 JSON。

### 步骤 4 — 配置 Netlify 环境变量

1. 打开 [Netlify Dashboard](https://app.netlify.com/) → 你的站点  
2. **Site configuration** → **Environment variables**  
3. 添加：

| Key | Value | 示例 |
|-----|-------|------|
| `EXIS_API_ORIGIN` | 隧道 HTTPS 根地址（无末尾 `/`） | `https://a1b2c3d4.ngrok-free.app` |

4. **Save** → **Deploys** → **Trigger deploy** → **Deploy site**

> 修改环境变量后必须重新 Deploy，函数才会读到新值。

### 步骤 5 — 验证 Netlify 全链路

1. 打开 https://mxisai-muisc-demo.netlify.app/  
2. 登录 NDA  
3. 页脚应显示 `deploy_mode` 相关构建信息；若配置正确，**不再**出现黄色 Netlify 静态模式提示  
4. 浏览器访问（应返回 JSON，不是 503）：

```
https://mxisai-muisc-demo.netlify.app/api/m1/audio
```

5. 在 M1–M4 模块点击播放，应能听到音频。

### 注意事项

- **电脑和 `start_demo.bat` 窗口必须一直开着**；关机或关隧道，Netlify 上的音频会失效。  
- ngrok 免费版 URL 每次重启会变，需更新 `EXIS_API_ORIGIN` 并重新 Deploy。  
- 首次 M2 推理会加载 PyTorch 模型，可能等待 10–30 秒。

---

## 方案 B：纯本地（不经过 Netlify）

适合：仅自己或同局域网演示，配置最简单。

```bat
start_demo.bat
```

浏览器只打开：**http://127.0.0.1:8765/**  
不要打开 Netlify 地址，也不要双击 `index.html`。

---

## 方案 C：云服务器常驻后端

适合：需要 7×24 对外演示，不依赖你本机开机。

### 1. 准备服务器

- Windows Server 或 Linux VPS（建议 ≥ 4GB RAM，M2 要加载 `stage1_clm_v11.pt`）  
- 将整个 `0000_AI Muisc\EXIS_AIMusic Demo` 与 `exis_studio` 相关目录上传到服务器  
- 若路径不是 `D:\0000_AI Muisc\`，需编辑 `rewire_r1_listen_pack_v1.json` 里各 `tracks.REF` 为服务器上的实际路径

### 2. 安装依赖并启动

**Windows：**

```bat
set PYTHONPATH=D:\path\to\exis_studio\foundation_dataset
py -3 -m pip install -r requirements.txt
py -3 server\demo_server.py
```

**Linux（示例，监听所有网卡）：**

修改 `demo_server.py` 最后一行为：

```python
app.run(host="0.0.0.0", port=8765, debug=False, use_reloader=False)
```

或使用 gunicorn（需额外封装 Flask app）。

### 3. 防火墙与安全组

- 开放 TCP **8765**（或 443 若前面有 Nginx）  
- **强烈建议**仅允许 Netlify 函数服务器 IP 访问，或前面加 Nginx + 基本认证 / API Key

### 4. Netlify 配置

```
EXIS_API_ORIGIN = http://你的服务器公网IP:8765
```

或 HTTPS 域名：`https://api.yourdomain.com`

重新 Deploy Netlify 站点。

---

## 接口对照表

| 模块 | 接口 | 无 EXIS_API_ORIGIN | 有 EXIS_API_ORIGIN |
|------|------|--------------------|--------------------|
| 登录 | `GET /api/access/policy` | ✅ Netlify | ✅ Netlify |
| 登录 | `POST /api/access/verify` | ✅ Netlify | ✅ Netlify |
| 文案 | `GET /api/meta` | ✅ Netlify | ✅ Netlify |
| M1 分析 | `GET /api/m1/analyze` | ❌ 503 | ✅ 转发后端 |
| M1 音频 | `GET /api/m1/audio` | ❌ 503 | ✅ 转发后端 |
| M2 推理 | `POST /api/m2/predict-audio` | ❌ 503 | ✅ 转发后端 |
| M3 音频 | `GET /api/m3/audio` | ❌ 503 | ✅ 转发后端 |
| M4 音频 | `GET /api/m4/audio` | ❌ 503 | ✅ 转发后端 |
| 音频流 | `GET /api/audio/serve/...` | ❌ 503 | ✅ 转发后端 |

---

## 常见问题

### `/api/access/policy` 仍 404

- 确认 Netlify 已 Deploy 含 `netlify.toml` 的最新 commit（`86b41a9` 或更新）  
- Publish directory 必须为 `.`（仓库根目录）

### 登录成功但 M1 无声音 / 503

- 未设置 `EXIS_API_ORIGIN`，或 Deploy 未刷新  
- 隧道/本机 `start_demo.bat` 未运行  
- 用浏览器直接访问 `https://你的隧道/api/m1/audio` 排查后端

### M2 很慢或超时

- 首次加载 PyTorch 模型较慢；Netlify 函数默认超时约 10–26 秒，复杂推理可能超时  
- **建议**：M2 重推理场景优先用方案 B 本地访问，或方案 C 云服务器降低延迟

### `demo_audio_unavailable`

- 服务器上缺少 `generation_rewire_r1_tracks\*_REF.wav`  
- `listen_pack` 里路径与服务器实际路径不一致

---

## 快速检查清单

- [ ] 本机 `http://127.0.0.1:8765/` M1–M4 正常  
- [ ] 隧道 URL `/api/meta` 返回 JSON  
- [ ] Netlify 已设置 `EXIS_API_ORIGIN`（无尾部 `/`）  
- [ ] Netlify 已重新 Deploy  
- [ ] `https://mxisai-muisc-demo.netlify.app/api/m1/audio` 非 503  

全部打勾后，Netlify 站点即可提供完整 M1–M4 体验。
