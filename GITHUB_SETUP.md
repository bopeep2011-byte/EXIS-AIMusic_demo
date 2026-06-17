# GitHub 推送指南 · EXIS AI Music Demo

## 本仓库应提交什么

| 提交 | 不提交 |
|------|--------|
| `index.html`、`assets/`、`server/`、`config/*.json`（除 registry） | `cache/` 音频缓存 |
| `start_demo.bat` | `*.wav` / `*.mid` / 模型权重 |
| `ORIGEN_TRAIL_Slides.pptx`（约 250KB） | `config/access_registry.jsonl`（含用户隐私） |

音频在本地由 `start_demo.bat` 启动后**自动生成**；合作方克隆后需按 `demo_paths.json` 指向本机 `exis_studio` 资源。

---

## 报错：文件过大

GitHub 限制：

- 网页上传：**单文件 25MB**
- `git push`：**单文件 100MB**（超过直接拒绝）

**勿**把上级目录 `D:\0000_AI Muisc` 整盘入库——其中 `MIDI_GPT_LAB\maestro` 等有 **1200+ 个 >25MB** 文件。

**只**在 `EXIS_AIMusic Demo` 目录维护 Git 仓库。

---

## 推荐流程（本 Demo，无需 LFS）

```powershell
cd "D:\0000_AI Muisc\EXIS_AIMusic Demo"

# 1. 从 Git 索引移除已跟踪的缓存（不删本地文件）
git rm -r --cached cache/ 2>$null
git rm -r --cached server/__pycache__/ 2>$null
git rm --cached config/access_registry.jsonl 2>$null

# 2. 确认 .gitignore 已生效
git add .gitignore GITHUB_SETUP.md
git status

# 3. 提交
git commit -m "chore: ignore cache and generated audio from version control"

# 4. 关联远程并推送（替换为你的仓库地址）
git remote add origin https://github.com/YOUR_USER/exis-aimusic-demo.git
git branch -M main
git push -u origin main
```

推送前自检最大文件：

```powershell
git rev-list --objects --all | ForEach-Object { $_.Split(' ',2) } ...
# 或：
py -3 scripts/check_git_blob_sizes.py
```

---

## 何时用 Git LFS

本 Demo **默认不需要 LFS**。仅当必须把 `*.pptx` / 小型 `*.wav` 放进仓库时：

```bash
git lfs install
git lfs track "*.wav"
git add .gitattributes
```

注意：GitHub Free 的 LFS 带宽有限；大模型/数据集请用 Hugging Face / 网盘 + 仓库内下载脚本。

---

## 已误提交大文件到历史

若 `git push` 仍报大文件，说明**历史提交**里还有 blob：

```powershell
# 安装 git-filter-repo 后（pip install git-filter-repo）
git filter-repo --path cache/ --invert-paths
git push origin --force main
```

仅在没有他人协作、且确认远程可 force push 时使用。

---

## 上级目录 `0000_AI Muisc` 若也要版本管理

在**父目录**单独建仓时，根目录 `.gitignore` 应包含：

```
MIDI_GPT_LAB/
exis_studio/validation_outputs/
exis_studio/**/checkpoints/
*.pt
*.pth
**/cache/
```

只把 `EXIS_AIMusic Demo` 作为子模块或独立仓库推送。
