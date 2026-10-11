// Zero-dependency smoke + regression suite for agent-loop-trace.
// Run with: npm test   (Node >= 18, built-in node:test runner)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "bin", "trace.mjs");
const EXAMPLES = ["examples/strands-forcing.json", "examples/dspy-reward.json"];

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      encoding: "utf8",
      cwd: ROOT,
    });
    return { code: 0, stdout };
  } catch (error) {
    return { code: error.status ?? 1, stdout: String(error.stdout ?? "") };
  }
}

test("doctor reports a ready toolchain", () => {
  const r = run(["doctor", "--json"]);
  assert.equal(r.code, 0);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.deepEqual(out.checks, ["schema present", "renderer present", "no deps"]);
});

for (const example of EXAMPLES) {
  test(`validate passes for ${example}`, () => {
    const r = run(["validate", example, "--json"]);
    assert.equal(r.code, 0);
    const receipt = JSON.parse(r.stdout);
    assert.equal(receipt.ok, true);
    assert.equal(receipt.composition.status, "pass");
    assert.equal(receipt.composition.summary.errors, 0);
  });

  test(`deliver renders a self-contained HTML for ${example}`, () => {
    const out = join(mkdtempSync(join(tmpdir(), "loop-trace-")), "trace.html");
    const r = run(["deliver", example, out, "--json"]);
    assert.equal(r.code, 0);
    const receipt = JSON.parse(r.stdout);
    assert.equal(receipt.ok, true);
    assert.match(receipt.artifact.sha256, /^[0-9a-f]{64}$/);
    const html = readFileSync(out, "utf8");
    assert.match(html, /<svg id="diagram"/);
    assert.match(html, /data-theme="dark"/);
    assert.match(html, /static artifact, no runtime claim/);
  });
}

test("validate rejects a spec that breaks a check", () => {
  const bad = join(mkdtempSync(join(tmpdir(), "loop-trace-bad-")), "bad.json");
  const spec = JSON.parse(readFileSync(join(ROOT, EXAMPLES[0]), "utf8"));
  spec.participants = [spec.participants[0]]; // violates the 2..7 participants check
  writeFileSync(bad, JSON.stringify(spec));

  const r = run(["validate", bad, "--json"]);
  assert.equal(r.code, 1);
  const receipt = JSON.parse(r.stdout);
  assert.equal(receipt.ok, false);
  assert.ok(receipt.composition.summary.errors > 0);
});

test("deliver refuses to render an invalid spec", () => {
  const dir = mkdtempSync(join(tmpdir(), "loop-trace-refuse-"));
  const bad = join(dir, "bad.json");
  const spec = JSON.parse(readFileSync(join(ROOT, EXAMPLES[0]), "utf8"));
  spec.events = spec.events.slice(0, 1); // violates the 2..12 events check
  writeFileSync(bad, JSON.stringify(spec));

  const r = run(["deliver", bad, join(dir, "out.html"), "--json"]);
  assert.equal(r.code, 1);
  const receipt = JSON.parse(r.stdout);
  assert.equal(receipt.ok, false);
});
