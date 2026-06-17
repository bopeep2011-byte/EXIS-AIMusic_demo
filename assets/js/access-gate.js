const SESSION_KEY = "exis_origen_trail_session";

export async function ensureAccessGate(fetchJson) {
  const gate = document.getElementById("access-gate");
  gate?.classList.add("open");
  gate?.classList.remove("closed");
  document.getElementById("boot-hint")?.remove();

  if (location.protocol === "file:") {
    throw new Error("请运行 start_demo.bat，在浏览器打开 http://127.0.0.1:8765/ （不要直接双击 index.html）");
  }

  const saved = getSession();
  if (saved) { hideGate(); return saved; }
  const policy = await fetchJson("/api/access/policy");
  renderGate(policy);
  gate?.classList.add("open");
  gate?.classList.remove("closed");
  return new Promise((resolve, reject) => {
    document.getElementById("access-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("gate-error");
      errEl.textContent = "";
      if (!document.getElementById("nda-accept").checked) { errEl.textContent = "请同意保密条款"; return; }
      try {
        const res = await fetchJson("/api/access/verify", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: document.getElementById("gate-name").value.trim(),
            email: document.getElementById("gate-email").value.trim(),
            organization: document.getElementById("gate-org").value.trim(),
            nda_accepted: true, mode: "login",
          }),
        });
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(res));
        hideGate(); resolve(res);
      } catch (err) { errEl.textContent = err.message; reject(err); }
    });
  });
}

function getSession() {
  try {
    const d = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (d?.expires_at && Date.now() > d.expires_at) return null;
    return d;
  } catch { return null; }
}

function hideGate() {
  const gate = document.getElementById("access-gate");
  gate?.classList.remove("open");
  gate?.classList.add("closed");
  document.getElementById("app-shell")?.classList.remove("locked");
}

function renderGate(policy) {
  document.getElementById("gate-program").textContent = policy.trail_program?.name || "ORIGEN TRAIL";
  document.getElementById("gate-product").textContent = policy.public_copy?.product_title || "EXIS AI Music";
  document.getElementById("nda-clauses").innerHTML = (policy.nda?.clauses_zh || []).map((c) => `<li>${c}</li>`).join("");
  document.getElementById("gate-copyright").textContent = `© ${policy.copyright || "winboy.ai"}`;
}
