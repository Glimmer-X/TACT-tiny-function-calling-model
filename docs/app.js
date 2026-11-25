// Page logic: the demo (the model runs in a worker), the chart, the table and the weight picture.
import { DEVICES, MODELS, SETS } from "./data.js";
import { parseCalls } from "./engine/text.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const seconds = (ms) => (ms < 995 ? `${Math.max(1, Math.round(ms / 10)) / 100} s` : `${(ms / 1000).toFixed(1)} s`);

// ------------------------------------------------------------------ demo
const worker = new Worker(new URL("./engine/worker.js", import.meta.url), { type: "module" });
const state = { ready: false, device: 0, functions: DEVICES[0].functions, bound: -1, job: 0, busy: false, facts: {} };

function showStatus() {
  const f = state.facts, parts = [];
  if (f.bytes) parts.push(`model ${(f.bytes / 1e6).toFixed(2)} MB, ready in ${seconds(f.load)}`);
  if (f.bind) parts.push(`function list read in ${seconds(f.bind)}`);
  if (f.ask) parts.push(`answered in ${seconds(f.ask)}`);
  $("status").textContent = parts.join(" · ") || "Loading the model…";
}

function typeText(schema) {
  if (!schema || typeof schema !== "object") return "any";
  return Array.isArray(schema.enum) && schema.enum.length ? schema.enum.join(" | ") : String(schema.type || "any");
}

function showFunctions() {
  const list = $("function-list");
  list.replaceChildren();
  for (const raw of state.functions) {
    const fn = raw.function ?? raw, li = el("li"), sig = el("div", "signature");
    sig.append(el("span", "name", fn.name), "(");
    Object.entries(fn.parameters?.properties ?? {}).forEach(([k, v], i) => {
      if (i) sig.append(", ");
      sig.append(k, el("span", "type", ": " + typeText(v)));
    });
    sig.append(")");
    li.append(sig);
    if (fn.description) li.append(el("div", "description", fn.description));
    list.append(li);
  }
}

function showDevices() {
  const box = $("devices");
  box.replaceChildren();
  const names = DEVICES.map((d) => d.name).concat(state.device === -1 ? ["Your own"] : []);
  names.forEach((name, i) => {
    const index = i < DEVICES.length ? i : -1, b = el("button", "chip", name);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(index === state.device));
    b.onclick = () => index >= 0 && chooseDevice(index);
    box.append(b);
  });
  const ex = $("examples");
  ex.replaceChildren();
  for (const text of state.device >= 0 ? DEVICES[state.device].examples : []) {
    const b = el("button", "chip", text);
    b.type = "button";
    b.onclick = () => { $("request").value = text; ask(); };
    ex.append(b);
  }
}

function bind() {
  state.bound = -1;
  state.facts.bind = state.facts.ask = undefined;
  if (state.ready) worker.postMessage({ type: "bind", id: ++state.job, functions: state.functions });
}

function chooseDevice(index) {
  state.device = index;
  state.functions = DEVICES[index].functions;
  closeEditor();
  showDevices();
  showFunctions();
  $("request").value = DEVICES[index].examples[0];
  bind();
  ask();
}

function showCalls(text, done) {
  const out = $("output"), calls = done ? parseCalls(text) : null;
  out.replaceChildren();
  if (!done) return out.append(el("div", "call raw", text || " "));
  if (!calls) return out.append(el("div", "call raw", text), el("p", "hint", "The output is not a list of calls."));
  if (!calls.length) return out.append(el("p", "hint", "No call: none of the functions fits this request."));
  for (const c of calls) {
    const row = el("div", "call");
    row.append(el("span", "name", c.name), "(");
    Object.entries(c.arguments).forEach(([k, v], i) => {
      if (i) row.append(", ");
      row.append(el("span", "arg", k + " = "), JSON.stringify(v));
    });
    row.append(")");
    out.append(row);
  }
}

function ask() {
  const request = $("request").value.trim();
  if (!request || !state.ready) return;
  state.busy = true;
  $("run").disabled = true;
  showCalls("", false);
  worker.postMessage({ type: "ask", id: ++state.job, request });
}

