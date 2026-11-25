// Runs TACT off the main thread. Messages in: load, bind (a function list), ask (a request).
import { Model, concat } from "./tact.js";
import { Tokenizer } from "./tokenizer.js";
import { functionsText, requestText } from "./text.js";

const MAX_FUNCTION_TOKENS = 1344, MAX_REQUEST_TOKENS = 256;
let model, tokenizer, functionMemory;

async function load() {
  const t0 = performance.now();
  const base = new URL("../model/", import.meta.url);
  const [weights, pieces, cfg] = await Promise.all([
    fetch(new URL("tact.safetensors", base)).then((r) => r.arrayBuffer()),
    fetch(new URL("tokenizer.json", base)).then((r) => r.json()),
    fetch(new URL("config.json", base)).then((r) => r.json()),
  ]);
  model = new Model(weights, cfg);
  tokenizer = new Tokenizer(pieces);
  const d = cfg.d, w = model.enc.self.q.w, sample = new Int8Array(d * d);
  for (let i = 0; i < sample.length; i++) sample[i] = w[i];
  const header = Number(new DataView(weights).getBigUint64(0, true)) + 8;   // the file opens with a table of names
  postMessage({ type: "ready", bytes: weights.byteLength - header, ms: performance.now() - t0, side: d, sample }, [sample.buffer]);
}

onmessage = ({ data }) => {
  if (data.type === "load") return load().catch((e) => postMessage({ type: "error", message: String(e) }));
  const t0 = performance.now();
  if (data.type === "bind") {
    const ids = tokenizer.encode(functionsText(data.functions)).slice(1, 1 + MAX_FUNCTION_TOKENS);
    functionMemory = model.encode(ids);
    postMessage({ type: "bound", id: data.id, tokens: ids.length, ms: performance.now() - t0 });
  } else if (data.type === "ask") {
    const ids = tokenizer.encode(requestText(data.request)).slice(0, MAX_REQUEST_TOKENS);
    const memory = concat(model.encode(ids), functionMemory), out = [], t1 = performance.now();
    model.generate(memory, 256, (tok) => {
      out.push(tok);
      postMessage({ type: "token", id: data.id, text: tokenizer.decode(out) });
    });
    postMessage({ type: "done", id: data.id, text: tokenizer.decode(out), tokens: out.length + 1,
                  ms: performance.now() - t0, writeMs: performance.now() - t1 });
  }
};
