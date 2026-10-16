# Codex/Pi v1: interrupted at the first Codex turn

The user explicitly approved the fresh 12-cell allowance: 144 requests,
2880000 input tokens, 288000 output tokens, 2000 output/request, 60 minutes total
and 5 minutes/cell, with both conditions through 9router.

Campaign `codex-pi-v1-20261016` ran once at source commit
`e521a9ded615342936017531f7bc90501bf75e0e`, using frozen protocol hash
`9d804700a46ccbbb33f4ddc13f61183c11bc3a60794c7e1d0b1dbaaf97662fde`.
The gate stopped it at `invoice-codex-1`; all 11 other cells remain unstarted.
Public receipt: `artifacts/checkpoint/codex-pi-live-v1.json`.

| Observation | Result |
| --- | ---: |
| Physical provider requests | 1 |
| Accounted input tokens, including cached input | 11794 |
| Cached input subset | 2304 |
| Accounted output tokens | 108 |
| Provider response | HTTP 200, `gpt-6-astra` allowed alias |
| Request duration | 6450 ms |
| Whole campaign duration | 9254 ms |
| Native command executions | 1, successful read |
| Workspace file changes | 0 |
| Valid paired comparisons | 0 |

The model announced it would inspect the contract and implementation, then used
native PowerShell to read the task files and Git status. That command completed.
The broker then stopped with `CODEX_BROKER_REJECTED`, and the owned process tree
was terminated with confirmed cleanup. The writer lease and ledger lock were
released. The ledger preserved actual provider usage, with no reservation refund,
reset, automatic rerun or follow-up paid request. Monetary cost is unknown.

There is **no Codex-versus-Pi quality or cost result**. Pi was never dispatched,
and the Codex task was interrupted before edits or task verification. An unchanged
starting fixture failing its trusted assertions is not a measurement of Codex's
ability to solve the task. The initial assistant message was a progress statement,
not a claim that the task was completed.

## Adapter diagnosis and offline correction

The original broker waited for HTTP EOF even after a terminal Responses event.
Native Codex can close its response reader after `response.completed`. If the
upstream body is still open, that disconnect causes the broker's reader to throw;
the broker then stopped the entire campaign despite having valid terminal usage.

A native synthetic reproduction with terminal usage and an upstream body that
does not send EOF reproduced the same one-request stop. The corrected broker
ends at the terminal event and releases the upstream reader. A close after
`response.completed` is benign only when every request is accounted and the
budget gate has no stop reason. Unknown usage, model mismatch, overshoot and
pre-completion cancellation still stop conservatively.

The original live socket exception text was not retained, so its precise socket
error is unknown. The defect and matching failure signature are reproduced
offline; the correction has not been tested with another paid request.

Protocol **codex-pi-v2** keeps the same corpus, conditions and quota ceilings but
changes the broker/terminal-event accounting behavior. Its native fixture adds
an open-upstream completion case; two consecutive model turns complete and both
upstream readers are released. The 12 scripted reference-edit cells pass again.
These are plumbing checks, not model-quality results.
V2 passes **198/198 full offline acceptance**, including the broker helper's
terminal-before-EOF regression. Separate checks pass six native synthetic
scenarios and 17 preparation assertions. See
`artifacts/checkpoint/codex-pi-verification.json`; there is no
additional paid inference in this verification.

## Integrity and next step

Before changing source, the evaluated acceptance hashes still matched, the
original baseline and both pinned runtimes passed the post-run preparation,
and the prepared hash still matched v1. All 289 tracked Markdown vault files
matched the pre-request snapshot. A scan of 47 private campaign/workspace files
found no occurrence of the configured provider credential. Raw native state,
events, ledgers and workspaces remain private under `PUBLICATION.md`.

This is Codex trace analysis, not independent human review; human rubric fields
remain unreviewed. The v1 allowance is closed for this completed attempt. V2
requires its own explicit authorization after offline verification. Do not replay
v1, reuse its remaining allowance, or call these results a model win/loss.
