# Startup and working continuation - 15 October 2026

Implemented in the prototype only, using existing Pi UI APIs. Active runtime is
still `1.0.0+reason-ui.3`; no new candidate build or installed runtime modification.
Parent is the only writer. No paid inference, live campaign or production Brain.

## Source and design

Reason CLI 0.2.269 binary and readable source hashes match the previous audit.
`scripts/capture-reason-reference.mjs` now extracts Mh/lGA/uGA/asA/YeI, working and
startup host methods, and numeric constants into the existing source oracle.
The oracle never loads a Reason entrypoint or accesses a Reason service.

`src/ui-startup.mjs` implements braille raster/layout, 2400 ms damped startup
rotation, 1400 ms shimmer sweep + 500 ms pause, and lifecycle-owned timers.
`src/reason-ui.mjs` installs the header and above-editor widget through `setHeader`,
`setWidget` and `setWorkingVisible`. Actual events select Thinking, Writing or
Running tool. Seconds measure elapsed turn time; the cancel key is Pi's binding.

The source's logo/wordmark are replaced with an owned Pi silhouette/PI wordmark.
The narrow fallback says Pi. Version/provider/model/workspace come from actual
runtime/context, including model changes. These substitutions are intentional;
matching the Reason bitmap is not a goal or a claimed result.

The old custom editor swallowed upstream working/retry/compaction indicators.
Working now has its own widget; upstream retry/compaction indicators are rendered
above the editor. Input, transcript, tool execution and providers stay upstream.

## Tested

- Eight focused tests pass with `node --import ./src/offline-guard.mjs --test
  tests/startup-working.test.mjs`. Source replay includes 80 exact shimmer and
  160 exact working-row comparisons, 9 raster comparisons and 35 responsive layout
  comparisons with explicit Pi asset/name substitution. Widths span 1-120 columns,
  height thresholds 16-40 rows, dark/light, Unicode, NO_COLOR and timing boundaries.
- Fake clocks prove settlement, early stop, idle/dispose/failure cleanup, no
  duplicate timers and no redraw for identical visible frames during the pause.
  Adapter tests cover overlapping tools, failed tools, terminal-state preservation,
  new sessions, fallback and late callbacks.
- Actual SDK InteractiveMode runs deterministic assistant thinking/text streams,
  tool execution, successful completion, provider error and abort. Working rows
  are visible in the real widget slot; each completed turn leaves zero adapter
  animation timers. Restore reenables stock working visibility. No model requests.
- `node scripts/typecheck-candidate.mjs`: four existing patched TypeScript files,
  zero diagnostics. New adapter JavaScript is exercised by tests; this remains a
  scoped patch check with skipLibCheck, not a full monorepo typecheck.
- Initial UI run retained as failed evidence: 41/42, because the narrow oracle
  still expected the literal Reason product name. The assertion now explicitly
  substitutes only that label; the focused suite passes. No source oracle was
  changed to mimic a renderer defect.

`node scripts/verify-offline.mjs --suite all`: **151/151 PASS**, including 43 UI
tests, zero failures/cancellations/skips. Aggregate passed; source and both runtime
trees unchanged, 5,599 protected baseline/fork files plus one tool source unchanged,
vault unchanged, complete network receipts and zero unexpected network attempts.
Report: `artifacts/verification/runs/2026-10-15T03-37-40.526Z/report.json`.
No prototype Node or native verification Electron process remained at the final
process check. Mechanical detector over both UI modules returned `[]`; that is
not a terminal-parity proof.

## Runtime-verified on Windows

`artifacts/ui-replay/windows-pty-startup-working.json` records actual ConPTY output,
separate SDK-host frames, assertions and exit codes. This is synthetic/offline Pi
runtime evidence, not live Reason or paid-provider evidence.

- SDK host: idle -> thinking -> writing -> Running read -> complete; next turns
  exercise provider error and actual Escape cancellation. Unicode survives.
  Resize 120x40 -> 80x24 -> 120x40 during streaming passes. All terminal states
  clear the widget and leave zero animation timers; stock restoration passes.
- Production launcher: actual `Pi 1.0.0+reason-ui.3`, `9router/cx/gpt-6-sol` and
  owned workspace appear. Resize 120x40 -> 80x24 -> 32x16 -> 120x40, bracketed
  multiline Unicode paste, Ctrl+C clear and Ctrl+D exit 0 pass.
- Native harness uses the existing VS Code Electron runtime/node-pty read-only;
  it installs nothing and changes no VS Code, clean Pi or fork profile. The first
  harness attempts exposed Windows import-URL and ConPTY PID-reporting differences;
  the final helper uses file URLs and its own fresh progress receipt.

Reproduce using the locally installed VS Code asar location (version directory
can change), from PowerShell in the prototype:

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& 'C:\Users\M S I\AppData\Local\Programs\Microsoft VS Code\Code.exe' `
  'D:\pi-reason-prototype\scripts\verify-native-startup.cjs' `
  'C:\Users\M S I\AppData\Local\Programs\Microsoft VS Code\16507d91be\resources\app\node_modules.asar\node-pty' `
  'C:\Program Files\nodejs\node.exe' | Out-String
```

## Visual inspection and limits

`node scripts/render-ui-fixtures.mjs` generates 48 frames at 80x24 and 120x40.
Four complete browser-rendered PNGs were inspected: `startup-80.png`,
`startup-turn-120.png`, `working-light-80.png`, `working-tool-120.png` under
`artifacts/ui-replay`. Text remains legible and the working row/editor/footer fit.
Consolas and synthetic colors are preview choices. Initial offscreen browser clips
were blank; final captures use standalone review pages. These are not terminal
screenshots. No claim of independent review is made for this slice.

Unknown: live Reason timing/font/frames, physical terminal color autodetection,
whole-transcript grouping/tool composition and Reason-specific menus. Pi retains
its own footer and scroll layout, cancel semantics, context estimates and persisted
thinking visibility. Startup animates an empty branch; an empty resumed branch can
therefore animate too. Reason uses its own fresh-session flag. Source idle tips,
service/account information and unsupported features are not advertised.

O14 remains partial. Disable `ui.reasonTerminal` and restart to restore stock
presentation; runtime selector `stock` still selects the unmodified installed Pi.
Existing thinking visibility preference is not reset by that rollback.
