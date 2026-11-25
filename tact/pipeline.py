"""Loading the model and calling it."""
from __future__ import annotations

import json
from pathlib import Path

import sentencepiece as spm
import torch
from safetensors.torch import load_file

from .model import PAD, TACT, Config
from .text import functions_text, parse_calls, request_text
from .weights import from_file

REPO = "Glimmer-X/TACT-tiny-function-calling-model"
MAX_FUNCTION_TOKENS = 1344


def _pad(rows, device):
    out = torch.full((len(rows), max(map(len, rows))), PAD, dtype=torch.long, device=device)
    for i, r in enumerate(rows):
        out[i, :len(r)] = torch.tensor(r)
    return out


class Bound:
    """The model with the function list of one device. The list is encoded once, here."""

    def __init__(self, tact: "Tact", functions: list[dict]):
        self.tact = tact
        ids = tact.tokenizer.encode(functions_text(functions))
        if ids[0] == tact.tokenizer.piece_to_id("▁"):   # the tokenizer opens every text with a space piece
            ids = ids[1:]
        ids = ids[:MAX_FUNCTION_TOKENS]
        with torch.no_grad():
            self.mem, self.keep = tact.model.encode(_pad([ids], tact.device))

    def raw(self, requests: list[str], batch: int = 32) -> list[str]:
        """The output text for each request."""
        tk, model = self.tact.tokenizer, self.tact.model
        ids = [tk.encode(request_text(r)) for r in requests]
        order = sorted(range(len(ids)), key=lambda i: len(ids[i]))
        out = [None] * len(ids)
        with torch.no_grad():
            for b in range(0, len(order), batch):
                idx = order[b:b + batch]
                mem, keep = model.encode(_pad([ids[i] for i in idx], self.tact.device))
                mem = torch.cat([mem, self.mem.expand(len(idx), -1, -1)], dim=1)
                keep = torch.cat([keep, self.keep.expand(len(idx), -1)], dim=1)
                for i, toks in zip(idx, model.generate(mem, keep)):
                    out[i] = tk.decode(toks)
        return out

    def batch(self, requests: list[str]) -> list:
        """The calls for each request (None when an output is not a list of calls)."""
        return [parse_calls(t) for t in self.raw(requests)]

    def __call__(self, request: str):
        return self.batch([request])[0]


class Tact:
    def __init__(self, folder: Path, device: str = "cpu"):
        folder = Path(folder)
        self.device = device
        self.model = TACT(Config(**json.loads((folder / "config.json").read_text())))
        shapes = {k: v.shape for k, v in self.model.state_dict().items()}
        self.model.load_state_dict(from_file(load_file(folder / "tact.safetensors"), shapes))
        self.model.to(device).eval()
        self.tokenizer = spm.SentencePieceProcessor(model_file=str(folder / "tokenizer.model"))

    def bind(self, functions: list[dict]) -> Bound:
        return Bound(self, functions)

    def __call__(self, request: str, functions: list[dict]):
        return self.bind(functions)(request)


def load(path: str | None = None, device: str = "cpu") -> Tact:
    """Load TACT from a local folder, or from the Hugging Face Hub when no folder is given."""
    if path is None:
        from huggingface_hub import snapshot_download
        path = snapshot_download(REPO, allow_patterns=["config.json", "tact.safetensors", "tokenizer.model"])
    return Tact(Path(path), device)
