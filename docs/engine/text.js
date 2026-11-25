// Text form of the input and the output, as in tact/text.py.

const DESC_CHARS = 100;

function typeOf(schema) {
  if (!schema || typeof schema !== "object") return "any";
  if (Array.isArray(schema.enum) && schema.enum.length) return "enum[" + schema.enum.join("|") + "]";
  return String(schema.type || "any");
}

export function functionLine(fn) {
  fn = fn.function ?? fn;
  const params = fn.parameters ?? {}, required = new Set(Array.isArray(params.required) ? params.required : []);
  const props = params.properties && typeof params.properties === "object" ? params.properties : {};
  const args = Object.entries(props).map(([k, v]) => `${k}:${typeOf(v)}${required.has(k) ? "!" : ""}`).join(",");
  const desc = (fn.description ?? "").split(/\s+/).filter(Boolean).join(" ").slice(0, DESC_CHARS);
  return `${fn.name}(${args})` + (desc ? ` // ${desc}` : "");
}

export const requestText = (request) => `<q>\n${request}\n`;
export const functionsText = (functions) => "<tools>\n" + functions.map(functionLine).join("\n");

export function parseCalls(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(obj) || !obj.every((c) => c && typeof c === "object" && "name" in c)) return null;
  return obj.map((c) => ({ name: c.name, arguments: c.arguments ?? {} }));
}
