// The tokenizer of TACT: byte-pair encoding over 4096 pieces, as SentencePiece computes it.
// pieces[i] is the text of token i. Tokens 4-7 are whole symbols, tokens 8-263 are single bytes.

const SPACE = "▁";
const SYMBOLS = [4, 5, 6, 7];
const BYTE0 = 8;

export class Tokenizer {
  constructor(pieces) {
    this.pieces = pieces;
    this.id = new Map(pieces.map((p, i) => [p, i]));
    this.symbols = SYMBOLS.map((i) => pieces[i]);
    this.utf8 = new TextEncoder();
  }

  encode(text) {
    if (!text) return [];
    // split into characters, keeping the whole symbols in one piece
    text = SPACE + text.replaceAll(" ", SPACE);
    const parts = [], frozen = [];
    for (let i = 0; i < text.length;) {
      const sym = this.symbols.find((s) => text.startsWith(s, i));
      const ch = sym ?? String.fromCodePoint(text.codePointAt(i));
      parts.push(ch);
      frozen.push(sym !== undefined);
      i += ch.length;
    }
    // merge the adjacent pair whose joined piece has the lowest id, leftmost first, until none is left
    for (;;) {
      let best = -1, bestId = Infinity;
      for (let i = 0; i + 1 < parts.length; i++) {
        if (frozen[i] || frozen[i + 1]) continue;
        const id = this.id.get(parts[i] + parts[i + 1]);
        if (id !== undefined && id < bestId) { best = i; bestId = id; }
      }
      if (best < 0) break;
      parts.splice(best, 2, parts[best] + parts[best + 1]);
      frozen.splice(best, 1);
    }
    const ids = [];
    for (const p of parts) {
      const id = this.id.get(p);
      if (id !== undefined) ids.push(id);
      else for (const b of this.utf8.encode(p)) ids.push(BYTE0 + b);
    }
    return ids;
  }

  decode(ids) {
    const bytes = [];
    for (const i of ids) {
      if (i < 4) continue;
      if (i >= BYTE0 && i < BYTE0 + 256) bytes.push(i - BYTE0);
      else bytes.push(...this.utf8.encode(this.pieces[i]));
    }
    const text = new TextDecoder().decode(new Uint8Array(bytes)).replaceAll(SPACE, " ");
    return text.startsWith(" ") ? text.slice(1) : text;
  }
}
