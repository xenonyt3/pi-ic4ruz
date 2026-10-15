# Reasoning continuation: reason-ui.3

Selected candidate: `1.0.0+reason-ui.3`, existing `transcript-hook-v1` selector.
The user authorized continued UI implementation. Parent is the sole source writer;
independent review is read-only. Fork, clean baseline and installed stock runtime
remain separate. No paid inference, Reason service or production Brain connection.

## Proven gap and scope

Reason CLI 0.2.269 source oracle B0A/deI uses a content-derived collapsed summary,
three-column indentation, and dim/italic expanded Markdown. The last bold heading
becomes the summary; otherwise the first nonempty line is used. Host display starts
with reasoning disabled and showEntry only attaches consecutive tool rows.
Pi previously used a static label, one-column thinking padding and visible default.
`reasoning-gap.json` records 12 hook-disabled differences and the missing blank row
between text and following reasoning, captured before its spacing fix.

The isolated optional ThinkingRenderer changes only presentation inside the
existing MouseRegion. It receives actual contiguous thinking content plus expansion,
streaming state, outputPad and an upstream Markdown-transform callback. Expanded
rendering calls transformers with the actual usable width. Invalid/throwing hooks
fall back to stock; reset, resume, fork and reload retain upstream lifecycle.
Opaque signatures and message JSON remain unchanged.

A successful custom thinking render inserts a blank row when the previous visible
block is text. Stock fallback and tool boundaries retain their original behavior.
This does not reconstruct Reason entry keys, merge arbitrary messages or reorder tools.
Reason host apply also ignores empty assistant/reasoning events; the previous
raw-component empty-row discrepancy is not evidence of a host-level divergence.

## Verification

- TypeScript 5.9.3 strict/noEmit checks all four patched implementation files:
  zero diagnostics. Candidate declarations are used; skipLibCheck is enabled, so
  this is not a whole-monorepo typecheck. See `typecheck.json` hashes/options.
- Seven focused thinking tests pass: exact source rows, per-run summary/stream
  updates, malformed callback fallback, text/thinking separation, transformer
  width, mouse/global toggle, original signed content, resize and NO_COLOR.
- `thinking-parity.json`: **96/96 PASS**, six samples across dark/light,
  80/120 columns, collapsed/expanded and streaming/completed states. This is
  deterministic source replay using Pi Markdown helpers, not live Reason capture.
- Existing assistant/user parity still passes **80/80** and **16/16**.
- Real SDK InteractiveMode uses the production adapter and receives two thinking
  deltas followed by two text deltas. Summaries update; toggle, renderer failure,
  reset, resume, fork and reload pass without rewriting stored/model content.
- Final command `node scripts/verify-offline.mjs --suite all`: **143/143 PASS**,
  including 35 UI tests, zero failures/cancellations/skips. Report:
  `artifacts/verification/runs/2026-10-15T03-03-34.532Z/report.json`.
  Aggregate passed; source, both runtimes, baseline/fork and vault unchanged,
  complete receipts and zero unexpected network attempts. The baseline audit
  checked 5,599 protected files plus one tool source. No prototype Node process
  remained after completion.

## Native and visual evidence

Windows ConPTY 120x40 resumed an owned synthetic session, displayed the collapsed
summary, expanded Unicode detail on Ctrl+T, collapsed again on Ctrl+T and exited 0
on Ctrl+D. Prototype resume hint remained isolated. Evidence:
`artifacts/ui-replay/windows-pty-thinking-hook.json`. This is actual Pi terminal
behavior without model requests, not a Reason session or live provider evaluation.

The replay gallery contains 40 frames. `thinking-expanded-light-120.png` and
`thinking-after-text-80.png` were inspected: body/summary hierarchy, three-column
reasoning indent, spacing and Unicode remain legible. Images are synthetic browser
replays; ANSI faint is approximated with CSS opacity. Mechanical layout scan
returned `[]` but is not a terminal-parity proof. The isolated browser was closed.

Independent read-only review inspected code, native receipt and both PNGs and
found no remaining material issue in this bounded slice. The persistent-visibility
rollback caveat was documented; reviewer ran no tests and made no edits.

## Differences and rollback

Prototype settings now default `hideThinkingBlock:true`. Pi Ctrl+T persists this
preference; Reason toggles its display state in memory. Click toggles stay per-run.
Disabling the adapter or selecting stock preserves that preference; set
`agent/settings.json` hideThinkingBlock to false and restart to restore Pi's original
expanded default. No message content is removed by hiding a block.

`ui.reasonTerminal=false` disables presentation hooks on restart. Runtime selector
`stock` returns to the unmodified stock installation. v2 evidence remains in
`history/reason-ui.2/`. Contiguous thinking grouping, whole transcript/tool composition,
splash/shimmer/menus, native color autodetection and live Reason timing remain open.
