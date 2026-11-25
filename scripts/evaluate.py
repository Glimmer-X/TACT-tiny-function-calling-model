"""Accuracy of TACT on the device-control test sets.

    python scripts/evaluate.py                      # the four sets in eval_sets/
    python scripts/evaluate.py eval_sets/authored.jsonl --show 5
    python scripts/evaluate.py --weights path/to/folder --device cuda
"""
import argparse
import json
from pathlib import Path

import tact
from tact.metrics import correct

ROOT = Path(__file__).resolve().parents[1]
SETS = ["held_out", "authored", "external_a", "external_b"]

ap = argparse.ArgumentParser()
ap.add_argument("files", nargs="*", default=[str(ROOT / f"eval_sets/{s}.jsonl") for s in SETS])
ap.add_argument("--weights", default=None, help="folder with the model files (default: download)")
ap.add_argument("--device", default="cpu")
ap.add_argument("--show", type=int, default=0, help="print this many wrong answers per set")
a = ap.parse_args()

model = tact.load(a.weights, a.device)
scores = []
for f in a.files:
    right = total = shown = 0
    for line in open(f):
        sc = json.loads(line)
        bound = model.bind(sc["functions"])
        outputs = bound.raw([r["request"] for r in sc["requests"]])
        for r, text in zip(sc["requests"], outputs):
            ok = correct(tact.text.parse_calls(text), r["calls"])
            right, total = right + ok, total + 1
            if not ok and shown < a.show:
                shown += 1
                print(f"  request   {r['request']}\n  reference {json.dumps(r['calls'])}\n  output    {text}")
    scores.append(100 * right / total)
    print(f"{Path(f).stem:12s} {right:5d} / {total:5d}   {scores[-1]:.1f}%", flush=True)
if len(scores) > 1:
    print(f"{'mean':12s} {'':13s}   {sum(scores) / len(scores):.1f}%")
