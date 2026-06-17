import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const DEMO_BUILD = "20250617_netlify_v1";

function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

let access, civPublic, catalog;
try {
  access = loadJson("config/access_policy.json");
  civPublic = loadJson("config/civilization_public_v01.json");
  catalog = loadJson("config/demo_catalog.json");
} catch (e) {
  console.error("config load failed", e);
}

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function integrationPayload() {
  const civ = JSON.parse(JSON.stringify(civPublic || {}));
  civ.demo_position_zh = "EXIS AI 旗下 · 音乐工业化生产工具 + 音乐综合智能体";
  civ.product_definition = civPublic?.products?.exis_ai_music || {};
  return civ;
}

function m2PresetsPayload() {
  const presets = (catalog?.m2_presets || []).map((p) => ({
    ...p,
    label_zh: p.label_zh || p.demo_id,
    hint_zh: "L1 token 序列 · 点击加载后运行语言模型",
  }));
  return {
    presets,
    input_help_zh: "选择 demo2-A / B / C · 展示 Music Language Model token 与音乐片段",
  };
}

async function proxyToBackend(event) {
  const origin = process.env.EXIS_API_ORIGIN;
  if (!origin) return null;
  const qs = event.rawQuery ? `?${event.rawQuery}` : "";
  const url = `${origin.replace(/\/$/, "")}${event.path}${qs}`;
  const headers = { "ngrok-skip-browser-warning": "true" };
  if (event.headers["content-type"]) headers["Content-Type"] = event.headers["content-type"];
  if (event.headers.authorization) headers.Authorization = event.headers.authorization;
  if (event.headers.range) headers.Range = event.headers.range;
  const res = await fetch(url, {
    method: event.httpMethod,
    headers,
    body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
  });
  const outHeaders = { "Cache-Control": "no-store" };
  const ct = res.headers.get("content-type");
  if (ct) outHeaders["Content-Type"] = ct;
  const buf = Buffer.from(await res.arrayBuffer());
  const isBinary = (ct || "").includes("audio") || (ct || "").includes("octet-stream");
  if (!isBinary && (ct || "").includes("json")) {
    try {
      return { statusCode: res.status, headers: outHeaders, body: buf.toString("utf8") };
    } catch {
      /* fall through */
    }
  }
  return {
    statusCode: res.status,
    headers: outHeaders,
    body: isBinary ? buf.toString("base64") : buf.toString("utf8"),
    isBase64Encoded: isBinary,
  };
}

function rewriteAudioUrls(value, origin) {
  if (!origin) return value;
  const base = origin.replace(/\/$/, "");
  if (typeof value === "string" && value.startsWith("/api/audio/serve/")) {
    return `${base}${value}`;
  }
  if (Array.isArray(value)) return value.map((v) => rewriteAudioUrls(v, origin));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, rewriteAudioUrls(v, origin)])
    );
  }
  return value;
}

function backendRequired(path) {
  return json(503, {
    error: "backend_required",
    message:
      "M1–M4 音频与模型推理需要 EXIS Flask 后端。请在 Netlify 设置 EXIS_API_ORIGIN 指向已部署的 demo_server，或使用 start_demo.bat 本地访问。",
    path,
    hint: "本地完整体验: http://127.0.0.1:8765/",
  });
}

export async function handler(event) {
  const path = event.path || "";
  const method = event.httpMethod || "GET";

  try {
    if (path === "/api/access/policy" && method === "GET") {
      return json(200, access);
    }

    if (path === "/api/access/verify" && method === "POST") {
      const body = JSON.parse(event.body || "{}");
      if (!body.nda_accepted || !(body.name || "").trim() || !(body.email || "").trim()) {
        return json(400, { error: "nda_name_email_required" });
      }
      const hours = Number(access?.access?.session_hours || 24);
      return json(200, {
        ok: true,
        copyright: "winboy.ai",
        expires_at: Date.now() + hours * 3600000,
      });
    }

    if (path === "/api/meta" && method === "GET") {
      const pub = access?.public_copy || {};
      return json(200, {
        title: pub.product_title,
        subtitle: pub.product_subtitle,
        parent: pub.parent || "EXIS AI",
        tagline_zh: pub.tagline_zh,
        copyright: "winboy.ai",
        audio_catalog: catalog?.version || "netlify_static",
        demo_build: DEMO_BUILD,
        deploy_mode: process.env.EXIS_API_ORIGIN ? "netlify+backend" : "netlify_static",
        backend_origin: process.env.EXIS_API_ORIGIN || null,
      });
    }

    if (path === "/api/integration" && method === "GET") {
      return json(200, integrationPayload());
    }

    if (path === "/api/m2/presets" && method === "GET") {
      return json(200, m2PresetsPayload());
    }

    if (path === "/api/m4/demos" && method === "GET") {
      const demos = (catalog?.m4?.demos || []).map((d) => ({ demo_id: d.demo_id }));
      return json(200, { demos });
    }

    const proxied = await proxyToBackend(event);
    if (proxied) return proxied;

    if (path.startsWith("/api/")) {
      return backendRequired(path);
    }

    return json(404, { error: "not_found" });
  } catch (e) {
    console.error(e);
    return json(500, { error: "netlify_function_error", message: String(e.message || e) });
  }
}
