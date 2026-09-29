"""Original synthesized foley for the 1970s Mystery Box arsenal.

python3 tools/weapon-1970s/make_sounds.py

Every sound is built from first principles in numpy/scipy (no recordings, no
commercial samples): muzzle blast + supersonic N-wave crack + filtered body +
low thump for reports; modal synthesis (sums of damped partials excited by short
noise transients) for steel, brass, wood and Bakelite parts; friction noise for
slides; stick-slip pulse trains for wood creak; and a short warm casino room
(early reflections + 0.6-1.0 s diffuse tail). Output: 44.1 kHz mono 16-bit WAV in
public/audio/weapons/<id>/<action>.wav, plus notes.json with the recipe of each file.
"""
from pathlib import Path
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/audio/weapons"
SR = 44100
NOTES = {}


# ----------------------------------------------------------------------------- primitives
def n_(d):
    return int(round(d * SR))


def t_(d):
    return np.arange(n_(d)) / SR


class Rand:
    def __init__(self, seed):
        self.r = np.random.default_rng(seed)

    def noise(self, d):
        return self.r.standard_normal(n_(d))

    def u(self, a, b):
        return float(self.r.uniform(a, b))


def sos(kind, f, order=2):
    f = np.clip(np.atleast_1d(f), 20, SR / 2 - 200)
    if kind == "band":
        return signal.butter(order, f, btype="bandpass", fs=SR, output="sos")
    return signal.butter(order, f[0], btype=kind, fs=SR, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def env(d, attack, tau, hold=0.0):
    t = t_(d)
    a = np.clip(t / max(attack, 1e-5), 0, 1)
    dec = np.exp(-np.maximum(0, t - attack - hold) / tau)
    return a * dec


def place(buf, x, at, gain=1.0):
    i = n_(at)
    if i >= len(buf):
        return buf
    j = min(len(buf), i + len(x))
    buf[i:j] += x[: j - i] * gain
    return buf


def canvas(d):
    return np.zeros(n_(d))


def norm(x, peak=0.95):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def sat(x, drive):
    return np.tanh(x * drive) / np.tanh(drive)


# ----------------------------------------------------------------------------- material models
def modal(freqs, decays, amps, d, rnd, exc=0.0006, bright=1.0):
    """Sum of damped partials excited by a short noise transient (struck object)."""
    t = t_(d)
    y = np.zeros_like(t)
    for f, tau, a in zip(freqs, decays, amps):
        f = f * rnd.u(0.97, 1.03)
        y += a * np.exp(-t / tau) * np.sin(2 * np.pi * f * t + rnd.u(0, 6.28))
    tr = rnd.noise(exc) * env(exc, 0.00005, exc / 3)
    tr = filt(tr, "high", 1500 * bright)
    y[: len(tr)] += tr * 0.6
    return y


def unitpk(x):
    m = np.max(np.abs(x))
    return x / m if m > 0 else x


def steel_click(rnd, size=1.0, d=0.08, level=1.0):
    """Small spring-steel part: trigger, sear, latch, safety."""
    base = np.array([2300, 3700, 5200, 7600, 9800]) / size
    return level * unitpk(modal(base, [0.014, 0.011, 0.009, 0.006, 0.004], [0.5, 0.8, 0.6, 0.35, 0.2], d, rnd, exc=0.0005))


def steel_clack(rnd, size=1.0, d=0.18, level=1.0, ring=1.0):
    """Larger steel parts slamming: bolts, cranes, breeches, covers."""
    base = np.array([620, 1150, 1780, 2600, 3900, 5600]) / size
    y = modal(base, np.array([0.035, 0.03, 0.022, 0.016, 0.01, 0.007]) * ring, [0.7, 0.9, 0.7, 0.5, 0.35, 0.2], d, rnd, exc=0.0012, bright=0.6)
    thud = filt(rnd.noise(0.03), "low", 900) * env(0.03, 0.0003, 0.006)
    return level * unitpk(y + place(np.zeros_like(y), thud, 0, 1.2))


def brass_ring(rnd, size=1.0, d=0.35, level=1.0, damp=1.0):
    """Cartridge brass: a thin tube with long, bright, inharmonic ring."""
    base = np.array([3300, 5500, 7900, 10400, 12800]) / size
    return level * unitpk(modal(base, np.array([0.16, 0.12, 0.09, 0.06, 0.04]) / damp, [0.6, 0.9, 0.6, 0.35, 0.2], d, rnd, exc=0.0003))


def wood_knock(rnd, size=1.0, d=0.12, level=1.0):
    base = np.array([190, 360, 610, 980, 1450]) / size
    y = modal(base, [0.03, 0.022, 0.015, 0.01, 0.007], [0.8, 0.7, 0.5, 0.35, 0.2], d, rnd, exc=0.002, bright=0.25)
    return level * unitpk(y)


def wood_resonance(rnd, d=0.5, level=1.0, size=1.0):
    base = np.array([150, 270, 440, 690]) / size
    return level * unitpk(modal(base, [0.28, 0.2, 0.13, 0.08], [0.8, 0.6, 0.4, 0.25], d, rnd, exc=0.003, bright=0.2))


def bakelite_tap(rnd, d=0.06, level=1.0):
    return level * unitpk(modal([900, 1600, 2500, 3600], [0.012, 0.009, 0.006, 0.004], [0.8, 0.6, 0.4, 0.2], d, rnd, exc=0.001, bright=0.4))


def plastic_knock(rnd, d=0.08, level=1.0):
    return level * unitpk(modal([520, 980, 1750, 2900], [0.018, 0.012, 0.008, 0.005], [0.8, 0.6, 0.35, 0.2], d, rnd, exc=0.0015, bright=0.35))


def slide(rnd, d, lo=1800, hi=6500, level=1.0, grain=90, shape=(0.15, 0.6)):
    """Metal-on-metal friction: band-limited noise with stick-slip grain."""
    x = filt(rnd.noise(d), "band", [lo, hi], 2)
    g = np.abs(filt(rnd.noise(d), "low", grain)) * 3 + 0.4
    t = t_(d)
    e = np.clip(t / (d * shape[0]), 0, 1) * np.clip((d - t) / (d * (1 - shape[1])), 0, 1)
    return level * x * g * e


def spring(rnd, d=0.12, f0=900, f1=600, level=1.0):
    t = t_(d)
    f = f0 + (f1 - f0) * t / d
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * (1 + 0.5 * np.sin(2 * np.pi * 38 * t)) * np.exp(-t / (d / 3))
    return level * 0.5 * y


def creak(rnd, d=0.25, f0=520, rate=55, level=1.0):
    """Wood stick-slip: a jittered pulse train through a resonant body."""
    y = np.zeros(n_(d))
    tt = 0.0
    while tt < d:
        i = n_(tt)
        if i < len(y):
            y[i] += rnd.u(0.4, 1.0)
        tt += 1 / (rate * rnd.u(0.7, 1.4))
    y = filt(y, "band", [f0 * 0.6, f0 * 1.8], 2)
    y = y + 0.5 * filt(y, "band", [f0 * 1.9, f0 * 2.6], 2)
    t = t_(d)
    return level * y * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7 * 3


def whoosh(rnd, d, f0, f1, f2, level=1.0, q=0.9):
    """Air past a moving object: noise through a band that sweeps with speed."""
    x = rnd.noise(d)
    t = t_(d)
    u = t / d
    fc = np.where(u < 0.55, f0 + (f1 - f0) * (u / 0.55), f1 + (f2 - f1) * ((u - 0.55) / 0.45))
    # time-varying bandpass via short frames
    y = np.zeros_like(x)
    hop = 256
    for i in range(0, len(x), hop):
        c = fc[min(i, len(fc) - 1)]
        s = sos("band", [c / (1 + q), c * (1 + q)], 2)
        seg = x[max(0, i - 1024): i + hop]
        y[i: i + hop] = signal.sosfilt(s, seg)[-min(hop, len(x) - i):]
    e = np.sin(np.pi * np.clip(u, 0, 1)) ** 2 * (0.3 + 0.7 * u) ** 0.5
    return level * y * e


# ----------------------------------------------------------------------------- reports
def report(rnd, d, crack=0.0, crack_ms=0.3, blast=1.0, blast_tau=0.004, bright=0.7, bright_tau=0.014, bright_lp=6500,
           dark=0.5, dark_tau=0.08, dark_lp=850, thump=0.6, thump_f=(100, 48), thump_tau=0.07, drive=2.2):
    """Gunshot: each layer is peak-normalised, then mixed so the muzzle transient dominates
    (the body sits ~10 dB below by 30 ms, as in close indoor recordings)."""
    def unit(x):
        m = np.max(np.abs(x))
        return x / m if m > 0 else x
    y = canvas(d)
    t = t_(d)
    if crack:
        # Supersonic N-wave: sharp rise, linear fall through zero, sharp return.
        L = n_(crack_ms / 1000)
        nw = np.concatenate([np.linspace(1, -1, L), [0]])
        nw = filt(np.pad(nw, (4, 200)), "high", 900, 1)
        place(y, unit(nw) * crack, 0)
    b = filt(rnd.noise(0.05), "low", 11000) * env(0.05, 0.0001, blast_tau)
    place(y, unit(b) * blast, 0.0002)
    br = unit(filt(rnd.noise(d), "low", bright_lp) * env(d, 0.0004, bright_tau))
    dk = unit(filt(rnd.noise(d), "low", dark_lp, 2) * env(d, 0.0015, dark_tau))
    f = thump_f[1] + (thump_f[0] - thump_f[1]) * np.exp(-t / (thump_tau * 0.6))
    th = unit(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(d, 0.0015, thump_tau))
    y += 0.42 * bright * br + 0.36 * dark * dk + 0.46 * thump * th
    drive = 1.0 + (drive - 1.0) * 0.45
    return sat(y, drive)


def room(x, wet=0.2, rt=0.7, seed=5, warm=3800):
    """Casino room: carpet + velvet absorb highs; plaster and glass give early slaps.
    The diffuse tail is energy-normalised so the direct transient always dominates."""
    rnd = Rand(seed)
    L = n_(rt * 1.2)
    early = np.zeros(L)
    for dl, g in ((0.0071, 0.3), (0.0113, 0.24), (0.0167, 0.19), (0.0229, 0.15), (0.0311, 0.11), (0.0397, 0.08)):
        early[n_(dl)] += g * rnd.u(0.8, 1.1) * (1 if rnd.u(0, 1) > 0.3 else -1)
    tt = t_(rt * 1.2)
    tail = rnd.noise(rt * 1.2) * np.exp(-tt * 6.9 / rt)
    tail *= np.clip((tt - 0.012) / 0.02, 0, 1)
    tail = filt(tail, "low", warm)
    tail /= np.sqrt(np.sum(tail ** 2))
    early = filt(early, "low", warm * 1.6)
    wet_sig = signal.fftconvolve(x, early + tail * 0.8)
    dry = np.pad(x, (0, len(wet_sig) - len(x)))
    return dry + wet * 2.2 * wet_sig


def finish(x, peak=0.95, fade=0.03, floor_db=-62):
    x = np.asarray(x, dtype=np.float64)
    x = x - np.mean(x[: min(len(x), 64)]) * 0
    x = filt(x, "high", 28, 2)
    a = np.abs(x)
    thr = np.max(a) * 10 ** (floor_db / 20)
    idx = np.nonzero(a > thr)[0]
    end = min(len(x), (idx[-1] if len(idx) else len(x)) + n_(0.02))
    x = x[:end]
    f = min(n_(fade), len(x))
    x[-f:] *= np.linspace(1, 0, f) ** 2
    return norm(x, peak)


def write(wid, name, x, recipe, peak=0.95):
    x = finish(x, peak)
    d = OUT / wid
    d.mkdir(parents=True, exist_ok=True)
    wavfile.write(d / f"{name}.wav", SR, (np.clip(x, -1, 1) * 32767).astype(np.int16))
    NOTES.setdefault(wid, {})[name] = {"seconds": round(len(x) / SR, 3), "recipe": recipe}


def bounce_train(rnd, maker, first=0.0, n=3, gap=0.09, decay=0.5, level=1.0, d=0.8):
    y = canvas(d)
    at, g = first, level
    for _ in range(n):
        place(y, maker(rnd), at, g)
        at += gap
        gap *= 0.62
        g *= decay
    return y


# ============================================================================= weapons
def magnum():
    w = "magnum"
    r = Rand(101)
    y = canvas(1.6)
    place(y, steel_click(r, 0.9, level=0.18), 0)                      # double-action sear break
    rep = report(r, 1.2, crack=0.9, crack_ms=0.25, blast=1.2, blast_tau=0.0035, bright=0.8, bright_tau=0.012, dark=0.55,
                 dark_tau=0.07, thump=0.7, thump_f=(115, 55), thump_tau=0.07, drive=2.6)
    place(y, rep, 0.012)
    place(y, modal([3100, 4700, 6900, 9100], [0.14, 0.1, 0.08, 0.05], [1, 0.8, 0.5, 0.3], 0.4, r) * 0.05, 0.014)  # cylinder ring
    write(w, "fire", room(y, 0.24, 0.75), "DA click, magnum N-wave crack + blast, 115->55 Hz thump, cylinder ring, casino room")
    y = canvas(0.3)
    place(y, steel_click(r, 1.0, level=0.5), 0)
    place(y, steel_click(r, 0.8, level=0.9), 0.045)
    place(y, steel_click(r, 1.3, level=0.25), 0.05)
    write(w, "dry", room(y, 0.1, 0.4), "double-action pull: hand click, hammer drop, cylinder index tick", 0.7)
    y = canvas(0.45)
    place(y, steel_click(r, 1.1, level=0.6), 0)
    place(y, slide(r, 0.12, 2000, 7000, 0.35), 0.02)
    place(y, steel_clack(r, 1.6, 0.15, 0.55, ring=0.7), 0.14)
    write(w, "reload-start", room(y, 0.1, 0.4), "latch push, crane swing (steel friction), crane stop", 0.8)
    y = canvas(1.1)
    place(y, slide(r, 0.06, 2500, 8000, 0.5), 0.0)
    place(y, steel_click(r, 1.2, level=0.5), 0.06)
    for i, at in enumerate((0.1, 0.16, 0.2, 0.27, 0.33, 0.41)):     # six distinct brass impacts
        place(y, bounce_train(r, lambda rr: brass_ring(rr, rr.u(0.9, 1.15), 0.3, damp=1.3), 0, n=2 + i % 2, gap=0.06, decay=0.35, d=0.5), at, 0.55 + 0.1 * (i % 3))
    write(w, "eject", room(y, 0.12, 0.45), "ejector rod stroke, six separate brass cases (two bounces each)", 0.85)
    y = canvas(0.45)
    for i in range(6):
        place(y, brass_ring(r, 1.4, 0.08, 0.25, damp=3), 0.02 + i * 0.012)
        place(y, steel_click(r, 1.6, 0.03, 0.2), 0.025 + i * 0.012)
    place(y, steel_click(r, 1.1, level=0.6), 0.14)
    write(w, "reload-loop", room(y, 0.1, 0.4), "speedloader: six rounds slide home, release knob twist", 0.8)
    y = canvas(0.5)
    place(y, steel_clack(r, 0.9, 0.3, 1.0, ring=1.3), 0)
    place(y, steel_click(r, 1.0, level=0.5), 0.004)
    for i in range(4):
        place(y, steel_click(r, 1.3, 0.03, 0.18 * (1 - i * 0.2)), 0.05 + i * 0.03)
    write(w, "reload-end", room(y, 0.14, 0.5), "crane slams shut with a hard mechanical snap, cylinder spins down", 0.9)
    y = canvas(0.8)
    for i in range(12):
        place(y, steel_click(r, 1.3, 0.03, 0.35), 0.02 + i * 0.03 * (1 + i * 0.12))
    place(y, wood_knock(r, 0.8, level=0.4), 0.0)
    write(w, "pickup", room(y, 0.1, 0.4), "walnut grip knock, freewheeling cylinder ratchet", 0.75)


def tommy():
    w = "tommy"
    for v in range(3):
        r = Rand(200 + v)
        y = canvas(0.7)
        rep = report(r, 0.6, crack=0, blast=1.0, blast_tau=0.0042, bright=0.5, bright_tau=0.009, bright_lp=4500, dark=0.7,
                     dark_tau=0.055, dark_lp=650, thump=0.85, thump_f=(96 + v * 4, 50), thump_tau=0.055, drive=2.0)
        place(y, rep, 0)
        place(y, steel_clack(r, 1.25, 0.12, 0.42, ring=0.8), 0.021)          # heavy receiver clack
        for k in range(3):
            place(y, steel_click(r, 1.5, 0.02, 0.07), 0.03 + k * 0.011 + r.u(0, 0.004))  # drum rattle
        write(w, f"fire-{v + 1}", room(y, 0.18, 0.6, seed=7 + v), ".45 subsonic report, low body, heavy receiver clack, drum rattle")
    r = Rand(210)
    y = canvas(0.3); place(y, steel_clack(r, 1.3, 0.15, 0.7, 0.7), 0)
    write(w, "dry", room(y, 0.1, 0.4), "trigger on an empty open bolt: heavy clack", 0.7)
    y = canvas(0.6)
    place(y, steel_click(r, 1.0, level=0.6), 0)
    place(y, slide(r, 0.26, 900, 4500, 0.6, grain=60), 0.03)
    place(y, steel_clack(r, 1.1, 0.2, 0.4, 0.8), 0.3)
    write(w, "reload-start", room(y, 0.12, 0.45), "drum latch, 26 cm steel drum slides out of its guides", 0.85)
    y = canvas(0.5)
    place(y, modal([170, 310, 520, 880, 1400], [0.09, 0.07, 0.05, 0.035, 0.02], [1, 0.8, 0.6, 0.4, 0.2], 0.45, r) * 0.9, 0)
    place(y, steel_clack(r, 1.0, 0.2, 0.55, 0.9), 0.004)
    write(w, "reload-loop", room(y, 0.14, 0.5), "hollow steel drum thump: cavity modes 170/310/520 Hz + latch", 0.9)
    y = canvas(0.8)
    place(y, slide(r, 0.2, 1200, 5000, 0.55, grain=50), 0)
    place(y, steel_clack(r, 1.2, 0.15, 0.5, 0.7), 0.2)
    place(y, steel_clack(r, 0.9, 0.3, 1.0, 1.1), 0.34)
    write(w, "reload-end", room(y, 0.14, 0.5), "long heavy bolt pull, catch, released slam", 0.9)
    y = canvas(0.7)
    place(y, wood_knock(r, 0.9, level=0.6), 0)
    for k in range(6):
        place(y, steel_click(r, 1.2, 0.04, 0.3), 0.03 + k * 0.035)
    place(y, steel_clack(r, 1.1, 0.2, 0.4), 0.26)
    write(w, "pickup", room(y, 0.1, 0.4), "walnut knock, drum rattle, bolt settles", 0.8)


def doublebarrel():
    w = "doublebarrel"
    r = Rand(300)
    def boom(rr, big=1.0):
        return report(rr, 1.6, crack=0, blast=1.3 * big, blast_tau=0.005, bright=0.75, bright_tau=0.02, bright_lp=5500, dark=0.62,
                      dark_tau=0.075, dark_lp=700, thump=0.85, thump_f=(72, 36), thump_tau=0.075, drive=2.4 + big)
    y = canvas(1.9)
    place(y, steel_click(r, 0.7, level=0.12), 0)
    place(y, boom(r), 0.006)
    place(y, wood_resonance(r, 0.4, 0.06), 0.01)
    write(w, "fire", room(y, 0.26, 0.85), "12 ga side-by-side: hammer fall, broad blast, 72->36 Hz thump, walnut stock ring")
    y = canvas(2.0)
    place(y, boom(Rand(301), 1.2), 0.0)
    place(y, boom(Rand(302), 1.2), 0.007)
    place(y, wood_resonance(r, 0.5, 0.08), 0.01)
    write(w, "fire-alt", room(y, 0.3, 0.95), "both barrels 7 ms apart: louder, wider, same weapon character")
    y = canvas(0.35); place(y, steel_click(r, 0.7, level=0.8), 0); place(y, steel_clack(r, 1.6, 0.1, 0.3), 0.003)
    write(w, "dry", room(y, 0.1, 0.4), "exposed hammer falls on a spent primer", 0.7)
    y = canvas(0.7)
    place(y, steel_click(r, 0.9, level=0.7), 0)
    place(y, creak(r, 0.22, 480, 60, 0.55), 0.05)                    # wooden fore-end creak
    place(y, steel_clack(r, 1.3, 0.25, 0.7, 0.8), 0.24)
    place(y, wood_knock(r, 1.0, level=0.3), 0.245)
    write(w, "reload-start", room(y, 0.12, 0.45), "top lever click, wooden fore-end creak, barrels drop on the hinge", 0.85)
    y = canvas(0.7)
    place(y, spring(r, 0.05, 1600, 900, 0.5), 0)
    for i in range(2):
        place(y, plastic_knock(r, level=0.5), 0.18 + i * 0.07)
        place(y, brass_ring(r, 0.8, 0.2, 0.2, damp=2), 0.18 + i * 0.07)
    write(w, "eject", room(y, 0.12, 0.45), "ejector spring throws two paper/brass hulls; they tumble", 0.8)
    y = canvas(0.5)
    for i in range(2):
        place(y, slide(r, 0.08, 800, 3500, 0.35, grain=40), 0.0 + i * 0.18)
        place(y, brass_ring(r, 0.8, 0.12, 0.3, damp=3), 0.07 + i * 0.18)
        place(y, plastic_knock(r, level=0.35), 0.075 + i * 0.18)
    write(w, "reload-loop", room(y, 0.1, 0.4), "two shells slide into the chambers: paper hull scrape + brass seat", 0.8)
    y = canvas(0.6)
    place(y, steel_clack(r, 0.95, 0.35, 1.0, 1.2), 0)
    place(y, wood_resonance(r, 0.35, 0.3), 0.002)
    place(y, steel_click(r, 0.9, level=0.5), 0.02)
    write(w, "reload-end", room(y, 0.15, 0.55), "brass breech snaps shut, walnut resonance, top lever returns", 0.95)
    y = canvas(0.4)
    for i in range(2):
        place(y, steel_click(r, 0.85, level=0.7), i * 0.12)
        place(y, steel_click(r, 1.1, level=0.4), i * 0.12 + 0.018)
    write(w, "cock", room(y, 0.1, 0.4), "thumb cocks both hammers: two ratcheting clicks", 0.8)
    y = canvas(0.6)
    place(y, creak(r, 0.2, 520, 50, 0.4), 0); place(y, steel_clack(r, 1.4, 0.2, 0.5), 0.2)
    write(w, "pickup", room(y, 0.1, 0.4), "fore-end creak and action rattle", 0.75)


def dual():
    w = "dual"
    for side, base_f, lp, seed in (("right", 190, 7200, 400), ("left", 165, 6200, 410)):
        for v in range(2):
            r = Rand(seed + v)
            y = canvas(0.6)
            rep = report(r, 0.5, crack=0, blast=0.9, blast_tau=0.0022, bright=0.85, bright_tau=0.008, bright_lp=lp, dark=0.3,
                         dark_tau=0.03, dark_lp=1400, thump=0.35, thump_f=(base_f, 95), thump_tau=0.03, drive=2.2)
            place(y, rep, 0)
            place(y, steel_click(r, 1.1 if side == "right" else 0.95, 0.05, 0.3), 0.014)   # slide click
            place(y, steel_click(r, 1.3, 0.04, 0.15), 0.032)
            write(w, f"fire-{side}-{v + 1}", room(y, 0.2, 0.6, seed=11 + v), f"compact {'.25' if side == 'right' else '.32'} pocket pistol pop, own slide click")
    r = Rand(420)
    y = canvas(0.25); place(y, steel_click(r, 1.3, level=0.8), 0)
    write(w, "dry", room(y, 0.1, 0.4), "light pocket-pistol trigger click", 0.6)
    y = canvas(0.6)
    for i in range(2):
        place(y, steel_click(r, 1.2, level=0.6), i * 0.09)
        place(y, slide(r, 0.06, 2500, 7000, 0.3), i * 0.09 + 0.01)
        place(y, bakelite_tap(r, level=0.3), i * 0.09 + 0.2)
    write(w, "reload-start", room(y, 0.1, 0.4), "two magazine releases, magazines slide out and drop", 0.8)
    y = canvas(0.4)
    for i in range(2):
        place(y, steel_clack(r, 1.9, 0.08, 0.55, 0.6), i * 0.085)
        place(y, steel_click(r, 1.2, level=0.5), i * 0.085 + 0.004)
    write(w, "reload-loop", room(y, 0.1, 0.4), "two magazines seated as a pair, left then right", 0.8)
    y = canvas(0.45)
    for i in range(2):
        place(y, steel_clack(r, 1.7, 0.12, 0.8, 0.8), i * 0.07)
    write(w, "reload-end", room(y, 0.12, 0.45), "both slides released forward", 0.85)
    y = canvas(0.6)
    for i in range(2):
        place(y, slide(r, 0.07, 2000, 6500, 0.3), i * 0.2)
        place(y, steel_clack(r, 1.8, 0.1, 0.5), i * 0.2 + 0.07)
    write(w, "pickup", room(y, 0.1, 0.4), "both slides pressed back and let go", 0.75)


def machinepistol():
    w = "machinepistol"
    for v in range(3):
        r = Rand(500 + v)
        y = canvas(0.5)
        rep = report(r, 0.4, crack=0.4, crack_ms=0.18, blast=1.0, blast_tau=0.0026, bright=0.95, bright_tau=0.008, bright_lp=7500,
                     dark=0.3, dark_tau=0.03, dark_lp=1300, thump=0.4, thump_f=(150, 85), thump_tau=0.03, drive=2.3)
        place(y, rep, 0)
        for k, at in enumerate((0.007, 0.016, 0.026, 0.036)):              # prominent cyclic bolt rattle
            place(y, steel_click(r, 1.05 + 0.1 * k, 0.03, 0.34 - k * 0.06), at + r.u(0, 0.002))
        write(w, f"fire-{v + 1}", room(y, 0.16, 0.55, seed=21 + v), "thin forceful 9 mm report, fast stamped-bolt rattle carries the rate")
    r = Rand(510)
    y = canvas(0.25); place(y, steel_click(r, 1.0, level=0.8), 0)
    write(w, "dry", room(y, 0.1, 0.4), "sear click on an empty open bolt", 0.6)
    y = canvas(0.5)
    place(y, steel_click(r, 1.1, level=0.7), 0); place(y, slide(r, 0.1, 2000, 6000, 0.4), 0.02)
    place(y, steel_clack(r, 1.7, 0.1, 0.25), 0.3)
    write(w, "reload-start", room(y, 0.1, 0.4), "magazine catch, box magazine slides from the grip", 0.8)
    y = canvas(0.35); place(y, steel_clack(r, 1.6, 0.12, 1.0, 0.7), 0); place(y, steel_click(r, 0.9, level=0.7), 0.002)
    write(w, "reload-loop", room(y, 0.1, 0.4), "sharp magazine insertion click", 0.9)
    y = canvas(0.5)
    place(y, slide(r, 0.07, 1800, 6000, 0.45), 0); place(y, steel_clack(r, 1.3, 0.12, 0.5), 0.07); place(y, steel_clack(r, 1.1, 0.2, 0.9), 0.16)
    write(w, "reload-end", room(y, 0.12, 0.45), "top knob racked back and slammed forward", 0.9)
    y = canvas(0.5)
    for k in range(5):
        place(y, steel_click(r, 1.4, 0.04, 0.35), k * 0.045)
    place(y, bakelite_tap(r, level=0.5), 0.25)
    write(w, "pickup", room(y, 0.1, 0.4), "wire stock rattle, Bakelite grip tap", 0.75)


def lever():
    w = "lever"
    r = Rand(600)
    y = canvas(1.5)
    place(y, report(r, 1.3, crack=0.75, crack_ms=0.26, blast=1.0, blast_tau=0.0036, bright=0.8, bright_tau=0.014, dark=0.5,
                    dark_tau=0.08, thump=0.6, thump_f=(104, 50), thump_tau=0.08, drive=2.2), 0)
    place(y, wood_resonance(r, 0.6, 0.12), 0.004)
    write(w, "fire", room(y, 0.22, 0.75), "crisp .44-40 rifle crack, walnut stock resonance")
    y = canvas(0.35)
    place(y, steel_clack(r, 1.25, 0.16, 0.9, 0.9), 0)
    place(y, slide(r, 0.08, 1500, 5000, 0.35), 0.01)
    place(y, brass_ring(r, 0.9, 0.2, 0.15, damp=2), 0.06)
    write(w, "cycle", room(y, 0.12, 0.45), "lever thrown down: breech bolt clacks open, empty case kicks out", 0.9)
    y = canvas(0.45)
    place(y, slide(r, 0.06, 1500, 5000, 0.3), 0)
    place(y, steel_clack(r, 1.1, 0.2, 1.0, 1.0), 0.05)
    place(y, wood_resonance(r, 0.3, 0.3), 0.052)
    place(y, steel_click(r, 0.9, level=0.35), 0.07)
    write(w, "cycle-close", room(y, 0.12, 0.45), "lever closes: pronounced clack, wood-and-metal stock resonance, hammer set", 0.9)
    y = canvas(0.35); place(y, steel_click(r, 0.8, level=0.8), 0); place(y, wood_knock(r, 1.0, level=0.2), 0.002)
    write(w, "dry", room(y, 0.1, 0.4), "hammer falls on an empty chamber", 0.7)
    y = canvas(0.3)
    for i in range(3):
        place(y, brass_ring(r, 1.1, 0.12, 0.2, damp=2.5), i * 0.05)
    write(w, "reload-start", room(y, 0.1, 0.4), "cartridges gathered from a vest pocket", 0.6)
    y = canvas(0.4)
    place(y, brass_ring(r, 1.0, 0.1, 0.3, damp=2.5), 0)
    place(y, steel_click(r, 1.0, level=0.6), 0.02)                     # loading gate snaps
    place(y, spring(r, 0.14, 700, 380, 0.5), 0.03)                     # tubular magazine spring
    place(y, slide(r, 0.05, 1200, 4000, 0.25), 0.01)
    write(w, "reload-loop", room(y, 0.1, 0.4), "one cartridge thumbed through the gate: brass, gate snap, springy tube", 0.8)
    y = canvas(.3)
    place(y, steel_click(r, .9, level=.35), 0)
    place(y, wood_knock(r, 1.15, level=.3), .065)
    write(w, "reload-end", room(y, .08, .35), "loading gate settles and gloved hand returns to walnut wrist", .55)
    y = canvas(0.6)
    place(y, steel_clack(r, 1.25, 0.16, 0.7), 0); place(y, steel_clack(r, 1.1, 0.2, 0.8), 0.18); place(y, wood_resonance(r, 0.3, 0.2), 0.182)
    write(w, "pickup", room(y, 0.1, 0.4), "half-cock lever check", 0.8)


def autoshotgun():
    w = "autoshotgun"
    r = Rand(700)
    y = canvas(1.5)
    place(y, report(r, 1.3, crack=0, blast=1.2, blast_tau=0.0048, bright=0.75, bright_tau=0.018, bright_lp=6000, dark=0.55,
                    dark_tau=0.065, dark_lp=800, thump=0.75, thump_f=(78, 40), thump_tau=0.065, drive=2.4), 0)
    place(y, steel_clack(r, 1.35, 0.12, 0.28, 0.7), 0.034)           # bolt back
    place(y, plastic_knock(r, level=0.12), 0.05)                       # hull ejects
    place(y, steel_clack(r, 1.15, 0.16, 0.34, 0.8), 0.078)           # bolt home
    write(w, "fire", room(y, 0.24, 0.8), "broad 12 ga report with gas-operated bolt cycling layered underneath")
    y = canvas(0.3); place(y, steel_click(r, 0.9, level=0.8), 0)
    write(w, "dry", room(y, 0.1, 0.4), "firing pin on an empty chamber", 0.6)
    y = canvas(.35)
    place(y, plastic_knock(r, level=.35), 0)
    place(y, brass_ring(r, .8, .12, .2, damp=3), .07)
    write(w, "reload-start", room(y, .08, .35), "two loose shells gathered from a coat pocket", .55)
    y = canvas(0.4)
    place(y, plastic_knock(r, level=0.5), 0); place(y, brass_ring(r, 0.8, 0.1, 0.35, damp=3), 0.002)
    place(y, steel_click(r, 1.1, level=0.5), 0.04); place(y, spring(r, 0.08, 900, 600, 0.3), 0.045)
    write(w, "reload-loop", room(y, 0.1, 0.4), "shell pressed past the carrier: brass-and-plastic click, magazine spring", 0.8)
    y = canvas(0.5); place(y, steel_clack(r, 1.0, 0.3, 1.0, 1.1), 0); place(y, steel_click(r, 1.0, level=0.4), 0.01)
    write(w, "reload-end", room(y, 0.14, 0.5), "bolt release: distinct final bolt closure", 0.9)
    y = canvas(0.6)
    for i in range(3):
        place(y, plastic_knock(r, level=0.3), i * 0.05)
    place(y, steel_clack(r, 1.2, 0.2, 0.6), 0.2)
    write(w, "pickup", room(y, 0.1, 0.4), "shells rattle in the tube, bolt handle tap", 0.75)


def sniper():
    w = "sniper"
    r = Rand(800)
    y = canvas(2.0)
    place(y, report(r, 1.8, crack=0.8, crack_ms=0.34, blast=0.9, blast_tau=0.003, bright=0.65, bright_tau=0.012, dark=0.45,
                    dark_tau=0.09, thump=0.55, thump_f=(92, 44), thump_tau=0.09, drive=2.0), 0)
    place(y, wood_resonance(r, 1.0, 0.16, 1.1), 0.003)                # long wooden resonance
    write(w, "fire", room(y, 0.3, 1.0), "restrained high-velocity crack, long military-walnut resonance, room tail")
    y = canvas(0.45)
    place(y, steel_click(r, 0.9, level=0.6), 0); place(y, slide(r, 0.03, 2000, 6000, 0.3), 0.005)
    place(y, slide(r, 0.14, 1400, 5200, 0.5, grain=70), 0.07); place(y, steel_clack(r, 1.3, 0.12, 0.6, 0.8), 0.21)
    place(y, brass_ring(r, 0.85, 0.25, 0.25, damp=1.5), 0.22)
    write(w, "bolt-open", room(y, 0.12, 0.45), "dry bolt lift and throw: cam click, long draw, stop, case ejected", 0.85)
    y = canvas(0.4)
    place(y, slide(r, 0.12, 1400, 5200, 0.5, grain=70), 0); place(y, steel_clack(r, 1.2, 0.15, 0.7), 0.12)
    place(y, steel_click(r, 0.85, level=0.7), 0.17)
    write(w, "bolt-close", room(y, 0.12, 0.45), "bolt pushed home and turned down", 0.85)
    y = canvas(0.45)
    place(y, steel_click(r, 0.9, level=0.6), 0); place(y, slide(r, 0.14, 1400, 5200, 0.5, grain=70), 0.06)
    place(y, steel_clack(r, 1.3, 0.12, 0.6, 0.8), 0.2)
    write(w, "reload-start", room(y, 0.12, 0.45), "bolt opened for a stripper clip", 0.85)
    y = canvas(0.6)
    place(y, steel_click(r, 1.3, level=0.5), 0)
    for i in range(5):
        place(y, brass_ring(r, 1.0, 0.07, 0.22, damp=3), 0.05 + i * 0.04)
        place(y, slide(r, 0.04, 2000, 6000, 0.18), 0.05 + i * 0.04)
    place(y, steel_click(r, 1.5, level=0.4), 0.3); place(y, spring(r, 0.1, 1200, 700, 0.25), 0.3)
    write(w, "reload-loop", room(y, 0.1, 0.4), "five rounds stripped down into the magazine, clip flicked away", 0.85)
    y = canvas(0.45)
    place(y, slide(r, 0.12, 1400, 5200, 0.5, grain=70), 0); place(y, steel_clack(r, 1.2, 0.15, 0.7), 0.12)
    place(y, steel_click(r, 0.85, level=0.7), 0.18)
    write(w, "reload-end", room(y, 0.12, 0.45), "bolt closed and locked", 0.85)
    y = canvas(0.3); place(y, steel_click(r, 0.95, level=0.8), 0)
    write(w, "dry", room(y, 0.1, 0.4), "striker falls on an empty chamber", 0.6)
    y = canvas(0.7)
    place(y, wood_knock(r, 0.8, level=0.5), 0); place(y, steel_click(r, 1.0, level=0.3), 0.12); place(y, slide(r, 0.2, 400, 1800, 0.25, grain=30), 0.25)
    write(w, "pickup", room(y, 0.1, 0.4), "stock knock, scope cap tick, leather sling drag", 0.75)


def lmg():
    w = "lmg"
    for v in range(3):
        r = Rand(900 + v)
        y = canvas(0.9)
        place(y, report(r, 0.8, crack=0.55, crack_ms=0.3, blast=1.0, blast_tau=0.004, bright=0.55, bright_tau=0.011, bright_lp=5000,
                        dark=0.75, dark_tau=0.08, dark_lp=780, thump=0.95, thump_f=(82, 44), thump_tau=0.08, drive=2.1), 0)
        place(y, steel_click(r, 0.75, 0.06, 0.2), 0.028)                 # link feeds
        place(y, brass_ring(r, 0.9, 0.12, 0.08, damp=2), 0.034)
        place(y, steel_clack(r, 1.1, 0.12, 0.26, 0.7), 0.046)             # bolt carrier
        write(w, f"fire-{v + 1}", room(y, 0.22, 0.7, seed=31 + v), "deep 7.62 report with metallic feed rhythm (link, case, carrier)")
    r = Rand(910)
    y = canvas(0.6)
    for i in range(9):
        place(y, steel_click(r, 1.1 + 0.05 * (i % 3), 0.05, 0.4 * (1 - i / 11)), i * 0.028 + r.u(0, 0.006))
    place(y, steel_clack(r, 1.05, 0.2, 0.7), 0.26)
    write(w, "belt-end", room(y, 0.14, 0.5), "belt/feed clatter as the last links run out, bolt stops", 0.85)
    y = canvas(0.3); place(y, steel_clack(r, 1.1, 0.15, 0.8, 0.8), 0)
    write(w, "dry", room(y, 0.1, 0.4), "trigger on an empty feed", 0.7)
    y = canvas(0.5); place(y, steel_click(r, 0.9, level=0.6), 0); place(y, spring(r, 0.12, 700, 420, 0.4), 0.02); place(y, steel_clack(r, 1.2, 0.15, 0.5), 0.12)
    write(w, "reload-start", room(y, 0.12, 0.45), "feed cover latch, spring, cover stops open", 0.85)
    y = canvas(0.6); place(y, slide(r, 0.2, 800, 3500, 0.55, grain=50), 0); place(y, modal([160, 290, 470], [0.07, 0.05, 0.03], [1, 0.7, 0.4], 0.3, r) * 0.6, 0.22)
    write(w, "eject", room(y, 0.14, 0.5), "empty belt box slides off its bracket, hollow drop", 0.85)
    y = canvas(0.5); place(y, modal([150, 260, 430, 700], [0.09, 0.06, 0.04, 0.025], [1, 0.8, 0.5, 0.3], 0.4, r) * 0.9, 0); place(y, steel_clack(r, 1.1, 0.15, 0.6), 0.004)
    write(w, "reload-loop", room(y, 0.14, 0.5), "fresh box seated: hollow clunk and latch", 0.9)
    y = canvas(0.5); place(y, steel_clack(r, 0.9, 0.3, 1.0, 1.2), 0); place(y, steel_click(r, 1.0, level=0.5), 0.01)
    write(w, "cover", room(y, 0.15, 0.55), "feed cover slammed shut on the belt", 0.95)
    y = canvas(0.7)
    place(y, slide(r, 0.16, 1000, 4500, 0.6, grain=40), 0); place(y, steel_clack(r, 1.3, 0.12, 0.5), 0.16)
    place(y, steel_clack(r, 0.8, 0.4, 1.0, 1.4), 0.27)
    write(w, "reload-end", room(y, 0.16, 0.55), "charging handle racked, heavy bolt slam", 0.95)
    y = canvas(0.7)
    place(y, steel_clack(r, 1.0, 0.3, 0.7), 0); place(y, slide(r, 0.2, 500, 2000, 0.3, grain=30), 0.1)
    for i in range(4):
        place(y, steel_click(r, 1.2, 0.04, 0.25), 0.2 + i * 0.04)
    write(w, "pickup", room(y, 0.1, 0.4), "heavy set-down, bipod legs, belt links", 0.8)


def explosion():
    r = Rand(9041)
    y = canvas(3.4)
    t = t_(2.8)
    # Sharp pressure front, chest-weight body and uneven room rumble.
    crack = filt(r.noise(2.8), "band", [650, 7800]) * env(2.8, .0003, .028)
    body = np.sin(2*np.pi*np.cumsum(44+90*np.exp(-t/.045))/SR)*env(2.8,.001,.28)
    rumble = filt(r.noise(2.8), "low", 190)*env(2.8,.014,.65)*3.8
    tearing = filt(r.noise(2.8), "band", [180, 2400])*env(2.8,.002,.13)
    place(y, sat(crack*.85+body*1.4+rumble+tearing*.7, 1.7), 0)
    for i in range(18):
        place(y, (wood_knock if i%3 else steel_click)(r,r.u(.65,1.35),level=r.u(.018,.065)),r.u(.12,1.7))
    write("launcher", "explode", room(y,.32,1.55,warm=1800),
          "heavy pressure crack, 134-to-44 Hz body, irregular bass rumble, scattered debris and warm casino reflections")

def launcher():
    w = "launcher"
    r = Rand(1000)
    y = canvas(1.3)
    t = t_(1.0)
    f = 95 + 60 * np.exp(-t / 0.03)
    tube = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(1.0, 0.002, 0.09)
    puff = filt(r.noise(1.0), "band", [140, 700], 2) * env(1.0, 0.003, 0.05)
    air = filt(r.noise(1.0), "band", [1500, 5000], 2) * env(1.0, 0.002, 0.03) * 0.25
    place(y, sat(tube * 1.0 + puff * 1.4 + air, 1.8), 0)
    place(y, steel_clack(r, 0.8, 0.2, 0.25, 1.0), 0.004)
    write(w, "fire", room(y, 0.22, 0.8), "hollow low-frequency thump: 155->95 Hz tube resonance, air puff, breech shove")
    d = 1.6
    t = t_(d)
    hiss = filt(r.noise(d), "band", [2200, 7000], 2) * np.exp(-t / 0.6) * np.clip(t / 0.02, 0, 1)
    hiss += filt(r.noise(d), "band", [600, 1800], 2) * np.exp(-t / 0.5) * 0.4
    write(w, "flight", room(hiss, 0.1, 0.5), "brief projectile flight hiss receding", 0.55)
    explosion()
    y = canvas(0.3); place(y, steel_click(r, 0.8, level=0.8), 0); place(y, steel_clack(r, 1.3, 0.1, 0.3), 0.004)
    write(w, "dry", room(y, 0.1, 0.4), "heavy hammer on an empty chamber", 0.7)
    y = canvas(0.3); place(y, steel_click(r, 0.8, level=0.8), 0); place(y, steel_clack(r, 1.4, 0.1, 0.4), 0.05)
    write(w, "reload-start", room(y, 0.1, 0.4), "beat 1: latch thrown", 0.85)
    y = canvas(0.45); place(y, creak(r, 0.12, 300, 70, 0.4), 0); place(y, steel_clack(r, 0.8, 0.3, 0.9, 1.2), 0.12)
    write(w, "hinge", room(y, 0.12, 0.45), "beat 2: barrel swings down and stops on the hinge", 0.9)
    y = canvas(0.6)
    place(y, modal([880, 1480, 2250, 3300], [0.2, 0.15, 0.1, 0.06], [1, 0.8, 0.5, 0.3], 0.5, r) * 0.6, 0)
    place(y, wood_knock(r, 0.7, level=0.5), 0.3)
    write(w, "eject", room(y, 0.12, 0.45), "40 mm case extracted: hollow tonk, lands on the carpet", 0.85)
    y = canvas(0.5)
    place(y, slide(r, 0.14, 600, 2500, 0.45, grain=40), 0)
    place(y, modal([520, 900, 1500], [0.08, 0.06, 0.04], [1, 0.7, 0.4], 0.3, r) * 0.7, 0.14)
    write(w, "reload-loop", room(y, 0.12, 0.45), "beat 3: shell slid into the breech and seated", 0.85)
    y = canvas(0.5); place(y, steel_clack(r, 0.85, 0.35, 1.0, 1.2), 0); place(y, steel_click(r, 0.8, level=0.6), 0.03)
    write(w, "reload-end", room(y, 0.15, 0.55), "beat 4: breech swung up and latched", 0.95)
    y = canvas(0.7); place(y, steel_clack(r, 0.9, 0.3, 0.7), 0); place(y, wood_knock(r, 0.8, level=0.5), 0.01); place(y, steel_click(r, 1.0, level=0.3), 0.2)
    write(w, "pickup", room(y, 0.1, 0.4), "heavy launcher lifted, latch checked", 0.8)


def stick():
    w = "stick"
    r = Rand(1100)
    y = whoosh(r, 0.42, 280, 1300, 520, 1.0, q=0.8)
    place(y, creak(r, .18, f0=410, level=.7), .12)
    write(w, "swing", room(y, 0.12, 0.5), "flexing cane whistle sweeping 280->1300->520 Hz, dry wood creak", 0.7)
    for v in range(3):
        r = Rand(1110 + v)
        y = canvas(0.5)
        place(y, filt(r.noise(0.2), "low", 300) * env(0.2, 0.001, 0.04) * 1.2, 0)
        place(y, wood_knock(r, 0.8 + 0.1 * v, 0.2, 0.9), 0.002)
        place(y, modal([150, 240, 410], [0.05, 0.04, 0.03], [1, 0.7, 0.4], 0.2, r) * 0.6, 0)
        place(y, creak(r, .15, f0=380+v*45, level=.6), .01)
        write(w, f"impact-{v + 1}", room(y, 0.14, 0.5, seed=41 + v), "blunt impact: body thud, lacquered cane knock and flex", 0.9)
    r = Rand(1120)
    y = canvas(1.0)
    place(y, filt(r.noise(0.03), "high", 800) * env(0.03, 0.0002, 0.005) * 1.4, 0)
    place(y, wood_knock(r, 0.6, 0.2, 1.0), 0.001)
    for i in range(22):                                                  # splinters
        place(y, filt(r.noise(0.01), "band", [1500, 7000]) * env(0.01, 0.0001, 0.002) * r.u(0.1, 0.5), 0.005 + r.u(0, 0.16) ** 1.4)
    for i in range(4):                                                   # curved end tumbles on carpet
        place(y, wood_knock(r, r.u(.7,1.1), .12, .35*(1-i*.2)), .23+i*.09+r.u(0,.025))
    write(w, "break", room(y, 0.18, 0.6), "sharp cane crack, fibrous splinters, wooden hook tumbles to the carpet", 0.95)
    y = canvas(0.5); place(y, wood_knock(r, 0.9, level=0.6), 0); place(y, brass_ring(r, 1.2, 0.2, 0.2, damp=2), 0.1)
    write(w, "pickup", room(y, 0.1, 0.4), "stick lifted off its brass hook", 0.75)


def axe():
    w = "axe"
    r = Rand(1200)
    write(w, "swing", room(whoosh(r, 0.55, 180, 900, 300, 1.0, q=0.7), 0.12, 0.5), "heavy low whoosh 180->900->300 Hz", 0.75)
    for v in range(2):
        r = Rand(1210 + v)
        y = canvas(0.7)
        place(y, filt(r.noise(0.25), "low", 260) * env(0.25, 0.001, 0.06) * 1.4, 0)
        crunch = filt(r.noise(0.2), "band", [500, 3500]) * env(0.2, 0.0005, 0.03)
        place(y, crunch * 0.8, 0.001)
        place(y, steel_clack(r, 0.8, 0.2, 0.25, 0.6), 0.002)
        place(y, wood_knock(r, 0.7, level=0.5), 0.003)
        write(w, f"impact-{v + 1}", room(y, 0.16, 0.55, seed=51 + v), "heavy chop: body thud, crunch, forged head ring, hickory knock", 0.95)
    r = Rand(1220)
    y = canvas(1.0)
    for i in range(30):                                                  # break-glass cabinet
        place(y, modal([r.u(3000, 9000), r.u(5000, 12000)], [0.04, 0.03], [1, 0.6], 0.1, r) * r.u(0.05, 0.3), r.u(0, 0.25) ** 1.3)
    place(y, filt(r.noise(0.05), "high", 2000) * env(0.05, 0.0002, 0.01), 0)
    place(y, wood_knock(r, 0.8, level=0.5), 0.35)
    write(w, "pickup", room(y, 0.15, 0.5), "break-glass cabinet shatters, axe lifted out", 0.85)


def main():
    for fn in (magnum, tommy, doublebarrel, dual, machinepistol, lever, autoshotgun, sniper, lmg, launcher, stick, axe):
        fn()
        print("sounds:", fn.__name__)
    total = sum(f.stat().st_size for f in OUT.rglob("*.wav"))
    (OUT / "notes.json").write_text(json.dumps({
        "about": "Original synthesized foley for the 1970s Mystery Box arsenal. Generated by tools/weapon-1970s/make_sounds.py "
                 "from noise, damped partials and filters only; no recordings or third-party samples. 44.1 kHz mono 16-bit.",
        "files": NOTES}, indent=1))
    print("total bytes", total)


if __name__ == "__main__":
    main()
