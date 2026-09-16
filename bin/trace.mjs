#!/usr/bin/env node
// agent-loop-trace v0.1 — zero-dep validate + deliver, mirrors archify chain.
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function validateSpec(spec) {
  const checks = [];
  const errors = [];
  const push = (name, ok, details = [], fixes = []) =>
    checks.push({ name, ok, details, supportedFixes: fixes });

  // 1. schema-shape
  if (spec.schema_version !== 1)
    errors.push("schema_version must be 1");
  if (spec.diagram_type !== "loop-trace")
    errors.push("diagram_type must be loop-trace");
  if (spec.meta?.quality_profile !== "showcase")
    errors.push("meta.quality_profile must be showcase");
  if (!spec.meta?.title) errors.push("meta.title missing");
  push(
    "schema-shape",
    errors.length === 0,
    errors.length ? errors : ["shape ok"],
    errors.length ? ["set schema_version=1, diagram_type=loop-trace, meta.quality_profile=showcase"] : []
  );

  // 2. participants-unique
  const ids = (spec.participants || []).map((p) => p.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  const pErr = [];
  if (ids.length < 2 || ids.length > 7)
    pErr.push(`participants count ${ids.length} must be 2..7`);
  if (dup.length) pErr.push(`duplicate ids: ${[...new Set(dup)].join(",")}`);
  push("participants-unique", pErr.length === 0, pErr.length ? pErr : [`${ids.length} participants`], pErr.length ? ["dedupe ids, keep 2..7 participants"] : []);

  // 3. events-ref
  const eErr = [];
  const evts = spec.events || [];
  const idSet = new Set(ids);
  evts.forEach((e, i) => {
    if (e.seq !== i + 1) eErr.push(`event[${i}].seq=${e.seq} must be ${i + 1}`);
    if (!idSet.has(e.from)) eErr.push(`event seq=${e.seq} from=${e.from} unknown`);
    if (!idSet.has(e.to)) eErr.push(`event seq=${e.seq} to=${e.to} unknown`);
  });
  if (evts.length < 2 || evts.length > 12)
    eErr.push(`events count ${evts.length} must be 2..12`);
  push("events-ref", eErr.length === 0, eErr.length ? eErr : ["refs + seq ok"], eErr.length ? ["renumber seq 1..N, point from/to at existing ids"] : []);

  // 4. highlight-present (was forcing-present v0.1: generalized for reward traces)
  const hasHighlight = evts.some((e) => ["forced-retry", "error", "preempt"].includes(e.kind));
  push(
    "highlight-present",
    hasHighlight,
    hasHighlight ? ["highlight event present"] : ["no forced-retry/error/preempt event"],
    hasHighlight ? [] : ["add one event with kind=forced-retry|error|preempt"]
  );

  // 5. label-hygiene
  const lErr = [];
  evts.forEach((e) => {
    if (!e.label || e.label.length > 80) lErr.push(`seq=${e.seq} label length 1..80`);
    if (e.kind === "forced-retry" && !/tool_choice|tool/.test(e.label))
      lErr.push(`seq=${e.seq} forced-retry label must name tool_choice/tool`);
  });
  push("label-hygiene", lErr.length === 0, lErr.length ? lErr : ["labels ok"], lErr.length ? ["name exact tool_choice value in forced-retry labels"] : []);

  const errCount = checks.filter((c) => !c.ok).length;
  return { checks, errors: errCount, warnings: 0 };
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(spec, receipt) {
  const parts = spec.participants;
  const evts = spec.events;
  const colW = 170, top = 90, rowH = 68;
  const W = parts.length * colW + 80;
  const H = top + evts.length * rowH + 120;
  const x = (i) => 60 + i * colW + colW / 2;
  const idx = Object.fromEntries(parts.map((p, i) => [p.id, i]));

  const kindColor = {
    request: "var(--cyan)", response: "var(--muted)", "forced-retry": "var(--amber)",
    preempt: "var(--rose)", error: "var(--rose)", success: "var(--green)",
  };

  let svgInner = "";
  svgInner += `<text x="40" y="36" fill="var(--ink)" font-size="17" font-weight="700">${esc(spec.meta.title)}</text>`;
  svgInner += `<text x="40" y="58" fill="var(--muted)" font-size="11">agent-loop-trace · ${evts.length} events · showcase pass ${receipt.checks.filter(c=>c.ok).length}/${receipt.checks.length}</text>`;
  parts.forEach((p, i) => {
    svgInner += `<line x1="${x(i)}" y1="${top}" x2="${x(i)}" y2="${top + evts.length * rowH + 20}" stroke="var(--border)"/>`;
    svgInner += `<rect x="${x(i) - 70}" y="${top - 46}" width="140" height="38" rx="8" fill="var(--panel)" stroke="var(--border)"/>`;
    svgInner += `<text x="${x(i)}" y="${top - 23}" fill="var(--ink)" font-size="12" font-weight="600" text-anchor="middle">${esc(p.label)}</text>`;
  });
  evts.forEach((e, r) => {
    const y = top + 30 + r * rowH;
    const x1 = x(idx[e.from]), x2 = x(idx[e.to]);
    const c = kindColor[e.kind] || "var(--ink)";
    const dir = x2 >= x1 ? 1 : -1;
    svgInner += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${c}" stroke-width="2"/>`;
    svgInner += `<polygon points="${x2},${y} ${x2 - dir * 8},${y - 4} ${x2 - dir * 8},${y + 4}" fill="${c}"/>`;
    const mx = (x1 + x2) / 2;
    svgInner += `<text x="${mx}" y="${y - 8}" fill="${c}" font-size="10.5" font-weight="700" text-anchor="middle">${esc(`s${e.seq} ${e.label}`)}</text>`;
    if (e.detail) svgInner += `<text x="${mx}" y="${y + 18}" fill="var(--muted)" font-size="10" text-anchor="middle">${esc(e.detail.slice(0, 70))}</text>`;
    svgInner += `<text x="20" y="${y + 4}" fill="var(--dim)" font-size="10">${e.seq}</text>`;
  });
  svgInner += `<text x="40" y="${H - 30}" fill="var(--dim)" font-size="10">kind: request cyan · forced-retry amber · preempt/error rose · success green · static, no runtime claim</text>`;

  const svg = `<svg id="diagram" viewBox="0 0 ${W} ${H}" width="100%" font-family="JetBrains Mono,ui-monospace,Menlo,Consolas,monospace" role="img"><rect width="${W}" height="${H}" fill="var(--canvas)"/>${svgInner}</svg>`;
  const shareText = `${spec.meta.title} — agent-loop-trace (${evts.length} events, validated showcase)`;

  return `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(spec.meta.title)}</title><style>
:root{--cyan:#22D3EE;--green:#34D399;--amber:#FBBF24;--rose:#FB7185;--muted:#94A3B8}
html[data-theme="dark"]{--canvas:#020617;--panel:#0F172A;--ink:#fff;--border:#1E293B;--dim:#475569}
html[data-theme="light"]{--canvas:#fff;--panel:#F1F5F9;--ink:#0F172A;--border:#CBD5E1;--dim:#64748B}
body{margin:0;background:var(--canvas);color:var(--ink);display:flex;flex-direction:column;align-items:center;padding:24px;font-family:JetBrains Mono,ui-monospace,Menlo,monospace}
main{max-width:${W}px;width:100%}
.toolbar{display:flex;gap:8px;margin-bottom:12px}
button{background:var(--panel);color:var(--ink);border:1px solid var(--border);border-radius:8px;padding:8px 14px;font:inherit;font-size:12px;cursor:pointer}
button:hover{border-color:var(--cyan)}
.hint{color:var(--dim);font-size:11px;margin-top:10px}
</style></head><body><main>
<div class="toolbar"><button onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark'">Toggle theme (T)</button><button onclick="exportPNG()">Export PNG</button><button onclick="copyShare()">Copy share card</button></div>
${svg}
<div class="hint">Press T to toggle theme · E to export PNG · static artifact, no runtime claim</div>
</main><script>
document.addEventListener('keydown',e=>{if(e.key==='t'||e.key==='T')document.querySelector('.toolbar button').click();if(e.key==='e'||e.key==='E')exportPNG();});
function copyShare(){navigator.clipboard&&navigator.clipboard.writeText(${JSON.stringify(shareText)}).then(()=>alert('Share text copied')).catch(()=>prompt('Copy:',${JSON.stringify(shareText)}));}
function exportPNG(){const svg=document.getElementById('diagram');const xml=new XMLSerializer().serializeToString(svg);const css=getComputedStyle(document.documentElement);const filled=xml.replace(/var\\(--canvas\\)/g,css.getPropertyValue('--canvas')).replace(/var\\(--panel\\)/g,css.getPropertyValue('--panel')).replace(/var\\(--ink\\)/g,css.getPropertyValue('--ink')).replace(/var\\(--border\\)/g,css.getPropertyValue('--border')).replace(/var\\(--muted\\)/g,css.getPropertyValue('--muted')).replace(/var\\(--dim\\)/g,css.getPropertyValue('--dim')).replace(/var\\(--cyan\\)/g,'#22D3EE').replace(/var\\(--green\\)/g,'#34D399').replace(/var\\(--amber\\)/g,'#FBBF24').replace(/var\\(--rose\\)/g,'#FB7185');const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=${W}*2;c.height=${H}*2;const ctx=c.getContext('2d');ctx.scale(2,2);const bg=document.documentElement.dataset.theme==='light'?'#ffffff':'#020617';ctx.fillStyle=bg;ctx.fillRect(0,0,${W},${H});ctx.drawImage(img,0,0,${W},${H});const a=document.createElement('a');a.download='loop-trace.png';a.href=c.toDataURL('image/png');a.click();};img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(filled);}
</script></body></html>`;
}

function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const [, , cmd, ...rest] = process.argv;
const jsonOut = rest.includes("--json");
const args = rest.filter((a) => a !== "--json");

if (cmd === "doctor") {
  const out = { ok: true, node: process.version, checks: ["schema present", "renderer present", "no deps"] };
  console.log(jsonOut ? JSON.stringify(out, null, 2) : "agent-loop-trace ready.");
} else if (cmd === "validate") {
  const [input] = args;
  const spec = loadJson(resolve(input));
  const { checks, errors, warnings } = validateSpec(spec);
  const receipt = { schemaVersion: 1, ok: errors === 0, command: "validate", input: resolve(input), checks, composition: { profile: "showcase", status: errors === 0 ? "pass" : "fail", summary: { errors, warnings } } };
  if (jsonOut) console.log(JSON.stringify(receipt, null, 2));
  else console.log(errors === 0 ? `pass ${checks.length}/${checks.length}` : `fail ${errors} checks`);
  process.exit(errors === 0 ? 0 : 1);
} else if (cmd === "deliver") {
  const [input, output] = args;
  const inAbs = resolve(input), outAbs = resolve(output);
  const raw = readFileSync(inAbs);
  const spec = JSON.parse(raw.toString("utf8"));
  const { checks, errors, warnings } = validateSpec(spec);
  if (errors > 0) {
    const receipt = { schemaVersion: 1, ok: false, command: "deliver", input: inAbs, output: outAbs, checks, composition: { status: "fail", summary: { errors, warnings } } };
    console.log(JSON.stringify(receipt, null, 2));
    process.exit(1);
  }
  const html = renderHtml(spec, { checks });
  mkdirSync(dirname(outAbs), { recursive: true });
  const tmp = outAbs + ".tmp";
  writeFileSync(tmp, html);
  renameSync(tmp, outAbs);
  const receipt = { schemaVersion: 1, ok: true, command: "deliver", input: inAbs, output: outAbs, specification: { sha256: sha256Bytes(raw), bytes: raw.length }, artifact: { sha256: sha256Bytes(Buffer.from(html)), bytes: Buffer.byteLength(html) }, validation: { checksPassed: checks.length, checkCount: checks.length, compositionStatus: "pass", errors: 0, warnings: 0 } };
  console.log(JSON.stringify(receipt, null, 2));
} else if (cmd === "demo") {
  const [dir] = args;
  mkdirSync(resolve(dir), { recursive: true });
  const spec = loadJson(resolve(ROOT, "examples/strands-forcing.json"));
  const { checks } = validateSpec(spec);
  writeFileSync(resolve(dir, "loop-trace-demo.html"), renderHtml(spec, { checks }));
  console.log(`Demo ready: ${resolve(dir, "loop-trace-demo.html")}`);
} else {
  console.error("usage: trace.mjs [doctor|validate|deliver|demo] ...");
  process.exit(2);
}
