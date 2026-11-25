"""Scoring of predicted calls against reference calls."""
from __future__ import annotations

import json


def _normalise(v):
    """Letter case and extra whitespace are ignored; numbers are compared by value."""
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = " ".join(v.split()).casefold()
        try:
            return float(s)
        except ValueError:
            return s
    if isinstance(v, list):
        return [_normalise(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _normalise(x) for k, x in v.items()}
    return v


def _key(call: dict) -> str:
    return json.dumps({"name": call.get("name"), "arguments": _normalise(call.get("arguments") or {})},
                      sort_keys=True, ensure_ascii=False)


def correct(pred, gold: list[dict]) -> bool:
    """True when the predicted calls are the reference calls, in any order. pred None is wrong."""
    return pred is not None and sorted(map(_key, pred)) == sorted(map(_key, gold))
