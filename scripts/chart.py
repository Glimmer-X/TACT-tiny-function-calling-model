"""Draw docs/chart.svg, the size and accuracy chart of the README, in the style of the project page."""
import math
from pathlib import Path

MODELS = [  # name, size in MB, mean accuracy, where the name sits: dx, dy, anchor
    ("TACT", 2.39, 80.3, None), ("Needle 2", 14, 77.0, (0, 21, "middle")), ("Needle 3", 35, 75.3, (11, 4, "start")),
    ("Needle 1", 61, 39.7, (11, 4, "start")), ("FunctionGemma 270M", 536, 54.3, (-11, 4, "end")),
    ("LFM2.5-350M", 709, 66.6, (-11, 4, "end")), ("Hammer2.1-0.5B", 988, 74.8, (-11, 4, "end")),
    ("Qwen3-0.6B", 1500, 62.0, (11, 4, "start")), ("Qwen3.5-0.8B", 1700, 75.9, (11, 4, "start")),
    ("xLAM-2-1B", 3100, 86.8, (-11, 4, "end")),
]
W, H, PAD = 1006, 470, 16
L, R, T, B = 40, W - 28, 12, H - 46
INK, INK2, INK3, LINE, ACCENT, ACCENT_TEXT, GREY = "#161614", "#55534e", "#8a8882", "#e3e1da", "#e8612c", "#b4430f", "#8a8983"
SANS, MONO = "-apple-system,Segoe UI,Helvetica,Arial,sans-serif", "ui-monospace,Menlo,Consolas,monospace"


def x(mb):
    return round(L + math.log10(mb) / 4 * (R - L), 1)


def y(acc):
    return round(T + (95 - acc) / 65 * (B - T), 1)


def text(px, py, s, fill=INK, size=12.5, font=SANS, anchor="start", weight=None):
    w = f' font-weight="{weight}"' if weight else ""
    return f'<text x="{px}" y="{py}" text-anchor="{anchor}" fill="{fill}" font-family="{font}" font-size="{size}"{w}>{s}</text>'


o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-PAD} {-PAD} {W + 2 * PAD} {H + 2 * PAD}" width="{W + 2 * PAD}" height="{H + 2 * PAD}" role="img" '
     'aria-label="Mean accuracy against model size for ten open function-calling models">',
     f'<rect x="{-PAD + .5}" y="{-PAD + .5}" width="{W + 2 * PAD - 1}" height="{H + 2 * PAD - 1}" rx="12" fill="#ffffff" stroke="{LINE}"/>',
     f'<defs><linearGradient id="better" x1="0" y1="0" x2="0.62" y2="1"><stop offset="0" stop-color="{ACCENT}" stop-opacity="0.2"/>'
     f'<stop offset="0.6" stop-color="{ACCENT}" stop-opacity="0"/></linearGradient></defs>',
     f'<rect x="{L}" y="{T}" width="{R - L}" height="{B - T}" rx="6" fill="url(#better)"/>']
for d in range(4):
    for k in range(1, 10):
        if (d, k) != (0, 1):
            o.append(f'<line x1="{x(k * 10 ** d)}" x2="{x(k * 10 ** d)}" y1="{T}" y2="{B}" stroke="{INK3 if k == 1 else LINE}" opacity="0.45"/>')
for a in range(30, 91, 10):
    o.append(f'<line x1="{L}" x2="{R}" y1="{y(a)}" y2="{y(a)}" stroke="{LINE}"/>')
    o.append(text(L - 8, y(a) + 4, a, INK3, 12, MONO, "end"))
for label, mb, anchor in [("1 MB", 1, "start"), ("10 MB", 10, "middle"), ("100 MB", 100, "middle"), ("1 GB", 1000, "middle"), ("10 GB", 10000, "end")]:
    o.append(text(x(mb), B + 20, label, INK3, 12, MONO, anchor))
o.append(text(R, H - 6, "Size of the weights (logarithmic)", INK3, 12, SANS, "end"))
o.append(text(R - 6, T + 16, "Mean accuracy (%)", INK3, 12, SANS, "end"))
o.append(f'<path d="M{L + 46} {T + 44} L{L + 14} {T + 14}" fill="none" stroke="{ACCENT_TEXT}" stroke-width="1.5"/>')
o.append(f'<path d="M{L + 9} {T + 9} l11 2 l-9 9 z" fill="{ACCENT_TEXT}"/>')
o.append(text(L + 54, T + 24, "smaller and more accurate"))

ox, oy, bx, by = x(2.39), y(80.3), x(3100), y(86.8)
dash = f'fill="none" stroke="{ACCENT}" stroke-width="1.25" stroke-dasharray="4 4"'
o.append(f'<path d="M{ox} {oy} H{bx} V{by + 9}" {dash}/>')
o.append(f'<path d="M{ox} {oy} V{B}" {dash}/>')
o.append(text(x(55), oy - 8, "The only model above this accuracy is 1300 times the size of TACT"))
o.append(text(ox + 8, y(50), "No other model has"))
o.append(text(ox + 8, y(50) + 17, "been reported at this size"))
for name, mb, acc, place in reversed(MODELS):
    cx, cy = x(mb), y(acc)
    if place is None:
        o.append(f'<circle cx="{cx}" cy="{cy}" r="8" fill="{ACCENT}" stroke="#ffffff" stroke-width="2"/>')
        o.append(text(cx + 13, cy + 22, name, INK, 14, SANS, weight=600))
        o.append(text(cx + 13, cy + 38, f"{mb} MB · {acc} %", INK3, 12, MONO))
    else:
        o.append(f'<circle cx="{cx}" cy="{cy}" r="5.5" fill="{GREY}" stroke="#ffffff" stroke-width="2"/>')
        o.append(text(cx + place[0], cy + place[1], name, INK2, anchor=place[2]))
o.append("</svg>")
Path(__file__).resolve().parents[1].joinpath("docs/chart.svg").write_text("\n".join(o) + "\n")
