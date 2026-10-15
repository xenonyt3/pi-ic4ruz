# Assistant text continuation: reason-ui.2

Historical v2 milestone. Current candidate is `1.0.0+reason-ui.3`; see
`THINKING-VERIFICATION.md`. v2 source/manifest/patch/typecheck/parity evidence is
preserved in `history/reason-ui.2/`. Later source inspection confirms Reason host
also suppresses empty assistant/reasoning events before creating rows.

The user authorized the next step: typecheck the isolated candidate, compare
assistant/streaming presentation against Reason source, implement demonstrated
gaps and verify offline. The selected candidate is `1.0.0+reason-ui.2` under the
existing `transcript-hook-v1` selector. Stock runtime/fork/clean baseline remain
separate. No Reason service, production Brain connection or model inference was used.

## Evidence and implementation

The source oracle is Reason CLI 0.2.269 `B0A`, with unattached assistant rows:
raw Markdown, one-column padding and one leading blank row. Reason host `showEntry`
only attaches consecutive tool rows. Pi already shares the basic assistant layout.
The hook-disabled comparison found concrete differences: Pi trims raw assistant
text, so leading four-space code indentation becomes prose; quote/fence styling
also differs. The initial audit is preserved under `history/reason-ui.1/`.
`scripts/audit-assistant-parity.mjs` explicitly reports the hook-disabled baseline;
it is not evidence of enabled candidate parity.

Implemented an optional `setAssistantTextRenderer` hook on the isolated candidate:

- Only nonempty assistant text blocks use the custom callback. Upstream container,
  thinking visibility, tool boundaries, stop/error notices and OSC133 zones remain.
- Raw indentation, tabs and surrounding whitespace survive presentation. Pi's
  Markdown parser still handles Markdown, wrapping, tables and partial syntax;
  quote italics and inherited code foreground follow the Reason source palette.
- Upstream Markdown transformers run with streaming state and usable width.
  Renderer receives outputPad; default 1 matches Reason while custom 0/3 settings
  remain respected. No model/session text is rewritten.
- Invalid output or exceptions fall back to stock, disable the faulty hook and
  defer one warning. Reset/unload clears the callback; resume/fork/reload reinstall it.
- Candidate manifest pins 26,946 files including all four patched source files,
  original extracted sources, three compiled modules, dependencies and build inputs.
  Startup requires both patched user/assistant modules in the manifest.

## Typecheck and tests

`node scripts/typecheck-candidate.mjs` passes **four implementation TS files,
zero diagnostics**, using TypeScript 5.9.3 installed offline from the existing npm
cache into `tools/typecheck/`. It uses strict/noEmit/NodeNext with virtual source
overlays and the candidate's real declarations. `typecheck.json` records source,
compiler, tool lock and candidate manifest hashes. External declaration checking
is skipped (`skipLibCheck`); this is not a full upstream monorepo build/typecheck.
The runtime build still transpiles with pinned esbuild.

- Guarded focused assistant tests: **7/7 PASS**, covering stock byte compatibility,
  source comparisons, invalid hooks, transformer/streaming/padding behavior,
  reasoning/tools/error retention, resize, control sanitization and NO_COLOR.
- Existing hook tests: **7/7 PASS**, extended with the production UI adapter in a
  real SDK InteractiveMode host: two synthetic streamed deltas, user/assistant
  fallback, reset, resume, fork, reload and unchanged model content.
- `node scripts/verify-assistant-parity.mjs`: **80/80 PASS** nonempty text cases,
  ten samples across dark/light, 80/120 columns, streaming/completed states.
  `assistant-parity.json` is deterministic component replay, not live Reason capture.
- User-row regression: **16/16 PASS** in `parity.json`.
- Full offline acceptance: `node scripts/verify-offline.mjs --suite all`,
  **136/136 PASS**, including 28 UI tests; zero failures/cancellations/skips.
  Report `artifacts/verification/runs/2026-10-15T02-42-40.795Z/report.json`:
  aggregate passed, source/vault/baseline and both runtimes unchanged, receipts
  complete and unexpected network attempts zero. No prototype Node process remained
  after completion. The baseline audit checked 5,599 protected files and one tool source.

## Native and visual verification

`scripts/create-assistant-native-fixture.mjs` creates an owned synthetic session.
The real prototype launcher resumed it in Windows ConPTY 120x40 and showed raw
prompt punctuation, assistant code fences/indentation and Unicode. Multiline paste,
Ctrl+C input clear, Ctrl+D exit 0 and the isolated resume hint passed. This does not
claim native cancellation of a paid inference turn. Evidence:
`artifacts/ui-replay/windows-pty-assistant-hook.json`.

The gallery now has 32 frames; streaming/assistant scenes use the actual patched
component. `assistant-viewport-80.png` and `assistant-viewport-120.png` were inspected
with a scoped independent read-only review. Text, quote, code indentation and
prompt/footer hierarchy remained legible. These are synthetic HTML/ANSI replays,
not native or live Reason screenshots. The element-crop screenshot command produced
blank images; those were removed and viewport captures used instead. Mechanical
Impeccable layout scan returned `[]`; that web-oriented detector is supplementary
and does not establish terminal parity. The dedicated browser session was closed.

Review found no material remaining issue in this bounded scope. The earlier
padding concern was fixed and tested before source freeze; reviewer ran no tests
or writes. Parent remained the sole writer.

## Remaining differences and rollback

Empty/whitespace-only messages remain suppressed by Pi. Whole-transcript reasoning
and multi-block/tool ordering, splash, shimmer, menus, native color autodetection,
live Reason streaming timing and exact whole-UI parity remain open. Renderer uses
NO_COLOR to suppress its styling. Custom outputPad is a deliberate Pi setting.

Set `ui.reasonTerminal=false` and restart to disable both hooks and the adapter.
Select `{"runtime":"stock"}` in `config/runtime-selection.json` and restart to use
the preserved unpatched runtime. Historical v1 source/manifest/patch evidence is
retained; `stock` is the supported runtime rollback target. Sessions remain intact.
