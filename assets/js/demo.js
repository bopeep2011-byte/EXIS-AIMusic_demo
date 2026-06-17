import { ensureAccessGate } from "./access-gate.js";
import { bindAudio, configureAudio, renderDualPlayers } from "./audio-player.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

async function fetchJson(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `${path} ${res.status}`);
  return res.json();
}

function showModule(id) {
  $$(".module").forEach((el) => el.classList.toggle("active", el.id === `mod-${id}`));
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.module === id));
  if (id === "m1") loadM1Audio().catch(console.error);
  if (id === "m2") loadM2("A").catch(console.error);
  if (id === "m3") loadM3().catch(console.error);
}

function barRow(label, pct) {
  const p = Math.min(100, Math.max(0, pct));
  return `<div class="bar-row"><span class="bar-label">${label}</span><div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div><span class="bar-pct">${p.toFixed(1)}%</span></div>`;
}

function renderIntegration(civ) {
  $("#civ-tagline").textContent = civ.tagline_zh || "";
  $("#product-positioning").textContent = civ.product_definition?.positioning_zh || "";
  $("#role-industrial").textContent = civ.product_definition?.dual_role?.industrialization_zh || "";
  $("#role-agent").textContent = civ.product_definition?.dual_role?.intelligence_agent_zh || "";
}

function renderM1(d) {
  $("#m1-sample-title").textContent = d.sample?.title || "demo1";
  const s = d.structure_analysis || {};
  $("#m1-stats").innerHTML = ["bars","phrases","cadences","token_count","note_events"].map((k,i) => {
    const labels = ["Bars","Phrases","Cadences","Tokens","Notes"];
    return `<div class="stat"><div class="val">${[s.bars,s.phrases,s.cadences,s.token_count,s.note_events][i]}</div><div class="lbl">${labels[i]}</div></div>`;
  }).join("");
  $("#m1-tokens").textContent = (d.token_preview || []).join(" ");
}

function renderM2(d) {
  $("#m2-input").textContent = (d.input_tokens || []).join(" ");
  $("#m2-predictions").innerHTML = (d.predictions || []).map((p) => barRow(p.token, p.probability * 100)).join("");
  if (d.audio) {
    bindAudio($("#m2-audio-seed"), d.audio.seed_url);
    bindAudio($("#m2-audio-cont"), d.audio.continuation_url);
    $("#m2-audio-meta").textContent = `${d.audio.seed_label || ""} · ${d.audio.continuation_label || ""}`;
  }
}

function renderM2Presets(data) {
  $("#m2-presets").innerHTML = (data.presets || []).map((p) =>
    `<button type="button" class="btn btn-secondary preset-btn" data-preset="${p.preset_key}">${p.demo_id || p.label_zh}</button>`
  ).join("");
  $$(".preset-btn").forEach((b) => b.addEventListener("click", () => {
    const p = (data.presets || []).find((x) => x.preset_key === b.dataset.preset);
    if (p?.tokens) $("#m2-token-input").value = p.tokens.join(" ");
    loadM2(p?.preset_key).catch(alert);
  }));
  $("#m2-input-help").textContent = data.input_help_zh || "";
}

async function loadM1() { renderM1(await fetchJson("/api/m1/analyze")); }
async function loadM1Audio() {
  const d = await fetchJson("/api/m1/audio");
  bindAudio($("#m1-audio"), d.audio_url);
  $("#audio-status").textContent = d.label || "24 bars · Acoustic Grand Piano";
  $("#m1-sample-title").textContent = d.demo_id || "demo1";
}
async function loadM2(presetKey) {
  const body = { preset: presetKey };
  const raw = $("#m2-token-input")?.value?.trim();
  if (raw) body.tokens = raw.split(/\s+/);
  renderM2(await fetchJson("/api/m2/predict-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}
async function loadM3() { renderDualPlayers($("#m3-audio-players"), await fetchJson("/api/m3/audio")); }
async function loadM4(demoId) {
  renderDualPlayers($("#m4-audio-players"), await fetchJson(`/api/m4/audio?demo_id=${encodeURIComponent(demoId || "demo4")}`));
}
async function loadM4Select() {
  const { demos } = await fetchJson("/api/m4/demos");
  const sel = $("#m4-demo");
  sel.innerHTML = (demos || []).map((d) => `<option value="${d.demo_id}">${d.demo_id}</option>`).join("");
  sel.onchange = () => loadM4(sel.value).catch(alert);
  if (sel.value) await loadM4(sel.value);
}

function alert(e) { console.error(e); window.alert(e.message || e); }

function showBootError(msg) {
  console.error(msg);
  document.getElementById("boot-hint")?.remove();
  const gate = $("#access-gate");
  gate?.classList.add("open");
  gate?.classList.remove("closed");
  $("#app-shell")?.classList.add("locked");
  const errEl = $("#gate-error");
  if (errEl) errEl.textContent = msg;
}

async function init() {
  $$(".nav-btn").forEach((b) => b.addEventListener("click", () => showModule(b.dataset.module)));
  $("#btn-refresh-m1")?.addEventListener("click", () => loadM1().catch(alert));
  $("#btn-play-melody")?.addEventListener("click", () => $("#m1-audio")?.play());
  $("#btn-run-m2")?.addEventListener("click", () => loadM2("A").catch(alert));
  try {
    await ensureAccessGate(fetchJson);
    document.getElementById("boot-hint")?.remove();

    const meta = await fetchJson("/api/meta");
    configureAudio({ backendOrigin: meta.backend_origin });
    $("#tagline-zh").textContent = meta.tagline_zh || "";
    $("#audio-build").textContent = `audio ${meta.audio_catalog || "?"} · ${meta.demo_build || ""}`;
    if (meta.deploy_mode === "netlify_static") {
      const hint = document.createElement("p");
      hint.id = "netlify-hint";
      hint.style.cssText = "color:var(--amber);font-size:12px;margin-bottom:12px";
      hint.textContent = "Netlify 预览模式：可浏览界面与 NDA 登录；M1–M4 音频/模型需配置 EXIS_API_ORIGIN 后端或使用本地 start_demo.bat。";
      $("#tagline-zh")?.after(hint);
    }
    renderIntegration(await fetchJson("/api/integration"));
    renderM2Presets(await fetchJson("/api/m2/presets"));

    // Show UI first; M2 model inference can take several seconds.
    await Promise.all([loadM1(), loadM1Audio(), loadM3(), loadM4Select()]);
    loadM2("A").catch(alert);
  } catch (e) {
    showBootError((e && (e.message || e.error)) ||
      "无法连接服务端，请先运行 start_demo.bat，然后打开 http://127.0.0.1:8765/");
  }
}

init();
