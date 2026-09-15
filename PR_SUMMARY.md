# GitHub 开放 Pull Request 与本次宣传页改动

更新时间：2026-09-15（Asia/Shanghai）

## 开放 Pull Request 状态

已通过 GitHub CLI 扫描当前账号 `bopeep2011-byte` 的全部可见仓库，并重点核对与 VoiceAI / EXIS AI Music 相关的仓库，包括 `EXIS-AIMuisc`、`EXIS-AIMusic_demo`、`winboyAI` 与 `RageRiftFX-Pro-Studio`。截至本次扫描，**没有处于 open 状态的 Pull Request**，因此不存在可总结的待评审改动、review decision 或阻塞项。

`EXIS-AIMusic_demo` 当前默认分支为 `main`，历史 PR 列表也为空。原仓库主要是一个受 NDA 保护的 EXIS AI Music 技术 Demo，包含 M1–M5 音乐理解、语言模型、FM Core、可控编排和音频 Runtime 模块；本次没有修改这些内部 Demo 逻辑。

## 本次新增改动

为避免公开宣传内容与 NDA Demo 混在一起，本次新增独立公开入口 `promo.html`，并新增 `assets/css/promo.css`。宣传页围绕官网 `voice-ai.live` 已公开的产品定位设计：

- 以“让声音成为可演奏的未来”为核心主张，建立下一代音乐 AI 平台的第一印象。
- 用 VoiceAI Studio、VoiceAI One、VoiceLeader Creator 与 EXIS AI Band 四张产品卡表达从创作、实时协作、云端 SaaS 到音乐智能底座的产品矩阵。
- 用 10ms 端到端延迟、128+ 乐器转换、99.9% 实时响应率和 ONNX + WASM 等公开卖点构成技术可信度区域。
- 采用深空黑、荧光青、紫色渐变、波形、轨道与实时控制台视觉，形成高调、未来感和音乐现场感；页面内置响应式布局、平滑锚点导航与 `prefers-reduced-motion` 友好的轻量交互基础。
- 原有 `index.html` NDA Gate 与内部 Demo 保持不变，宣传页可通过仓库根路径 `promo.html` 访问。

## 评审建议

由于当前没有开放 PR，本次改动提交在默认分支后建议直接作为一个独立宣传页变更进行人工验收：重点检查移动端首屏、邮件 CTA 地址、品牌文案与公开产品数据是否仍与官网保持一致。若后续需要正式评审，可从该提交创建 PR，并将产品负责人、设计负责人和技术负责人加入 reviewers。
