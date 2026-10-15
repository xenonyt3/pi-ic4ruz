# I22: content-order transcript and adjacent tools

Active candidate: `1.0.0+reason-ui.4`, using the existing `transcript-hook-v1`
selector. This is the user's approved I22 continuation in the isolated prototype.
No installed stock package, clean/fork profile or launcher is patched. No paid
inference, live campaign, Reason server or production Brain connection is used.

## Gap and scope

`layout-gap.json` preserves 12 actual SDK InteractiveMode cases at 80/120 columns
before the patch. Pi emitted all assistant text before separately appended tools,
omitted spacing between adjacent text blocks, and inserted a blank before every
tool. The custom user renderer had no transcript-level leading spacer.
Reason 0.2.269 `FeA.showEntry`/`B0A` preserves entry order and attaches a tool only
when the preceding visible entry is also a tool.

The source oracle now extracts and directly replays `showEntry` with a minimal
offline host. Binary/source hashes still match the original audit. The proprietary
extracted code remains local; no Reason entrypoint or service is loaded.
Existing text/tool renderers cannot change host ordering/structural tool spacers,
so the gap requires a bounded optional layout API in the separate candidate.

## Implementation

- Optional `setTranscriptLayout('content')`; undefined retains Pi ordering.
- Assistant components expose presentation parts in original content order,
  referencing existing text/thinking MouseRegions and tool IDs. Standalone
  rendering stays unchanged; OSC133 zones stay Pi-owned.
- `TranscriptContainer` projects original flat children into visible slots. The
  same tool objects remain in Pi's lifecycle container for results, expansion,
  image conversion and cleanup. Stored/model messages and tool execution order
  are untouched. No tool executes again or receives a duplicated result.
- Each visible entry gets one structural blank, except adjacent tool entries.
  Empty blocks do not split tools. Orphan/duplicate tool objects remain visible.
  Mouse coordinates use the same spacer offset as rendered rows.
- Failed layout restores original children and schedules one warning. Reset and
  unload clear the opt-in. Existing resume/fork/reload paths retain lifecycle.
- Result `isError` wins over stale running/done presentation state, including
  aborted tools. It cannot keep a misleading running-color header.

Five TypeScript files are checked: retained user-message, assistant-message,
interactive-mode, extensions/types and new transcript-container. The v3 source,
build script, patch/pin and verification snapshot is under `history/reason-ui.3/`.

## Tested

Eight focused tests PASS using `node --import ./src/offline-guard.mjs --test
tests/transcript-layout.test.mjs`. `layout-parity.json` records 96 comparisons:
six mixed-block cases, dark/light, collapsed/expanded reasoning, 8/32/80/120 columns.
Comparison removes ANSI/OSC and trailing surface padding. It proves visible order
and spacing, not byte-identical full-terminal output. Individual renderer checks
also pass: 16 user, 80 assistant and 96 reasoning fixtures.

Coverage includes real AgentSession interleaved streaming/read results, component
identity through expansion, resume with unchanged model messages/signatures,
mouse reasoning toggles, error/abort rows, reset/reload/fallback, orphan/duplicate
IDs, NO_COLOR, image payload preservation and existing edit diff rendering.

`node scripts/typecheck-candidate.mjs`: five files, zero diagnostics. This uses
skipLibCheck and candidate declarations, not a whole-monorepo typecheck. Build is
esbuild. `build.mjs --compile-only` is an explicitly unpinned development output;
final launch/acceptance uses the full rebuilt and pinned candidate.

Final `node scripts/verify-offline.mjs --suite all`: **159/159 PASS**, including 51
UI tests, zero failed/cancelled/skipped. Source and both runtimes remained unchanged
during the run; 5,599 protected baseline/fork files plus one tool source and the
vault remained unchanged. Network receipts are complete; unexpected attempts: 0.
Report: `artifacts/verification/runs/2026-10-15T07-28-50.699Z/report.json`.

The first full run (`2026-10-15T07-19-38.166Z`) is retained as **158/159**, not PASS.
All 51 UI tests passed. The existing atomic child-reservation fixture failed when
Windows rejected the Task 5 receipt rename with EPERM; the supervisor correctly
returned zero started children and recorded failed/cleanup-confirmed. The lock
holder is unknown. Its six-test delegation file passed on a focused rerun without
source changes. The second full run passed without changing delegation logic or
weakening an assertion. The original filesystem failure is not erased or relabeled.

## Native and visual evidence

`artifacts/ui-replay/windows-pty-transcript-layout.json` records actual Windows
ConPTY with an owned synthetic session and zero model requests. Content order and
visible error pass. Ctrl+O expands both tool results and collapses them; Ctrl+T
expands Unicode reasoning and collapses it. Resize 120x40 -> 80x24 -> 32x16 ->
120x40, multiline input/clear and Ctrl+D exit 0 pass. Message records and final
prototype settings stay unchanged.

The first native checker incorrectly required an identical whole journal hash.
Initial resume legitimately appended Pi `thinking_level_change` and harness
`prototype_owner_branch` metadata. The corrected assertion preserves the existing
record prefix and all message records, allowing only non-message resume metadata.
The successful rerun appended no additional metadata.

The gallery has 54 synthetic frames; six new frames use the actual SDK transcript
container. Three complete PNGs were inspected: `layout-interleaved-80.png`,
`layout-tools-light-120.png`, `layout-expanded-80.png`. Tool groups and mixed text
are legible. Expanded body rendering intentionally remains upstream. These are
browser previews using Consolas, not live Reason or physical terminal screenshots.
Mechanical scan returned `[]`; no independent reviewer is claimed for this slice.

## Limits and rollback

The demonstrated top-level order/spacing gap is closed. Whole UI equivalence is
not claimed. Nested codemode tool composition, notices/compaction/branch cards,
scroll behavior, thinking-run coalescing, expanded body/diff/image renderers and
cancel semantics remain Pi-specific. Menus, native color autodetection and live
Reason frames/timing remain unknown. O14 overall is still partial.

Set `ui.reasonTerminal=false` and restart for stock presentation. Select runtime
`stock` for the unmodified installed package. Clearing only the layout API restores
Pi order while retaining whatever individual renderers remain installed. Persisted
thinking visibility is not reset by presentation rollback.
