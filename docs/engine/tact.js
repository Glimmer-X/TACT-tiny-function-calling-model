// TACT in plain JavaScript: reads the 2.39 MB weight file and runs the model on typed arrays.
// The same computation as tact/model.py.

const PAD = 0, BOS = 2, EOS = 3;

// ------------------------------------------------------------------ weight file
function halfToFloat(h) {
  const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  if (e === 0) return s * f * 2 ** -24;
  if (e === 31) return f ? NaN : s * Infinity;
  return s * (1 + f / 1024) * 2 ** (e - 15);
}

function unpack(bytes, bits, n) {
  // signed integers of `bits` bits, low bits first -> Float32Array of n values
  const out = new Float32Array(n), per = 8 / bits, mask = (1 << bits) - 1, half = 1 << (bits - 1);
  for (let i = 0; i < n; i++) {
    const v = (bytes[(i / per) | 0] >> (bits * (i % per))) & mask;
    out[i] = v >= half ? v - (1 << bits) : v;
  }
  return out;
}

function readFile(buffer) {
  const view = new DataView(buffer), n = Number(view.getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, n)));
  const tensors = {};
  for (const [name, t] of Object.entries(header)) {
    if (name === "__metadata__") continue;
    const [a, b] = t.data_offsets, bytes = new Uint8Array(buffer, 8 + n + a, b - a);
    if (t.dtype === "U8") tensors[name] = bytes;
    else if (t.dtype === "F32") tensors[name] = new DataView(bytes.buffer, bytes.byteOffset).getFloat32(0, true);
    else if (t.dtype === "F16") {
      const dv = new DataView(bytes.buffer, bytes.byteOffset), g = new Float32Array(bytes.length / 2);
      for (let i = 0; i < g.length; i++) g[i] = halfToFloat(dv.getUint16(2 * i, true));
      tensors[name] = g;
    }
  }
  return tensors;
}

