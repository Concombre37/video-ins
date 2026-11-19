#!/usr/bin/env python3
"""
Compose les musiques de fond fournies avec HytLabs Studio (public/music/*.mp3).

Tout est synthétisé ici (aucun échantillon externe) : les pistes sont donc libres
de droits. Chaque piste est une boucle de 8 mesures qui se répète proprement.

    python3 scripts/make-music.py          # nécessite numpy et ffmpeg
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "music")
rng = np.random.default_rng(7)


def note_hz(n):
    """Numéro MIDI -> fréquence."""
    return 440.0 * 2 ** ((n - 69) / 12)


def env(n, a=0.005, d=0.1, s=0.6, r=0.1, length=None):
    length = length or n
    t = np.arange(n) / SR
    e = np.ones(n) * s
    ai = int(a * SR)
    di = int(d * SR)
    ri = int(r * SR)
    e[:ai] = np.linspace(0, 1, max(ai, 1))[: len(e[:ai])]
    e[ai : ai + di] = np.linspace(1, s, max(di, 1))[: len(e[ai : ai + di])]
    if ri > 0 and ri < n:
        e[-ri:] *= np.linspace(1, 0, ri)
    return e


def osc(kind, freq, n, detune=0.0):
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * (1 + detune) * t
    if kind == "sine":
        return np.sin(ph)
    if kind == "saw":
        return 2 * ((freq * (1 + detune) * t) % 1) - 1
    if kind == "square":
        return np.sign(np.sin(ph))
    if kind == "tri":
        return 2 * np.abs(2 * ((freq * t) % 1) - 1) - 1
    raise ValueError(kind)


def lowpass_fast(x, cutoff):
    """Passe-bas approximatif (double moyenne glissante)."""
    k = max(1, int(SR / cutoff / 2))
    kernel = np.ones(k) / k
    return np.convolve(np.convolve(x, kernel, mode="same"), kernel, mode="same")


def kick(n=int(0.35 * SR), punch=1.0):
    t = np.arange(n) / SR
    f = 50 + 110 * np.exp(-t * 35)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 9) * punch


def snare(n=int(0.25 * SR)):
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    noise = noise - lowpass_fast(noise, 1500)
    return (noise * 0.7 + np.sin(2 * np.pi * 190 * t) * 0.4) * np.exp(-t * 18)


def clap(n=int(0.2 * SR)):
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    noise = noise - lowpass_fast(noise, 900)
    e = np.exp(-t * 25) + 0.5 * np.exp(-np.maximum(t - 0.012, 0) * 30) * (t > 0.012)
    return noise * e * 0.8


def hat(n=int(0.06 * SR), open_=False):
    if open_:
        n = int(0.22 * SR)
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    noise = noise - lowpass_fast(noise, 6000)
    return noise * np.exp(-t * (14 if open_ else 60)) * 0.5


def tom(freq, n=int(0.5 * SR)):
    t = np.arange(n) / SR
    f = freq * (1 + 0.6 * np.exp(-t * 20))
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 6)


def place(buf, sample, start, gain=1.0):
    s = int(start)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(sample))
    buf[s:e] += sample[: e - s] * gain


def chord_pad(notes, n, kind="saw", cutoff=1800, voices=3):
    out = np.zeros(n)
    for m in notes:
        for v in range(voices):
            det = (v - (voices - 1) / 2) * 0.006
            out += osc(kind, note_hz(m), n, det)
    out /= len(notes) * voices
    out = lowpass_fast(out, cutoff)
    return out * env(n, a=0.08, d=0.2, s=0.85, r=0.15)


def finish(mix, name, bpm, title):
    # boucle propre : léger fondu des 5 ms aux bords, normalisation douce
    mix = np.tanh(mix * 1.2)
    mix /= np.max(np.abs(mix)) + 1e-9
    mix *= 0.89
    stereo = np.stack([mix, mix], axis=1)
    # élargissement stéréo léger via un retard de 9 ms sur un canal
    d = int(0.009 * SR)
    stereo[d:, 1] = 0.85 * mix[:-d] + 0.15 * mix[d:]
    pcm = (stereo * 32767).astype(np.int16)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    with wave.open(tmp, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    out = os.path.join(OUT, f"{name}.mp3")
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y", "-i", tmp,
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
            "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "160k",
            "-metadata", f"title=HytLabs Studio - {title}",
            "-metadata", "artist=HytLabs Studio (synthèse, libre de droits)",
            out,
        ],
        check=True,
    )
    os.unlink(tmp)
    print(f"{out}  ({len(mix) / SR:.1f} s, {bpm} BPM)")


def track_energique():
    bpm = 128
    beat = 60 / bpm * SR
    bars = 8
    n = int(beat * 4 * bars)
    mix = np.zeros(n)
    prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
    roots = [45, 41, 36, 43]
    for bar in range(bars):
        b0 = bar * 4 * beat
        ch = prog[bar % 4]
        pad = chord_pad([m + 12 for m in ch], int(4 * beat), "saw", 2200)
        # sidechain : le pad "respire" avec le kick
        sc = np.ones(len(pad))
        for k in range(4):
            s = int(k * beat)
            l = int(0.25 * beat * 4 / 4)
            sc[s : s + l] = np.linspace(0.25, 1, l)[: len(sc[s : s + l])]
        place(mix, pad * sc, b0, 0.35)
        for k in range(4):
            place(mix, kick(), b0 + k * beat, 0.9)
            place(mix, hat(open_=True), b0 + k * beat + beat / 2, 0.35)
            if k in (1, 3):
                place(mix, clap(), b0 + k * beat, 0.5)
        for s16 in range(16):
            place(mix, hat(), b0 + s16 * beat / 4, 0.18 if s16 % 2 else 0.1)
            # basse en croches décalées
            if s16 % 2 == 1:
                bl = int(beat / 4)
                bass = osc("saw", note_hz(roots[bar % 4]), bl) * env(bl, a=0.003, d=0.05, s=0.7, r=0.03)
                place(mix, lowpass_fast(bass, 700), b0 + s16 * beat / 4, 0.55)
        # petite mélodie pluck sur les 4 dernières mesures
        if bar >= 4:
            mel = [ch[2] + 12, ch[1] + 12, ch[0] + 24, ch[2] + 12]
            for i, m in enumerate(mel):
                pl = int(beat * 0.9)
                p = osc("square", note_hz(m), pl) * env(pl, a=0.002, d=0.15, s=0.0, r=0.05)
                place(mix, lowpass_fast(p, 3000), b0 + i * beat + beat / 2, 0.16)
    finish(mix, "energique", bpm, "Énergique")


def track_gaming():
    bpm = 140
    beat = 60 / bpm * SR
    bars = 8
    n = int(beat * 4 * bars)
    mix = np.zeros(n)
    prog = [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]]  # Dm Bb C A
    for bar in range(bars):
        b0 = bar * 4 * beat
        ch = prog[bar % 4]
        # arpège chiptune en doubles croches
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24]
        for s16 in range(16):
            l = int(beat / 4)
            m = arp[s16 % 4]
            sq = osc("square", note_hz(m), l) * env(l, a=0.002, d=0.04, s=0.4, r=0.02)
            place(mix, lowpass_fast(sq, 4000), b0 + s16 * beat / 4, 0.14)
            place(mix, hat(), b0 + s16 * beat / 4, 0.12 if s16 % 4 == 2 else 0.06)
        # basse triangle
        for k in range(8):
            l = int(beat / 2)
            tri = osc("tri", note_hz(ch[0] - 12), l) * env(l, a=0.002, d=0.1, s=0.6, r=0.04)
            place(mix, tri, b0 + k * beat / 2, 0.5)
        for k in range(4):
            place(mix, kick(punch=0.9), b0 + k * beat, 0.85)
            if k in (1, 3):
                place(mix, snare(), b0 + k * beat, 0.45)
        place(mix, chord_pad(ch, int(4 * beat), "saw", 1200), b0, 0.18)
    finish(mix, "gaming", bpm, "Gaming")


def track_epique():
    bpm = 100
    beat = 60 / bpm * SR
    bars = 8
    n = int(beat * 4 * bars)
    mix = np.zeros(n)
    prog = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 56]]  # Am F G E
    for bar in range(bars):
        b0 = bar * 4 * beat
        ch = prog[bar % 4]
        intensity = 0.6 + 0.4 * (bar / (bars - 1))
        place(mix, chord_pad(ch, int(4 * beat), "saw", 1400 + 1200 * intensity, voices=4), b0, 0.42)
        # cordes graves en noires
        for k in range(4):
            l = int(beat)
            low = osc("saw", note_hz(ch[0] - 12), l) * env(l, a=0.02, d=0.2, s=0.5, r=0.1)
            place(mix, lowpass_fast(low, 500), b0 + k * beat, 0.4)
        # percussions type taiko
        place(mix, tom(70), b0, 0.9)
        place(mix, tom(70), b0 + 1.5 * beat, 0.6)
        place(mix, tom(95), b0 + 2 * beat, 0.7)
        if bar % 2 == 1:
            for k in range(4):
                place(mix, tom(120), b0 + 3 * beat + k * beat / 4, 0.35 + 0.1 * k)
        place(mix, kick(punch=1.0), b0, 0.6)
        place(mix, kick(punch=0.8), b0 + 2 * beat, 0.5)
    # coup final "boom" au début de la boucle
    place(mix, tom(55, int(1.2 * SR)), 0, 0.7)
    finish(mix, "epique", bpm, "Épique")


def track_chill():
    bpm = 90
    beat = 60 / bpm * SR
    bars = 8
    n = int(beat * 4 * bars)
    mix = np.zeros(n)
    prog = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 66], [52, 55, 59, 62]]  # Am7 Fmaj7 G(add) Em7
    for bar in range(bars):
        b0 = bar * 4 * beat
        ch = prog[bar % 4]
        place(mix, chord_pad(ch, int(4 * beat), "tri", 1500, voices=2), b0, 0.4)
        # piano électrique : accords plaqués légèrement décalés
        for k, off in enumerate([0, 1.5, 2.5]):
            for j, m in enumerate(ch):
                l = int(beat * 1.2)
                ep = (osc("sine", note_hz(m), l) + 0.3 * osc("sine", note_hz(m) * 2, l)) * env(
                    l, a=0.004, d=0.4, s=0.2, r=0.2
                )
                place(mix, ep, b0 + off * beat + j * 0.012 * SR, 0.09)
        # batterie douce, swing
        place(mix, kick(punch=0.7), b0, 0.6)
        place(mix, kick(punch=0.6), b0 + 2.5 * beat, 0.45)
        place(mix, snare(), b0 + beat, 0.25)
        place(mix, snare(), b0 + 3 * beat, 0.25)
        for k in range(8):
            swing = 0.08 * beat if k % 2 else 0
            place(mix, hat(), b0 + k * beat / 2 + swing, 0.08)
        bl = int(beat * 2)
        bass = osc("sine", note_hz(ch[0] - 24), bl) * env(bl, a=0.01, d=0.3, s=0.6, r=0.2)
        place(mix, bass, b0, 0.45)
        place(mix, bass, b0 + 2 * beat, 0.35)
    # souffle "vinyle" léger
    vinyl = rng.uniform(-1, 1, n)
    vinyl = lowpass_fast(vinyl, 3000) * 0.02
    mix += vinyl
    finish(mix, "chill", bpm, "Chill")


if __name__ == "__main__":
    which = sys.argv[1:] or ["energique", "gaming", "epique", "chill"]
    for name in which:
        globals()[f"track_{name}"]()
