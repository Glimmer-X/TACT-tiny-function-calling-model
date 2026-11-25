"""Text form of the input and the output.

Input:   <q>\\n{request}\\n<tools>\\n{one line per function}
         a function line is `name(arg:type!,arg2:type) // description`; `!` marks a required argument
Output:  [{"name":"...","arguments":{...}}, ...]
"""
from __future__ import annotations

import json

DESC_CHARS = 100


def _type(schema) -> str:
    if not isinstance(schema, dict):
        return "any"
    if schema.get("enum"):
        return "enum[" + "|".join(str(v) for v in schema["enum"]) + "]"
    return str(schema.get("type") or "any")


def function_line(fn: dict) -> str:
    fn = fn.get("function", fn)   # accepts {"type": "function", "function": {...}} as well
    params = fn.get("parameters") or {}
    required = params.get("required")
    required = set(required) if isinstance(required, list) else set()
    props = params.get("properties")
    args = ",".join(f"{k}:{_type(v)}{'!' if k in required else ''}"
                    for k, v in (props.items() if isinstance(props, dict) else []))
    desc = " ".join((fn.get("description") or "").split())[:DESC_CHARS]
    return f"{fn['name']}({args})" + (f" // {desc}" if desc else "")


def request_text(request: str) -> str:
    return f"<q>\n{request}\n"


def functions_text(functions: list[dict]) -> str:
    return "<tools>\n" + "\n".join(function_line(f) for f in functions)


def parse_calls(text: str):
    """Model output -> list of calls, or None when the output is not a list of calls."""
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, list) or not all(isinstance(c, dict) and "name" in c for c in obj):
        return None
    return [{"name": c["name"], "arguments": c.get("arguments") or {}} for c in obj]
