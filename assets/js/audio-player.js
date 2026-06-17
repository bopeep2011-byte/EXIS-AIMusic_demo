let backendOrigin = "";

export function configureAudio({ backendOrigin: origin } = {}) {
  backendOrigin = (origin || "").replace(/\/$/, "");
}

function resolveUrl(url) {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  if (backendOrigin && url.startsWith("/")) return `${backendOrigin}${url}`;
  return url;
}

function needsNgrokHeader(url) {
  try {
    const host = new URL(url, location.origin).hostname;
    return host.includes("ngrok");
  } catch {
    return location.hostname.includes("ngrok");
  }
}

async function loadAudioElement(el, url) {
  if (!el || !url) return;
  const bust = url.includes("?") ? "&" : "?";
  const fullUrl = `${resolveUrl(url)}${bust}_t=${Date.now()}`;
  const headers = {};
  if (needsNgrokHeader(fullUrl)) headers["ngrok-skip-browser-warning"] = "true";
  try {
    const res = await fetch(fullUrl, { headers, credentials: "omit" });
    if (!res.ok) throw new Error(`audio ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("text/plain")) {
      throw new Error("ngrok interstitial blocked audio");
    }
    const blob = await res.blob();
    if (!blob.size || blob.size < 1000) throw new Error("audio empty");
    el.src = URL.createObjectURL(blob);
    el.load();
  } catch (e) {
    console.warn("blob audio load failed", fullUrl, e);
    el.removeAttribute("src");
    el.load();
  }
}

export function bindAudio(el, url) {
  return loadAudioElement(el, url);
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
  loadAudioElement(aEl, aUrl);
  loadAudioElement(bEl, bUrl);
}
