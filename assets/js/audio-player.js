let backendOrigin = "";

export function configureAudio({ backendOrigin: origin } = {}) {
  backendOrigin = (origin || "").replace(/\/$/, "");
}

function toPlayableUrl(url) {
  if (!url) return url;
  try {
    if (url.startsWith("http")) {
      const u = new URL(url);
      if (u.pathname.startsWith("/api/audio/")) return url;
    }
    if (url.startsWith("/api/audio/") && backendOrigin) {
      return `${backendOrigin}${url}`;
    }
  } catch {
    /* keep original */
  }
  return url;
}

function needsNgrokHeader(url) {
  try {
    return new URL(url, location.origin).hostname.includes("ngrok");
  } catch {
    return Boolean(backendOrigin) || location.hostname.includes("ngrok");
  }
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

async function loadAudioElement(el, url) {
  if (!el || !url) return;
  const bust = url.includes("?") ? "&" : "?";
  const fullUrl = `${toPlayableUrl(url)}${bust}_t=${Date.now()}`;
  const headers = {};
  if (needsNgrokHeader(fullUrl)) headers["ngrok-skip-browser-warning"] = "true";

  setAudioHint(el, "音频加载中…");
  try {
    const res = await fetch(fullUrl, { headers, credentials: "omit", mode: "cors" });
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
    await new Promise((resolve, reject) => {
      const done = () => {
        el.removeEventListener("loadeddata", done);
        el.removeEventListener("error", fail);
        resolve();
      };
      const fail = () => {
        el.removeEventListener("loadeddata", done);
        el.removeEventListener("error", fail);
        reject(new Error("audio element decode failed"));
      };
      el.addEventListener("loadeddata", done);
      el.addEventListener("error", fail);
      el.load();
    });
    setAudioHint(el, `已就绪 · ${(blob.size / 1024 / 1024).toFixed(1)} MB · 请点 ▶ 播放`);
  } catch (e) {
    console.error("audio load failed", fullUrl, e);
    setAudioHint(el, `音频加载失败：${e.message || e}`, true);
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
      <div class="audio-trk"><div class="audio-trk-label">${aLabel}</div><audio controls preload="metadata" style="width:100%"></audio></div>
      <div class="audio-trk"><div class="audio-trk-label">${bLabel}</div><audio controls preload="metadata" style="width:100%"></audio></div>
    </div>`;
  const [aEl, bEl] = container.querySelectorAll("audio");
  bindAudio(aEl, aUrl);
  bindAudio(bEl, bUrl);
}
