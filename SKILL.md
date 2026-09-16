---
name: agent-loop-trace
description: Turn an agent event-loop trace into a validated sequence diagram as a single self-contained HTML. Use when the user asks to visualize tool_choice forcing, structured-output retry, provider built-in preemption, or Strands/DSPy-style loop bugs.
license: MIT
metadata:
  version: "0.1.0"
  author: you
---

# agent-loop-trace

Create a self-contained HTML sequence diagram from a small typed JSON trace. Static output only in v0.1.

## Fast authoring path

1. Choose participants (max 7): keep `event-loop` + `model` + `output-tool` always; add `provider` only when built-ins matter.
2. Read `schemas/loop-trace.schema.json` and one matching JSON in `examples/`. Use the example for field shape, not facts.
3. Artifact first: write the candidate JSON before reading renderer source. Start with one happy path + one failure branch, max 12 events.
4. Validate after every edit:

```bash
node bin/trace.mjs validate <candidate.json> --json
```

A pass must report all 5 checks with 0 errors. If validation fails, change only the diagnosed `subject`, pick from `supportedFixes`, rerun. Max 2 correction rounds, then report truthfully.

5. Deliver once for final acceptance:

```bash
node bin/trace.mjs deliver <candidate.json> <output.html> --json
```

Non-zero exit is never success. Delivery freezes spec bytes, renders, checks, atomically writes HTML, reports sha256 + bytes.

## Authoring invariants

- One obvious main path (top to bottom); side branch = provider built-in preemption.
- `meta.quality_profile` must be `"showcase"`.
- Event `seq` is 1..N strictly increasing; every `from`/`to` must reference an existing participant id.
- At least one event with `kind: "forced-retry"` when the story is about structured-output forcing.
- Never invent tool names: use exact `tool` names from logs (e.g. `ProductModel`).
- Labels are semantic: keep protocol/action/direction (`tool_choice: any` vs `tool: {name}`).

## Output

Return checked HTML path, validation summary, spec/artifact receipt. Do not claim visual inspection you did not perform.
