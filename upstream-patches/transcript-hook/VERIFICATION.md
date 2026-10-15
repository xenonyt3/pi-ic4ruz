# Isolated user-message hook: implementation and evidence

Historical v1 milestone. Current candidate is `1.0.0+reason-ui.3`; assistant-text
and reasoning implementation, scoped typecheck and acceptance are documented in
`ASSISTANT-VERIFICATION.md` and `THINKING-VERIFICATION.md`. v1 patch/provenance/manifest/parity/typecheck/audit
snapshots are preserved under `history/reason-ui.1/`.

The user approved continuing the bounded patch after the stock gap was reproduced.
Runtime at this milestone: `1.0.0+reason-ui.1`, selector `transcript-hook-v1` in
`config/runtime-selection.json`. Original runtime remains at `runtime/`.

## Build and provenance

- `prepare.mjs` extracts three TypeScript files from pinned published source maps
  and copies the SDK/dependencies to `build/`. `source-provenance.json` records
  input paths and hashes; `source-original/` preserves the original text.
- `source/` changes the optional ExtensionUIContext setter, UserMessageComponent
  fallback/validation/terminal zones, and InteractiveMode lifecycle wiring.
  A Windows resume-hint fix uses the fixed prototype launcher with safely quoted
  absolute session paths instead of the global pi command.
- `node upstream-patches/transcript-hook/build.mjs` transpiles the two runtime
  TypeScript files with the existing pinned esbuild, adjusts declarations and
  package metadata, writes `transcript-hook.patch`, and pins 26,944 candidate files
  in `config/runtime-candidate.json`. This is not a full TypeScript typecheck.
- No npm install, symlink, installed node_modules patch, Reason service or paid
  inference was used. Rebuilding intentionally regenerates the candidate manifest;
  normal startup verifies it and must not regenerate it to bless drift.
- `scripts/pin-runtime.mjs` explicitly selects stock; candidate pinning belongs
  to the isolated build. Startup hashes the selected execution tree and shared
  control files; the offline runner audits both candidate and inactive stock.

## Tested

- Guarded focused suite: 7/7 tests passed. Stock absent/undefined hook is identical;
  literal text, Unicode, wrapping, measured surface and OSC133 zones are covered.
  Malformed/throwing output falls back; control text is sanitized for presentation.
- Actual SDK interactive host verifies reset, resume, fork, extension reload,
  renderer-error fallback/warning and unchanged model transcript.
- Selector rejects arbitrary roots; changed candidate execution bytes fail hash
  validation. Windows resume command preserves apostrophes and prototype identity.
- `node scripts/verify-transcript-parity.mjs`: `parity.json` has 16/16 matching
  actual component/source-oracle cases at 80/120 columns. This is deterministic
  replay against Reason CLI 0.2.269 source, not a live Reason capture.
- Final command: `node scripts/verify-offline.mjs --suite all`, run from the
  prototype workspace. **129/129 PASS**, including 21 UI tests, with zero failures,
  cancellations or skips. Report:
  `artifacts/verification/runs/2026-10-15T02-14-35.351Z/report.json`.
  Source, both runtime trees, baseline/fork and vault unchanged; network receipts
  complete, unexpected network attempts zero, aggregate gate passed.

## Runtime-verified

Windows ConPTY 120x40 resumed a synthetic local session and displayed literal
Markdown punctuation plus Unicode with Reason-style user marker/indentation.
Ctrl+D exited 0. Final hint uses the prototype launcher and absolute session file.
Receipt: `artifacts/ui-replay/windows-pty-user-hook-final.json`. The earlier
`windows-pty-user-hook.json` predates the hint fix and is retained as history.
No model request was made; Brain production remains off.

## Limits and rollback

Read-only independent review found no material remaining code issue and inspected
the final native receipt directly. Earlier stale proposal-only documentation and
the old native resume hint were corrected. The reviewer ran no tests and made no
workspace edits; parent remained the sole writer.

Whole transcript, splash, shimmer, menus, native color autodetection and live
Reason visual parity remain unverified/partial. Synthetic dark/light PNGs are
prototype fixtures. Full TypeScript checking has not been performed. Hashing the
active copied tree adds startup latency (observed about 22.5 seconds in this run).

Set `ui.reasonTerminal=false` in `config/harness.json` and restart to disable the
adapter/hook. Select `{"runtime":"stock"}` in `config/runtime-selection.json`
and restart to restore the original runtime. Sessions/receipts are retained.
