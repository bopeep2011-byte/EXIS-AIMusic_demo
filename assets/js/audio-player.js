let backendOrigin = "";

export function configureAudio({ backendOrigin: origin } = {}) {
  backendOrigin = (origin || "").replace(/\/$/, "");
}

function isNetlifyHost() {
  return location.hostname.includes("netlify.app");
}

function toPlayableUrl(url) {
  if (!url) return url;
  try {
    if (url.startsWith("http")) {
      const u = new URL(url);
      if (u.pathname.startsWith("/api/audio/")) {
        if (isNetlifyHost() || !location.hostname.includes("ngrok")) {
          return `${u.pathname}${u.search}`;
        }
        return url;
      }
    }
    if (url.startsWith("/api/audio/") && backendOrigin && location.hostname.includes("ngrok")) {
      return `${backendOrigin}${url}`;
    }
  } catch {
    /* keep original */
  }
  return url;
}

function useSameOriginAudio(url) {
  const resolved = toPlayableUrl(url);
  return resolved.startsWith("/");
}

function setAudioHint(el, text, isError = false) {
  const host = el.closest(".audio-trk") || el.parentElement;
  if (!host) return;
  let hint = host.querySelector(".audio-load-hint");
  if (!hint) {
    hint = document.createElement("p");
    hint.className = "audio-load-hint";
    hint.style.cssText = "font-size:11px;margin:6px 0 0;color:var(--text3)";
    host.appendChild(hint);
  }
  hint.textContent = text || "";
  hint.style.color = isError ? "var(--amber)" : "var(--text3)";
}

function waitForAudioMeta(el, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    if (el.readyState >= 1) {
      resolve();
      return;
    }
    const timer = setTimeout(() => resolve(), timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const fail = () => {
      clearTimeout(timer);
      reject(new Error("audio decode failed"));
    };
    el.addEventListener("loadedmetadata", done, { once: true });
    el.addEventListener("error", fail, { once: true });
    el.load();
  });
}

async function loadViaSrc(el, fullUrl) {
  setAudioHint(el, "音频加载中…");
  if (el._blobUrl) {
    URL.revokeObjectURL(el._blobUrl);
    el._blobUrl = null;
  }
  el.src = fullUrl;
  try {
    await waitForAudioMeta(el);
    const dur = Number.isFinite(el.duration) ? ` · ${el.duration.toFixed(0)}s` : "";
    setAudioHint(el, `已就绪${dur} · 请点 ▶ 播放`);
  } catch (e) {
    throw new Error(`播放器无法解码 (${e.message || e})`);
  }
}

async function loadViaBlob(el, fullUrl) {
  setAudioHint(el, "音频下载中（经 ngrok）…");
  const headers = { "ngrok-skip-browser-warning": "true" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120000);
  try {
    const res = await fetch(fullUrl, {
      headers,
      credentials: "omit",
      mode: "cors",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("text/plain")) {
      throw new Error("ngrok 拦截页（非音频）");
    }
    const blob = await res.blob();
    if (!blob.size || blob.size < 1000) throw new Error("音频为空");
    if (el._blobUrl) URL.revokeObjectURL(el._blobUrl);
    el._blobUrl = URL.createObjectURL(blob);
    el.src = el._blobUrl;
    await waitForAudioMeta(el, 30000);
    setAudioHint(el, `已就绪 · ${(blob.size / 1024 / 1024).toFixed(1)} MB · 请点 ▶ 播放`);
  } finally {
    clearTimeout(timer);
  }
}

async function loadAudioElement(el, url) {
  if (!el || !url) return;
  const bust = url.includes("?") ? "&" : "?";
  const fullUrl = `${toPlayableUrl(url)}${bust}_t=${Date.now()}`;
  try {
    if (useSameOriginAudio(url)) {
      await loadViaSrc(el, fullUrl);
    } else {
      await loadViaBlob(el, fullUrl);
    }
  } catch (e) {
    console.error("audio load failed", fullUrl, e);
    const msg = e.name === "AbortError" ? "下载超时（>120s）" : (e.message || e);
    setAudioHint(el, `音频加载失败：${msg}`, true);
    if (el._blobUrl) URL.revokeObjectURL(el._blobUrl);
    el._blobUrl = null;
    el.removeAttribute("src");
    el.load();
    throw e;
  }
}

export async function bindAudio(el, url) {
  if (!el || !url) return;
  try {
    await loadAudioElement(el, url);
  } catch {
    /* hint already shown */
  }
}

export function renderDualPlayers(container, data) {
  if (!container) return;
  const a = data.input || {};
  const b = data.output || data.continuation || {};
  const aUrl = a.audio_url || data.seed_url;
  const bUrl = b.audio_url || data.continuation_url;
  const aLabel = a.label || data.seed_label || "输入";
  const bLabel = b.label || data.continuation_label || "输出";
  container.innerHTML = `
    <div class="audio-compare">
      <div class="audio-trk"><div class="audio-trk-label">${aLabel}</div><audio controls preload="auto" style="width:100%"></audio></div>
      <div class="audio-trk"><div class="audio-trk-label">${bLabel}</div><audio controls preload="auto" style="width:100%"></audio></div>
    </div>`;
  const [aEl, bEl] = container.querySelectorAll("audio");
  bindAudio(aEl, aUrl);
  bindAudio(bEl, bUrl);
}
