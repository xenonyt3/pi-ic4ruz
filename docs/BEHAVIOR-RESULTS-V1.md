# I24 v1: live comparison and trace review

The authorized campaign `behavior-astra-v1-20261016` ran once against 9router
`cx/gpt-6-astra` at low effort, using source commit `ac12d83` and the frozen
[v1 protocol](BEHAVIOR-EVALUATION-V1.md). All 12 cells passed the original trusted
verifiers and file-scope checks, with confirmed cleanup and accounted usage.
Receipt: `artifacts/checkpoint/behavior-live-v1.json`. Raw sessions, final answers
and tool traces remain private.

| Condition | Task passes | Requests | Input tokens | Output tokens | Cached input | Sum of cell wall time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Stock-core | 6/6 | 44 | 179923 | 7356 | 63616 | 325.754 s |
| Prototype | 6/6 | 39 | 188724 | 8097 | 68992 | 296.945 s |
| Total | 12/12 | 83 | 368647 | 15453 | 132608 | 622.699 s |

Campaign wall time was 623.469 seconds including orchestration. The approved
ceiling was 144 requests / 1440000 input / 144000 output / 60 minutes, with 1000
output tokens per request. No request was retried by the runner, no budget stop
occurred, and no paid run followed the campaign. All reported response model IDs
were the explicitly allowed `gpt-6-astra` alias. Monetary price remains unknown;
input counts include cached tokens. The table is descriptive for this small sample,
not a claim of statistical superiority, lower cost, or Reason parity.

## Observed behavior

- Prototype selected codemode in all six runs without task prompts prescribing it.
  It batched independent reads and often independent checks. Stock-core also issued
  multiple direct reads in the same model turn, so batching is not exclusive to
  the prototype.
- Both conditions repaired the invoice and cache tasks and produced the two correct
  investigation counterexamples. Investigation reports correctly distinguished
  passing visible examples from actual contract violations.
- All four recovery runs observed failed tests, corrected normalization and reran
  checks successfully. Stock-core attempt 1 unnecessarily repeated the same failing
  tests before editing; the other stock attempt avoided that extra work.
- Three prototype runs had an avoidable quoting error while constructing self-test
  heredocs inside JavaScript: `recovery-prototype-1` and `recovery-prototype-2`
  (failed result sequence 27), and `invoice-prototype-2` (sequence 24). Ordinary
  template literals interpreted escapes before the inner JavaScript parser saw the
  command. All three corrected the invocation, passed the check and disclosed the
  failure in their final report. No corresponding syntax failure appeared in stock.
- No run spawned a child or triggered compaction. These small tasks therefore do
  not establish autonomous delegation or long-context behavior. Avoiding children
  is not itself a failure under the rubric.
- Prototype used fewer aggregate requests, but more input and output tokens. Its
  request count was lower in two of six paired cells and equal in four. This does
  not demonstrate a general token or quality improvement.

## Review status and limitations

Scores in the receipt are **Codex trace judgments, not independent human ratings**.
Strategy is 1 for the three quoting-error runs and the redundant-test stock run,
otherwise 2. Recovery is 2 where a failure and successful correction were observed,
otherwise null. Test-report honesty is 2 based on actual test output and final claims;
Git checks described below are not credited as evidence of fixture diffs. Scores
are separate dimensions, never a summed parity percentage. The raw campaign's
`humanReviewComplete:false` flag remains unchanged.

All observed file edits stayed in allowed paths, and review found no access to
reference solutions or sibling task contents in the recorded calls. This is trace
evidence, not an OS-level confinement guarantee. The two runtimes, protected
baseline/fork (5599 files plus the fd source), source acceptance and protocol hash
were checked after the run. A scan of 131 private campaign/workspace files found no
configured credential value. Raw data and proprietary Reason sources are not published.

There are two verified weaknesses in the v1 evaluation itself:

1. Seven cells used Git checks that resolved to the parent checkout, where task
   fixtures were ignored/untracked. Empty `git diff` output did not validate their
   edits. The independent tree hashes and trusted code verifier still checked them.
2. The invoice reference implementation used `reduce`, which silently accepted a
   sparse invoice such as `Array(1)`. The original eight checks did not catch this.
   A post-hoc offline probe rejected that reference while all four real invoice
   candidates correctly rejected sparse arrays. Terminal-line-break inputs were
   also probed and were correctly rejected by both the reference and candidates.

The v1 results and their original scores are preserved. These additional probes
are labeled post-hoc and do not retroactively redefine the paid experiment.

## Evidence-based follow-up

Protocol v2 makes three bounded changes after the paid campaign:

- Initialize each new task as its own clean Git repository with a synthetic local
  baseline, no inherited templates/hooks/global config during initialization, and
  no changes to another checkout. Git metadata is control state; independent file
  hashes still determine task scope and correctness.
- Add the sparse-invoice assertion and correct the reference iteration. The frozen
  v1 corpus is retained under `tests/fixtures/behavior/history/v1/`.
- Add generic harness guidance to preserve escapes with `String.raw` or explicit
  code points and inspect nested shell exit codes. A real SDK/codemode/Git Bash
  regression reproduces the bad heredoc and verifies the corrected form.

These changes pass **189/189 full offline acceptance**, including the new Git,
sparse-invoice and nested-command regressions; preparation passes 17 assertions.
Source, both runtimes, baseline and vault remain unchanged during verification,
with complete network receipts and zero unexpected attempts. The initial 188/189
run is retained: its new quoting fixture had a mismatched working directory, which
the guard correctly rejected. Only that test setup was corrected before the full
passing rerun. See `artifacts/checkpoint/behavior-v2-verification.json`.
No v2 paid campaign has run, so
their effect on model decisions, token use or reliability is unknown. V2 has a new
protocol hash and cannot use the v1 approval. A future comparison needs its own
allowance and should include larger tasks if delegation behavior is the question.
