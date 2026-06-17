#!/usr/bin/env python3
"""Demo audio — catalog segments from verified reference library (no engine labels)."""

from __future__ import annotations

import json
import wave
from pathlib import Path
from typing import Any

import mido

from musician_runtime.audio_render import fluidsynth_available
from musician_runtime.midi_in.sound_source_pool import render_with_pool


def load_listen_pack(pack_path: Path) -> dict[str, Any]:
    return json.loads(pack_path.read_text(encoding="utf-8"))


def ref_wav_at(pack: dict[str, Any], pair_index: int) -> Path:
    pairs = pack.get("pairs") or []
    if pair_index >= len(pairs):
        pair_index = pair_index % max(1, len(pairs))
    tracks = pairs[pair_index].get("tracks") or {}
    return Path(str(tracks.get("REF", "")))


def ref_midi_at(pack: dict[str, Any], pair_index: int) -> Path:
    pairs = pack.get("pairs") or []
    if pair_index >= len(pairs):
        pair_index = pair_index % max(1, len(pairs))
    return Path(str(pairs[pair_index].get("reference_midi", "")))


def trim_wav(src: Path, dst: Path, start_sec: float, end_sec: float) -> Path:
    """Extract [start_sec, end_sec) from wav using stdlib."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(src), "rb") as r:
        ch, sw, rate, _, _, _ = r.getparams()
        start_f = max(0, int(start_sec * rate))
        end_f = min(r.getnframes(), int(end_sec * rate))
        r.setpos(start_f)
        frames = r.readframes(end_f - start_f)
    with wave.open(str(dst), "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(sw)
        w.setframerate(rate)
        w.writeframes(frames)
    return dst


def ensure_segment(
    src_wav: Path,
    cache_dir: Path,
    tag: str,
    start_sec: float,
    end_sec: float,
    *,
    pair_index: int | None = None,
    catalog_ver: str = "v",
) -> Path:
    if end_sec <= start_sec:
        end_sec = start_sec + 10.0
    pair_tag = f"p{pair_index}_" if pair_index is not None else ""
    key = f"{tag}_{catalog_ver}_{pair_tag}{start_sec:.1f}_{end_sec:.1f}.wav"
    out = cache_dir / key
    if not out.is_file() or out.stat().st_size < 1000:
        trim_wav(src_wav, out, start_sec, end_sec)
    return out


def slice_midi_bars(midi_path: Path, start_bar: int, num_bars: int, out_path: Path) -> Path:
    """Slice MIDI by bar range with correct delta reconstruction."""
    mid = mido.MidiFile(str(midi_path))
    tpq = mid.ticks_per_beat or 480
    start_tick = (start_bar - 1) * 4 * tpq
    end_tick = start_tick + num_bars * 4 * tpq

    out = mido.MidiFile(type=mid.type, ticks_per_beat=tpq)
    for tr in mid.tracks:
        new_tr = mido.MidiTrack()
        abs_tick = 0
        last_out = 0
        for msg in tr:
            abs_tick += msg.time
            if abs_tick < start_tick:
                continue
            if abs_tick > end_tick and msg.type in ("note_on", "note_off", "control_change", "pitchwheel"):
                break
            delta = abs_tick - last_out
            last_out = abs_tick
            new_tr.append(msg.copy(time=delta))
        out.tracks.append(new_tr)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(str(out_path))
    return out_path


def render_midi_segment(midi_path: Path, wav_path: Path, *, start_bar: int = 1, num_bars: int = 24, gain: float = 0.9) -> Path:
    if not fluidsynth_available():
        raise FileNotFoundError("audio backend unavailable")
    staged = wav_path.with_suffix(f".b{start_bar}-{num_bars}.mid")
    slice_midi_bars(midi_path, start_bar, num_bars, staged)
    wav_path.parent.mkdir(parents=True, exist_ok=True)
    render_with_pool(staged, wav_path, gain=gain)
    return wav_path