worker.onmessage = ({ data }) => {
  if (data.type === "ready") {
    state.ready = true;
    state.facts = { bytes: data.bytes, load: data.ms };
    drawWeights(data.sample, data.side);
    bind();
    ask();
  } else if (data.type === "bound") {
    state.bound = data.id;
    state.facts.bind = data.ms;
  } else if (data.type === "token") {
    if (data.id === state.job) showCalls(data.text, false);
  } else if (data.type === "done") {
    if (data.id !== state.job) return;
    state.busy = false;
    $("run").disabled = false;
    state.facts.ask = data.ms;
    showCalls(data.text, true);
  } else if (data.type === "error") {
    $("status").textContent = "The model could not be loaded: " + data.message;
    return;
  }
  showStatus();
};
worker.onerror = () => { $("status").textContent = "This browser could not start the model."; };

$("ask").onsubmit = (e) => { e.preventDefault(); ask(); };

// editing the function list
function closeEditor() {
  $("editor").hidden = true;
  $("function-list").hidden = false;
  $("edit").textContent = "Edit";
}
$("edit").onclick = () => {
  if (!$("editor").hidden) return closeEditor();
  $("json").value = JSON.stringify(state.functions, null, 2);
  $("json-error").textContent = "";
  $("editor").hidden = false;
  $("function-list").hidden = true;
  $("edit").textContent = "Close";
};
$("cancel").onclick = closeEditor;
$("apply").onclick = () => {
  let list;
  try { list = JSON.parse($("json").value); } catch (e) { return ($("json-error").textContent = "Not valid JSON: " + e.message); }
  if (!Array.isArray(list) || !list.length || !list.every((f) => f && typeof (f.function ?? f).name === "string"))
    return ($("json-error").textContent = "Give a list of functions, each with a name.");
  state.functions = list;
  state.device = -1;
  closeEditor();
  showDevices();
  showFunctions();
  $("output").replaceChildren(el("p", "hint", "Type a request for your functions."));
  bind();
  $("request").value = "";
  $("request").focus();
};

showDevices();
showFunctions();
$("request").value = DEVICES[0].examples[0];
worker.postMessage({ type: "load" });

// ------------------------------------------------------------------ weight picture
let weightSample = null;
function drawWeights(sample, side) {
  if (sample) weightSample = { sample, side };
  if (!weightSample) return;
  const canvas = $("weights"), ctx = canvas.getContext("2d"), n = weightSample.side;
  canvas.width = canvas.height = n;
  const img = ctx.createImageData(n, n);
  const rgb = (name) => { ctx.fillStyle = css(name); ctx.fillRect(0, 0, 1, 1); return ctx.getImageData(0, 0, 1, 1).data; };
  const tone = { "-1": rgb("--ink"), 0: rgb("--surface"), 1: rgb("--accent") };
  for (let i = 0; i < n * n; i++) img.data.set(tone[weightSample.sample[i]], 4 * i);
  ctx.putImageData(img, 0, 0);
}

// the small grid in the first card: a corner of the same idea, drawn from a fixed pattern
{
  const g = $("ternary-art"), ns = "http://www.w3.org/2000/svg", pattern = "+0-0++-00-+0-+0+-0+0-0+-+00-0+-0-+0+0-+-00+0-0++-0-+0+-00+-0+0-+0-+00-";
  for (let i = 0; i < 70; i++) {
    const r = document.createElementNS(ns, "rect"), c = pattern[i];
    r.setAttribute("x", 6 + (i % 14) * 13.6);
    r.setAttribute("y", 8 + Math.floor(i / 14) * 19.4);
    r.setAttribute("width", 11);
    r.setAttribute("height", 16);
    r.setAttribute("rx", 2.5);
    r.setAttribute("class", c === "+" ? "cell-pos" : c === "-" ? "cell-neg" : "cell-zero");
    g.append(r);
  }
}

// ------------------------------------------------------------------ chart
// Where each name sits relative to its dot: [dx, dy, anchor]. Chosen so that no two names touch.
const PLACE = {
  "TACT": [-8, -30, "start"], "Needle 2": [0, 21, "middle"], "Needle 3": [11, 4, "start"], "Needle 1": [11, 4, "start"],
  "FunctionGemma 270M": [-11, 4, "end"], "LFM2.5-350M": [-11, 4, "end"], "Hammer2.1-0.5B": [-11, 4, "end"],
  "Qwen3-0.6B": [11, 4, "start"], "Qwen3.5-0.8B": [11, 4, "start"], "xLAM-2-1B": [-11, 4, "end"],
};
const NARROW_NAMES = new Set(["TACT", "xLAM-2-1B", "Needle 1"]);

