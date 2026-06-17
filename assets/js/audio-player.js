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
      <div class="audio-trk"><div class="audio-trk-label">${aLabel}</div><audio controls preload="metadata" src="${aUrl ? `${aUrl}${aUrl.includes("?") ? "&" : "?"}_t=${Date.now()}` : ""}"></audio></div>
      <div class="audio-trk"><div class="audio-trk-label">${bLabel}</div><audio controls preload="metadata" src="${bUrl ? `${bUrl}${bUrl.includes("?") ? "&" : "?"}_t=${Date.now()}` : ""}"></audio></div>
    </div>`;
}

export function bindAudio(el, url) {
  if (!el || !url) return;
  const bust = url.includes("?") ? "&" : "?";
  el.src = `${url}${bust}_t=${Date.now()}`;
  el.load();
}