// ------------------------------------------------------------------ arithmetic
function roundEven(v) {
  const r = Math.round(v);
  return Math.abs(v - Math.trunc(v)) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

// Each row of x (T rows of n) rounded to signed 8-bit integers over its own range.
// Returns the integers and, per row, the factor that restores the scale.
function quantise(x, T, n, bits) {
  const q = 2 ** (bits - 1) - 1, xi = new Float32Array(T * n), back = new Float32Array(T);
  for (let t = 0; t < T; t++) {
    let m = 1e-5;
    for (let j = t * n, e = j + n; j < e; j++) { const a = Math.abs(x[j]); if (a > m) m = a; }
    const s = Math.fround(q / m);
    for (let j = t * n, e = j + n; j < e; j++) {
      const v = roundEven(Math.fround(x[j] * s));
      xi[j] = v > q ? q : v < -q - 1 ? -q - 1 : v;
    }
    back[t] = 1 / s;
  }
  return { xi, back, T, n };
}

// y = x W^T for quantised rows; W holds the ternary values, `scale` its scale.
function linear(W, qx) {
  const { xi, back, T, n } = qx, w = W.w, m = W.rows, y = new Float32Array(T * m);
  for (let t = 0; t < T; t++) {
    const xo = t * n, f = W.scale * back[t];
    for (let o = 0; o < m; o++) {
      let wo = o * n, a0 = 0, a1 = 0, a2 = 0, a3 = 0;
      for (let j = 0; j < n; j += 4) {
        a0 += w[wo + j] * xi[xo + j];
        a1 += w[wo + j + 1] * xi[xo + j + 1];
        a2 += w[wo + j + 2] * xi[xo + j + 2];
        a3 += w[wo + j + 3] * xi[xo + j + 3];
      }
      y[t * m + o] = (a0 + a1 + a2 + a3) * f;
    }
  }
  return y;
}

function norm(g, x, T, d) {
  const y = new Float32Array(T * d);
  for (let t = 0; t < T; t++) {
    let s = 0;
    for (let j = t * d, e = j + d; j < e; j++) s += x[j] * x[j];
    const r = 1 / Math.sqrt(s / d + 1e-6);
    for (let j = 0; j < d; j++) y[t * d + j] = g[j] * x[t * d + j] * r;
  }
  return y;
}

function add(x, y) { for (let i = 0; i < x.length; i++) x[i] += y[i]; }

export class Model {
  constructor(buffer, cfg) {
    const t = readFile(buffer), d = cfg.d;
    this.cfg = cfg;
    this.hd = d / cfg.heads;
    const mat = (name, rows, cols) => ({ w: unpack(t[name], 2, rows * cols), scale: t[name + ".scale"], rows });
    const block = (p, cross) => {
      const att = (a) => ({ q: mat(`${p}.block.${a}.q.weight`, d, d), k: mat(`${p}.block.${a}.k.weight`, d, d),
                            v: mat(`${p}.block.${a}.v.weight`, d, d), o: mat(`${p}.block.${a}.o.weight`, d, d) });
      return { self: att("self_attn"), cross: cross ? att("cross_attn") : null,
               ffn0: mat(`${p}.block.ffn.0.weight`, cfg.ffn_mult * d, d), ffn1: mat(`${p}.block.ffn.1.weight`, d, cfg.ffn_mult * d) };
    };
    const norms = (p, iters) => Array.from({ length: iters }, (_, i) => [0, 1, 2].map((j) => t[`${p}.norms.${i}.${j}.g`]));
    this.emb = unpack(t["emb"], 4, cfg.vocab * d);
    for (let i = 0, s = t["emb.scale"]; i < this.emb.length; i++) this.emb[i] *= s;
    this.enc = { ...block("enc", false), norms: norms("enc", cfg.enc_iters), final: t["enc.final.g"] };
    this.dec = { ...block("dec", true), norms: norms("dec", cfg.dec_iters), final: t["dec.final.g"] };
    // rotary position encoding: one frequency per pair of channels of a head
    this.freq = Float64Array.from({ length: this.hd / 2 }, (_, j) => Math.exp(-Math.log(10000) * 2 * j / this.hd));
  }

  rotate(x, T, first) {
    // rotary encoding in place on T rows of d, the row t at position first + t
    const { hd, freq } = this, d = this.cfg.d;
    for (let t = 0; t < T; t++)
      for (let h = 0; h < d; h += hd)
        for (let j = 0; j < hd; j += 2) {
          const a = (first + t) * freq[j / 2], c = Math.cos(a), s = Math.sin(a), i = t * d + h + j;
          const x1 = x[i], x2 = x[i + 1];
          x[i] = x1 * c - x2 * s;
          x[i + 1] = x1 * s + x2 * c;
        }
  }

  attend(q, T, k, v, S, limit) {
    // q: T rows, k and v: S rows. Row t attends to the first limit(t) rows of k (all S without limit).
    const { hd } = this, d = this.cfg.d, y = new Float32Array(T * d), p = new Float64Array(S), r = 1 / Math.sqrt(hd);
    for (let t = 0; t < T; t++) {
      const n = limit ? limit(t) : S;
      for (let h = 0; h < d; h += hd) {
        let top = -Infinity;
        for (let s = 0; s < n; s++) {
          let a = 0;
          for (let j = 0; j < hd; j++) a += q[t * d + h + j] * k[s * d + h + j];
          p[s] = a * r;
          if (p[s] > top) top = p[s];
        }
        let sum = 0;
        for (let s = 0; s < n; s++) { p[s] = Math.exp(p[s] - top); sum += p[s]; }
        for (let s = 0; s < n; s++) {
          const w = p[s] / sum;
          for (let j = 0; j < hd; j++) y[t * d + h + j] += w * v[s * d + h + j];
        }
      }
    }
    return y;
  }

  feedForward(B, x, g, T) {
    const d = this.cfg.d, bits = this.cfg.act_bits;
    const h = linear(B.ffn0, quantise(norm(g, x, T, d), T, d, bits));
    for (let i = 0; i < h.length; i++) if (h[i] < 0) h[i] = 0;
    add(x, linear(B.ffn1, quantise(h, T, h.length / T, bits)));
  }

  // Encode one segment (a request or a function list). Returns S rows of d.
  encode(ids) {
    const { d, act_bits: bits } = this.cfg, S = ids.length, E = this.enc;
    const x = new Float32Array(S * d);
    for (let s = 0; s < S; s++) x.set(this.emb.subarray(ids[s] * d, ids[s] * d + d), s * d);
    for (const g of E.norms) {
      const h = quantise(norm(g[0], x, S, d), S, d, bits);
      const q = linear(E.self.q, h), k = linear(E.self.k, h), v = linear(E.self.v, h);
      this.rotate(q, S, 0);
      this.rotate(k, S, 0);
      add(x, linear(E.self.o, quantise(this.attend(q, S, k, v, S), S, d, bits)));
      this.feedForward(E, x, g[2], S);
    }
    return norm(E.final, x, S, d);
  }

  // Greedy decoding over the encoded input `mem` (S rows of d). onToken(id) is called for each new token.
  generate(mem, maxNew = 256, onToken) {
    const { d, vocab, act_bits: bits, dec_iters: iters } = this.cfg, D = this.dec, S = mem.length / d;
    const qm = quantise(mem, S, d, bits);
    const ck = linear(D.cross.k, qm), cv = linear(D.cross.v, qm);
    const keys = Array.from({ length: iters }, () => new Float32Array((maxNew + 1) * d));
    const vals = Array.from({ length: iters }, () => new Float32Array((maxNew + 1) * d));
    const out = [];
    let tok = BOS;
    for (let t = 0; t <= maxNew; t++) {
      const x = this.emb.slice(tok * d, tok * d + d);
      for (let i = 0; i < iters; i++) {
        const g = D.norms[i];
        const h = quantise(norm(g[0], x, 1, d), 1, d, bits);
        const q = linear(D.self.q, h), k = linear(D.self.k, h);
        this.rotate(q, 1, t);
        this.rotate(k, 1, t);
        keys[i].set(k, t * d);
        vals[i].set(linear(D.self.v, h), t * d);
        add(x, linear(D.self.o, quantise(this.attend(q, 1, keys[i], vals[i], t + 1), 1, d, bits)));
        const qc = linear(D.cross.q, quantise(norm(g[1], x, 1, d), 1, d, bits));
        add(x, linear(D.cross.o, quantise(this.attend(qc, 1, ck, cv, S), 1, d, bits)));
        this.feedForward(D, x, g[2], 1);
      }
      const y = norm(D.final, x, 1, d);
      let best = 0, top = -Infinity;
      for (let v = 0; v < vocab; v++) {
        let a = 0;
        for (let j = 0, e = v * d; j < d; j++) a += y[j] * this.emb[e + j];
        if (a > top) { top = a; best = v; }
      }
      if (best === EOS || t === maxNew) break;
      out.push(best);
      onToken?.(best);
      tok = best;
    }
    return out;
  }
}

export function concat(a, b) {
  const y = new Float32Array(a.length + b.length);
  y.set(a);
  y.set(b, a.length);
  return y;
}