function drawChart() {
  const box = $("chart"), W = box.clientWidth, narrow = W < 560, H = narrow ? 340 : 440;
  const m = { l: 44, r: narrow ? 16 : 28, t: 16, b: 46 };
  const x = (mb) => m.l + (Math.log10(mb) - 0) / 4 * (W - m.l - m.r);   // 1 MB to 10 GB
  const y = (acc) => m.t + (90 - acc) / 60 * (H - m.t - m.b);           // 30 % to 90 %
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Mean accuracy against model size for ten open function-calling models");
  const add = (tag, attrs, text) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    svg.append(e);
    return e;
  };
  for (const a of [30, 40, 50, 60, 70, 80, 90]) {
    add("line", { class: "grid", x1: m.l, x2: W - m.r, y1: y(a), y2: y(a) });
    add("text", { class: "axis-text", x: m.l - 8, y: y(a) + 4, "text-anchor": "end" }, a);
  }
  [["1 MB", 1], ["10 MB", 10], ["100 MB", 100], ["1 GB", 1000], ["10 GB", 10000]].forEach(([label, mb], i, all) =>
    add("text", { class: "axis-text", x: x(mb), y: H - m.b + 20, "text-anchor": i === 0 ? "start" : i === all.length - 1 ? "end" : "middle" }, label));
  add("text", { class: "axis-title", x: W - m.r, y: H - 6, "text-anchor": "end" }, "Size of the weights, logarithmic");
  add("text", { class: "axis-title", x: m.l, y: m.t - 4 }, "Mean accuracy, %");

  const ours = MODELS[0];
  add("line", { class: "level", x1: x(ours.mb), x2: W - m.r, y1: y(ours.scores[4]), y2: y(ours.scores[4]) });
  const tip = $("tooltip");
  for (const model of [...MODELS].reverse()) {
    const mine = model === ours, cx = x(model.mb), cy = y(model.scores[4]);
    add("circle", { class: "dot" + (mine ? " ours" : ""), cx, cy, r: mine ? 8 : 5.5 });
    if (!narrow || NARROW_NAMES.has(model.name)) {
      const [dx, dy, anchor] = PLACE[model.name];
      add("text", { class: "name" + (mine ? " ours" : ""), x: cx + dx, y: cy + dy, "text-anchor": anchor }, model.name);
      if (mine) add("text", { class: "value", x: cx + dx, y: cy + dy + 17 }, `${model.size} · ${model.scores[4]} %`);
    }
    const hit = add("circle", { class: "hit", cx, cy, r: 18, tabindex: 0 });
    const show = () => {
      tip.replaceChildren(el("b", "", model.name), el("span", "", `${model.size} · ${model.params} parameters · ${model.scores[4]} %`));
      tip.style.left = `${box.offsetLeft + cx}px`;
      tip.style.top = `${box.offsetTop + cy}px`;
      tip.hidden = false;
    };
    hit.addEventListener("pointerenter", show);
    hit.addEventListener("focus", show);
    hit.addEventListener("pointerleave", () => (tip.hidden = true));
    hit.addEventListener("blur", () => (tip.hidden = true));
  }
  box.replaceChildren(svg);
}

function drawTable() {
  const table = $("table"), head = el("tr");
  for (const h of ["Model", "Parameters", "Size", ...SETS]) head.append(el("th", "", h));
  table.append(head);
  for (const mdl of MODELS) {
    const tr = el("tr", mdl === MODELS[0] ? "ours" : "");
    tr.append(el("td", "", mdl.name), el("td", "", mdl.params), el("td", "", mdl.size), ...mdl.scores.map((s) => el("td", "", s.toFixed(1))));
    table.append(tr);
  }
}

drawChart();
drawTable();
let pending;
addEventListener("resize", () => { clearTimeout(pending); pending = setTimeout(drawChart, 120); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => drawWeights());
