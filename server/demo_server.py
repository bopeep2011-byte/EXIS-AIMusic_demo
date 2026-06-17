#!/usr/bin/env python3
"""EXIS AI Music Demo — API server."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory

DEMO_ROOT = Path(__file__).resolve().parent.parent
DEMO_BUILD = "20250612_audio_v06"
SERVER_DIR = Path(__file__).resolve().parent
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from demo_audio import ensure_segment, load_listen_pack, ref_wav_at, render_midi_segment

CONFIG_PATH = DEMO_ROOT / "config" / "demo_paths.json"
CATALOG_PATH = DEMO_ROOT / "config" / "demo_catalog.json"
ACCESS_POLICY_PATH = DEMO_ROOT / "config" / "access_policy.json"
CIV_PUBLIC_PATH = DEMO_ROOT / "config" / "civilization_public_v01.json"
ACCESS_LOG = DEMO_ROOT / "config" / "access_registry.jsonl"

_cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
_catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
_access = json.loads(ACCESS_POLICY_PATH.read_text(encoding="utf-8"))
_civ_public = json.loads(CIV_PUBLIC_PATH.read_text(encoding="utf-8"))
FOUNDATION = (DEMO_ROOT / _cfg["foundation_root"]).resolve()
if str(FOUNDATION) not in sys.path:
    sys.path.insert(0, str(FOUNDATION))

app = Flask(__name__, static_folder=str(DEMO_ROOT), static_url_path="")
AUDIO_CACHE = DEMO_ROOT / "cache" / "audio"
_audio_keys: dict[str, Path] = {}
_model_cache: dict = {}
_pack_cache: dict | None = None

_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, Content-Type",
}


@app.before_request
def _cors_preflight():
    if request.method == "OPTIONS":
        resp = app.make_default_options_response()
        resp.headers.update(_CORS_HEADERS)
        return resp


@app.after_request
def _cors_headers(resp):
    if request.path.startswith("/api/"):
        resp.headers.update(_CORS_HEADERS)
    return resp


def _catalog_ver() -> str:
    return str(_live_catalog().get("version") or "v")


def _purge_stale_audio_cache() -> None:
    """Remove all cached wav segments on every startup (old zombie servers left stale files)."""
    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    ver = _catalog_ver()
    for wav in AUDIO_CACHE.glob("*.wav"):
        wav.unlink(missing_ok=True)
    (AUDIO_CACHE / ".catalog_version").write_text(ver, encoding="utf-8")


def _segment(ref: Path, tag: str, start: float, end: float, pair_index: int) -> Path:
    return ensure_segment(
        ref,
        AUDIO_CACHE,
        tag,
        start,
        end,
        pair_index=pair_index,
        catalog_ver=_catalog_ver(),
    )


def _resolve(p: str) -> Path:
    return (DEMO_ROOT / p).resolve()


def _pack() -> dict:
    global _pack_cache
    if _pack_cache is None:
        _pack_cache = load_listen_pack(_resolve(_cfg["listen_pack"]))
    return _pack_cache


def _live_catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def _register_wav(path: Path) -> str:
    key = hashlib.sha1(str(path.resolve()).encode()).hexdigest()[:20]
    _audio_keys[key] = path.resolve()
    return key


def _audio_url(path: Path) -> str | None:
    if not path.is_file():
        return None
    key = _register_wav(path)
    try:
        mtime = int(path.stat().st_mtime)
    except OSError:
        mtime = 0
    ver = _live_catalog().get("version", "v")
    return f"/api/audio/serve/{key}?v={ver}.{mtime}"


def _public_audio(demo_id: str, label: str, path: Path, *, duration_hint: str | None = None) -> dict:
    return {
        "demo_id": demo_id,
        "label": label,
        "audio_url": _audio_url(path),
        "duration_hint": duration_hint,
    }


def _load_default_anno() -> dict:
    sample = _catalog.get("default_sample") or _cfg.get("default_sample") or {}
    return json.loads(_resolve(sample["anno_json"]).read_text(encoding="utf-8"))


def _sample_meta() -> dict:
    s = _catalog.get("default_sample") or {}
    return {"id": s.get("id", "demo1"), "title": s.get("title", "demo1")}


def _m1_from_anno(anno: dict) -> dict:
    from musician_runtime.midi_training.layered.layered_slice_encoder import build_l1_samples_from_anno

    gl = anno.get("global_L4") or {}
    phrases = anno.get("phrase_list_L2") or []
    note_events = anno.get("note_events_L1") or []
    midi_path = Path(anno.get("source_midi") or "sample.mid")
    samples = build_l1_samples_from_anno(anno, midi_path) if anno else []
    tokens = list(samples[0].get("tokens") or []) if samples else []
    bar_count = int(gl.get("total_bars") or 0) or max((int(p.get("end_bar") or 0) for p in phrases), default=0)
    rhythm_profile = [x for x in [f"BPM {gl['bpm']}" if gl.get("bpm") else None, f"TS {gl['time_signature']}" if gl.get("time_signature") else None] if x]
    return {
        "verification_tier": "verified",
        "sample": _sample_meta(),
        "structure_analysis": {
            "bars": bar_count, "phrases": len(phrases),
            "cadences": sum(1 for p in phrases if (p.get("cadence_type") or "").strip()),
            "token_count": len(tokens), "note_events": len(note_events),
            "layer": "L1-L4", "style": gl.get("style_global"), "key": gl.get("global_key"),
            "sections": gl.get("full_section_sequence") or [],
        },
        "rhythm_profile": rhythm_profile,
        "token_preview": tokens[:48],
        "token_map_example": _token_map_example(tokens[:12]),
        "capability_tags": ["music.structure.bar_count", "music.structure.phrase_count"],
    }


def _token_map_example(tokens: list[str]) -> list[dict]:
    out = []
    for t in tokens:
        exis = t
        if t.startswith("NOTE_ON_"):
            exis = f"N{t.split('_')[-1]}"
        elif t.startswith("DURBIN_"):
            exis = f"D{t.split('_')[-1]}"
        elif t.startswith("VELBIN_"):
            exis = f"V{t.split('_')[-1]}"
        out.append({"raw": t, "exis": exis})
    return out


def _get_stage1_model():
    if "model" in _model_cache:
        return _model_cache["model"], _model_cache["vocab_size"]
    import torch
    from musician_runtime.midi_training.fm_model import Stage1CLM
    from musician_runtime.midi_training.layered.layered_torch_dataset import layered_vocab_size, _encode_tokens
    ckpt = torch.load(_resolve(_cfg["checkpoint"]), map_location="cpu", weights_only=False)
    vocab_size = int(ckpt.get("vocab_size") or layered_vocab_size())
    model = Stage1CLM(vocab_size=vocab_size, max_seq_len=512).to("cpu")
    model.load_state_dict(ckpt.get("model_state") or ckpt, strict=False)
    model.eval()
    _model_cache.update({"model": model, "vocab_size": vocab_size, "encode": _encode_tokens})
    return model, vocab_size


def _m2_presets() -> list[dict]:
    anno = _load_default_anno()
    sample_tokens: list[str] = []
    try:
        from musician_runtime.midi_training.layered.layered_slice_encoder import build_l1_samples_from_anno
        samples = build_l1_samples_from_anno(anno, Path(anno.get("source_midi") or "x.mid"))
        sample_tokens = list(samples[0].get("tokens") or [])[:20]
    except Exception:
        pass
    out = []
    for p in _live_catalog().get("m2_presets") or []:
        item = dict(p)
        if item.get("preset_key") == "C" and sample_tokens:
            item["tokens"] = sample_tokens
        item["label_zh"] = item.get("label_zh") or item.get("demo_id")
        item["hint_zh"] = "L1 token 序列 · 点击加载后运行语言模型"
        out.append(item)
    return out


def _preset_by_key(key: str | None) -> dict:
    presets = _m2_presets()
    if key:
        for p in presets:
            if p.get("preset_key") == key or p.get("demo_id") == key:
                return p
    return presets[0] if presets else {}


def _m2_autoregressive(token_labels: list[str], steps: int = 80) -> list[str]:
    import torch
    from musician_runtime.midi_training.layered.layered_torch_dataset import _build_vocab_index
    from musician_runtime.midi_training.midi_tokenizer_v01 import load_vocab
    model, _ = _get_stage1_model()
    encode = _model_cache["encode"]
    inv_vocab = {v: k for k, v in _build_vocab_index(load_vocab()).items()}
    ids = list(encode(token_labels, 512))
    out_tokens = list(token_labels)
    for _ in range(steps):
        if not ids:
            break
        x = torch.tensor([ids[-511:]], dtype=torch.long)
        with torch.no_grad():
            idx = int(torch.argmax(model(x)[0, -1]).item())
        if idx == 0:
            break
        out_tokens.append(inv_vocab.get(idx, f"ID_{idx}"))
        ids.append(idx)
    return out_tokens


def _m2_predict(token_labels: list[str]) -> dict:
    import torch
    from musician_runtime.midi_training.layered.layered_torch_dataset import _build_vocab_index
    from musician_runtime.midi_training.midi_tokenizer_v01 import load_vocab
    model, _ = _get_stage1_model()
    inv_vocab = {v: k for k, v in _build_vocab_index(load_vocab()).items()}
    ids = _model_cache["encode"](token_labels, 512)
    if len(ids) < 2:
        return {"error": "token_sequence_too_short"}
    x = torch.tensor([ids[:-1]], dtype=torch.long)
    with torch.no_grad():
        topk = torch.topk(torch.softmax(model(x)[0, -1], dim=-1), k=12)
    predictions = []
    for prob, idx in zip(topk.values.tolist(), topk.indices.tolist()):
        if int(idx) == 0:
            continue
        predictions.append({"token": inv_vocab.get(int(idx), f"ID_{idx}"), "probability": round(float(prob), 4)})
        if len(predictions) >= 8:
            break
    return {"verification_tier": "verified", "demo_id": "demo2", "input_tokens": token_labels, "predictions": predictions}


def _m2_audio_for_preset(preset: dict) -> dict:
    pack = _pack()
    idx = int(preset.get("listen_pair_index") or 0)
    ref = ref_wav_at(pack, idx)
    if not ref.is_file():
        return {}
    seed = preset.get("seed_sec") or [0, 12]
    cont = preset.get("continuation_sec") or [12, 32]
    tag = preset.get("demo_id", "demo2")
    seed_wav = _segment(ref, f"{tag}_seed", float(seed[0]), float(seed[1]), idx)
    cont_wav = _segment(ref, f"{tag}_cont", float(cont[0]), float(cont[1]), idx)
    return {
        "demo_id": preset.get("demo_id"),
        "seed": _public_audio(preset.get("demo_id", "demo2"), f"{preset.get('demo_id')} · 输入", seed_wav,
                              duration_hint=f"{seed[1]-seed[0]:.0f}s"),
        "continuation": _public_audio(preset.get("demo_id", "demo2"), f"{preset.get('demo_id')} · 续写", cont_wav,
                                      duration_hint=f"{cont[1]-cont[0]:.0f}s"),
    }


@app.get("/")
def index():
    return send_from_directory(DEMO_ROOT, "index.html")


@app.get("/api/access/policy")
def access_policy():
    return jsonify(_access)


@app.post("/api/access/verify")
def access_verify():
    from datetime import datetime, timezone
    body = request.get_json(silent=True) or {}
    if not body.get("nda_accepted") or not (body.get("name") or "").strip() or not (body.get("email") or "").strip():
        return jsonify({"error": "nda_name_email_required"}), 400
    record = {"at_utc": datetime.now(timezone.utc).isoformat(), **{k: body.get(k) for k in ("name", "email", "organization", "mode")}}
    ACCESS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with ACCESS_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
    hours = int((_access.get("access") or {}).get("session_hours") or 24)
    return jsonify({"ok": True, "copyright": "winboy.ai", "expires_at": int(datetime.now(timezone.utc).timestamp() * 1000) + hours * 3600000})


@app.get("/api/integration")
def integration():
    civ = json.loads(json.dumps(_civ_public), strict=False)
    civ["demo_position_zh"] = "EXIS AI 旗下 · 音乐工业化生产工具 + 音乐综合智能体"
    civ["product_definition"] = _civ_public.get("products", {}).get("exis_ai_music", {})
    return jsonify(civ)


@app.get("/api/meta")
def meta():
    pub = _access.get("public_copy") or {}
    return jsonify({"title": pub.get("product_title"), "subtitle": pub.get("product_subtitle"),
                    "parent": pub.get("parent", "EXIS AI"), "tagline_zh": pub.get("tagline_zh"), "copyright": "winboy.ai",
                    "audio_catalog": _catalog_ver(), "demo_build": DEMO_BUILD})


@app.get("/api/audio/serve/<key>")
def audio_serve(key: str):
    key = key.split("?", 1)[0]
    path = _audio_keys.get(key)
    if not path or not path.is_file():
        return jsonify({"error": "not_found"}), 404
    return send_file(path, mimetype="audio/wav", conditional=True)


@app.get("/api/m1/analyze")
def m1_analyze():
    return jsonify(_m1_from_anno(_load_default_anno()))


@app.get("/api/m1/audio")
def m1_audio():
    catalog = _live_catalog()
    m1 = catalog.get("m1") or {}
    pack = _pack()
    pair_idx = int(m1.get("listen_pair_index") or 0)
    ref = ref_wav_at(pack, pair_idx)
    if not ref.is_file():
        return jsonify({"error": "demo_audio_unavailable"}), 404
    seg = m1.get("segment_sec") or [0, 48]
    wav = _segment(ref, "demo1", float(seg[0]), float(seg[1]), pair_idx)
    return jsonify(_public_audio("demo1", m1.get("label") or "24 bars · Acoustic Grand Piano", wav))


@app.get("/api/m2/presets")
def m2_presets():
    return jsonify({"presets": _m2_presets(), "input_help_zh": "选择 demo2-A / B / C · 展示 Music Language Model token 与音乐片段"})


@app.post("/api/m2/predict-audio")
def m2_predict_audio():
    body = request.get_json(silent=True) or {}
    preset = _preset_by_key(body.get("preset") or body.get("preset_key"))
    tokens = body.get("tokens") or preset.get("tokens") or _m2_presets()[0].get("tokens", [])
    predict = _m2_predict(tokens)
    predict["continued_tokens"] = _m2_autoregressive(tokens, steps=80)[len(tokens):][:32]
    audio = _m2_audio_for_preset(preset)
    predict["audio"] = {
        "seed_url": audio.get("seed", {}).get("audio_url"),
        "continuation_url": audio.get("continuation", {}).get("audio_url"),
        "seed_label": audio.get("seed", {}).get("label"),
        "continuation_label": audio.get("continuation", {}).get("label"),
        "demo_id": preset.get("demo_id"),
    }
    return jsonify(predict)


@app.get("/api/m3/audio")
def m3_audio():
    catalog = _live_catalog()
    m3 = catalog.get("m3") or {}
    pack = _pack()
    in_pi = int(m3.get("input_pair_index") or 0)
    out_pi = int(m3.get("output_pair_index") or 1)
    in_ref = ref_wav_at(pack, in_pi)
    out_ref = ref_wav_at(pack, out_pi)
    inp = m3.get("input_sec") or [0, 20]
    outp = m3.get("output_sec") or [0, 28]
    in_wav = _segment(in_ref, "demo3_in", float(inp[0]), float(inp[1]), in_pi)
    out_wav = _segment(out_ref, "demo3_out", float(outp[0]), float(outp[1]), out_pi)
    return jsonify({
        "demo_id": "demo3",
        "input": _public_audio("demo3", m3.get("input_label") or "demo3 · 输入", in_wav),
        "output": _public_audio("demo3", m3.get("output_label") or "demo3 · 输出", out_wav),
    })


@app.get("/api/m4/audio")
def m4_audio():
    demo_id = request.args.get("demo_id") or "demo4"
    catalog = _live_catalog()
    entry = None
    for d in (catalog.get("m4") or {}).get("demos") or []:
        if d.get("demo_id") == demo_id:
            entry = d
            break
    if not entry:
        entry = ((catalog.get("m4") or {}).get("demos") or [{}])[0]
    pack = _pack()
    pair_idx = int(entry.get("pair_index") or 0)
    ref = ref_wav_at(pack, pair_idx)
    inp = entry.get("input_sec") or [0, 18]
    outp = entry.get("output_sec") or [18, 38]
    did = entry.get("demo_id", "demo4")
    in_wav = _segment(ref, f"{did}_in", float(inp[0]), float(inp[1]), pair_idx)
    out_wav = _segment(ref, f"{did}_out", float(outp[0]), float(outp[1]), pair_idx)
    return jsonify({
        "demo_id": did,
        "input": _public_audio(did, f"{did} · 输入", in_wav),
        "output": _public_audio(did, f"{did} · 输出", out_wav),
    })


@app.get("/api/m4/demos")
def m4_demos():
  demos = [{"demo_id": d.get("demo_id")} for d in (_live_catalog().get("m4") or {}).get("demos") or []]
  return jsonify({"demos": demos})


def _print_audio_map() -> None:
    cat = _live_catalog()
    m1 = cat.get("m1") or {}
    m3 = cat.get("m3") or {}
    m2a = ((cat.get("m2_presets") or [{}])[0])
    print(f"Audio catalog: {_catalog_ver()}")
    print(f"  M1 demo1      → pair {m1.get('listen_pair_index')} {m1.get('segment_sec')}")
    print(f"  M2 {m2a.get('demo_id')} seed → pair {m2a.get('listen_pair_index')} {m2a.get('seed_sec')}")
    print(f"  M3 demo3 in   → pair {m3.get('input_pair_index')} {m3.get('input_sec')}")
    print(f"  M3 demo3 out  → pair {m3.get('output_pair_index')} {m3.get('output_sec')}")


if __name__ == "__main__":
    _purge_stale_audio_cache()
    _print_audio_map()
    print(f"Build: {DEMO_BUILD}")
    print("EXIS AI Music Demo — http://127.0.0.1:8765")
    app.run(host="127.0.0.1", port=8765, debug=False, use_reloader=False)
