"""TACT: an encoder-decoder Transformer for function calling.

One encoder block is applied `enc_iters` times and one decoder block `dec_iters` times.
The weights of all linear layers are ternary, the inputs of the linear layers are quantised
to `act_bits` bits per token, and the token embedding is shared with the output layer.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F

PAD, BOS, EOS = 0, 2, 3


@dataclass
class Config:
    vocab: int = 4096
    d: int = 512
    heads: int = 8
    enc_iters: int = 6
    dec_iters: int = 4
    ffn_mult: int = 2
    act_bits: int = 8


def quant_act(x, bits):
    """Round each token vector to signed `bits`-bit integers over its own range."""
    q = 2 ** (bits - 1) - 1
    s = q / x.abs().amax(dim=-1, keepdim=True).clamp(min=1e-5)
    return (x * s).round().clamp(-q - 1, q) / s


class Linear(nn.Module):
    """Linear layer without bias. The weight holds the ternary values times the scale of the matrix."""

    def __init__(self, n_in, n_out, act_bits):
        super().__init__()
        self.register_buffer("weight", torch.zeros(n_out, n_in))
        self.act_bits = act_bits

    def forward(self, x):
        return F.linear(quant_act(x, self.act_bits), self.weight)


class RMSNorm(nn.Module):
    def __init__(self, d):
        super().__init__()
        self.register_buffer("g", torch.ones(d))

    def forward(self, x):
        return self.g * x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + 1e-6)


def rotary(x):
    """Rotary position encoding on [B, H, T, D]."""
    d, t = x.shape[-1], x.shape[-2]
    freq = torch.exp(-math.log(10000.0) * torch.arange(0, d, 2, device=x.device) / d)
    ang = torch.arange(t, device=x.device)[:, None].float() * freq[None]
    cos, sin = ang.cos()[None, None], ang.sin()[None, None]
    x1, x2 = x[..., 0::2], x[..., 1::2]
    return torch.stack([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1).flatten(-2)


class Attention(nn.Module):
    def __init__(self, cfg: Config):
        super().__init__()
        self.h = cfg.heads
        self.q, self.k, self.v, self.o = (Linear(cfg.d, cfg.d, cfg.act_bits) for _ in range(4))

    def forward(self, x, mem, mask, positions):
        B, T, D = x.shape
        S = mem.shape[1]
        q = self.q(x).view(B, T, self.h, -1).transpose(1, 2)
        k = self.k(mem).view(B, S, self.h, -1).transpose(1, 2)
        v = self.v(mem).view(B, S, self.h, -1).transpose(1, 2)
        if positions:
            q, k = rotary(q), rotary(k)
        y = F.scaled_dot_product_attention(q, k, v, attn_mask=mask)
        return self.o(y.transpose(1, 2).reshape(B, T, D))


class Block(nn.Module):
    def __init__(self, cfg: Config, cross: bool):
        super().__init__()
        self.self_attn = Attention(cfg)
        self.cross_attn = Attention(cfg) if cross else None
        self.ffn = nn.ModuleList([Linear(cfg.d, cfg.ffn_mult * cfg.d, cfg.act_bits),
                                  Linear(cfg.ffn_mult * cfg.d, cfg.d, cfg.act_bits)])

    def forward(self, x, norms, self_mask, mem=None, mem_mask=None):
        h = norms[0](x)
        x = x + self.self_attn(h, h, self_mask, positions=True)
        if self.cross_attn is not None:
            x = x + self.cross_attn(norms[1](x), mem, mem_mask, positions=False)
        return x + self.ffn[1](F.relu(self.ffn[0](norms[2](x))))


class Stack(nn.Module):
    """One block applied `iters` times. Each iteration has its own normalisation gains."""

    def __init__(self, cfg: Config, iters: int, cross: bool):
        super().__init__()
        self.block = Block(cfg, cross)
        self.norms = nn.ModuleList(nn.ModuleList(RMSNorm(cfg.d) for _ in range(3)) for _ in range(iters))
        self.final = RMSNorm(cfg.d)

    def forward(self, x, self_mask, mem=None, mem_mask=None):
        for norms in self.norms:
            x = self.block(x, norms, self_mask, mem, mem_mask)
        return self.final(x)


class TACT(nn.Module):
    def __init__(self, cfg: Config = Config()):
        super().__init__()
        self.cfg = cfg
        self.register_buffer("emb", torch.zeros(cfg.vocab, cfg.d))
        self.enc = Stack(cfg, cfg.enc_iters, cross=False)
        self.dec = Stack(cfg, cfg.dec_iters, cross=True)

    def encode(self, ids):
        """Encode one segment (a request or a function list). ids: [B, S], padded with PAD.
        Returns the encoding [B, S, d] and the mask of real tokens [B, S]."""
        keep = ids != PAD
        return self.enc(F.embedding(ids, self.emb), keep[:, None, None, :]), keep

    def decode(self, out, mem, keep):
        """Scores of the next token at every position of `out`. mem: [B, S, d], keep: [B, S]."""
        T = out.shape[1]
        causal = torch.ones(T, T, dtype=torch.bool, device=out.device).tril()[None, None]
        x = self.dec(F.embedding(out, self.emb), causal, mem, keep[:, None, None, :])
        return x @ self.emb.t()

    @torch.no_grad()
    def generate(self, mem, keep, max_new: int = 256):
        """Greedy decoding. Returns one list of token ids per row, without BOS and EOS."""
        n, dev = mem.shape[0], mem.device
        out = torch.full((n, 1), BOS, dtype=torch.long, device=dev)
        done = torch.zeros(n, dtype=torch.bool, device=dev)
        for _ in range(max_new):
            nxt = self.decode(out, mem, keep)[:, -1].argmax(-1)
            nxt = torch.where(done, torch.full_like(nxt, PAD), nxt)
            out = torch.cat([out, nxt[:, None]], dim=1)
            done |= nxt == EOS
            if done.all():
                break
        return [r[:r.index(EOS)] if EOS in r else [t for t in r if t != PAD] for r in out[:, 1:].tolist()]
