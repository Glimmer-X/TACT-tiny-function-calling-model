"""The weight file: ternary linear weights at 2 bits, the embedding at 4 bits, gains at 16 bits.

Every linear weight is stored as values in {-1, 0, +1}, four to a byte, with one float scale per
matrix. The embedding is stored as integers in [-8, 7], two to a byte, with one scale for the table.
"""
from __future__ import annotations

import numpy as np
import torch


def pack(values: np.ndarray, bits: int) -> np.ndarray:
    """Signed integers that fit in `bits` bits -> bytes, low bits first."""
    per = 8 // bits
    v = (values.astype(np.int64).ravel() & (2 ** bits - 1)).astype(np.uint8).reshape(-1, per)
    out = np.zeros(len(v), dtype=np.uint8)
    for i in range(per):
        out |= v[:, i] << (bits * i)
    return out


def unpack(data: np.ndarray, bits: int) -> np.ndarray:
    per = 8 // bits
    v = np.stack([(data >> (bits * i)) & (2 ** bits - 1) for i in range(per)], axis=1).astype(np.int8)
    v[v >= 2 ** (bits - 1)] -= 2 ** bits
    return v.ravel()


def to_file(model_state: dict) -> dict:
    """State of a TACT model (see from_file) -> tensors of the weight file."""
    out = {}
    for name, w in model_state.items():
        w = w.float()
        if name.endswith(".g"):
            out[name] = w.half()
            continue
        bits = 4 if name == "emb" else 2
        scale = w.abs().max()
        if bits == 4:
            scale = scale / 7
        out[name] = torch.from_numpy(pack((w / scale).round().numpy(), bits))
        out[name + ".scale"] = scale.reshape(1)
    return out


def from_file(tensors: dict, shapes: dict) -> dict:
    """Tensors of the weight file -> state of a TACT model. shapes: name -> shape of each buffer."""
    state = {}
    for name, shape in shapes.items():
        if name.endswith(".g"):
            state[name] = tensors[name].float()
            continue
        bits = 4 if name == "emb" else 2
        values = torch.from_numpy(unpack(tensors[name].numpy(), bits)).float()
        state[name] = (values * tensors[name + ".scale"]).reshape(shape)
    return state
