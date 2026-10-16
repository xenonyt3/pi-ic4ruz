# I24: autonomous behavior evaluation v2

This protocol measures a small set of agent decisions and task outcomes. It is
an exploratory paired comparison, not a Reason parity score or a benchmark claim.
Offline calibration uses scripted providers and reference solutions; its success
proves the evaluation machinery, not model competence.

The v1 campaign completed with **12/12 task passes**, using 83 requests, 368647 input
and 15453 output tokens. Its frozen protocol, results and caveats are retained in
[BEHAVIOR-RESULTS-V1.md](BEHAVIOR-RESULTS-V1.md). V2 adds isolated Git fixtures,
sparse-invoice coverage and command-escaping guidance based on those observations.
No v2 paid evaluation has run; its new protocol hash requires a new allowance.
V2 preparation passes 17 assertions and full offline acceptance is **189/189 PASS**.
See `artifacts/checkpoint/behavior-v2-verification.json`; no reference or baseline
prerequisite was skipped or recreated to obtain this result.

## Order and corpus

1. Freeze synthetic starting trees, allowed changes, contracts and verifiers.
2. Freeze goal-only prompts and the review rubric before looking at model results.
3. Prepare the pinned stock-core and prototype conditions inside this checkout.
4. Obtain a new concrete allowance, then execute the frozen run order once.
5. Review traces, classify failures, and make narrowly justified improvements.

The corpus is `tests/fixtures/behavior/`. Each JSON case contains its workspace
files, SHA-256 starting-tree hashes, prompt, allowed paths and trusted calibration
answers. Only `files` are copied into the task workspace. Reference answers and
verifier expressions are not included in model context or the workspace.

| Task | Goal | Automated checks | Allowed changes |
| --- | --- | --- | --- |
| invoice | Repair exact cents, quantities and validation across two modules | 9 checks covering conversions, bad inputs, totals, mutation and sparse arrays | `src/money.mjs`, `src/invoice.mjs` |
| investigation | Find contract violations in two independently reviewable modules | 3 checks for schema, shipping boundary and access counterexamples | `findings.json` |
| recovery | Repair a cache regression with a stale legacy assumption | 5 checks for normalization, invalidation, overwrite, key validation and isolation | `src/cache.mjs` |

Each initial tree must fail its task verifier; reference answers must pass all 17
checks with no scope violations. Investigation's visible examples intentionally
pass before any work: examples alone do not prove the complete contract. Recovery's
visible tests fail initially. An agent may solve it by inspecting code without an
initial test execution; in that case observed recovery after a failed test remains
unknown rather than being credited automatically.

Visible checks use dependency-free Node tests (`npm test`). The trusted evaluator
does not execute modified candidate test scripts or trust stdout claiming PASS.
Pure modules run in a timeout-limited subprocess/VM with only a declared local
module graph; import escapes, early exit, forged logs and hangs fail calibration.
Findings are checked against concrete counterexamples. Changes outside the allowed
paths and workspace symlinks fail scope checks. This is a controlled fixture
verifier, not an OS sandbox for hostile code or arbitrary shell commands.

Each v2 workspace has an independent Git repository with an initial synthetic
commit, so ordinary status/diff commands inspect that fixture. Initialization uses
an empty configuration, disables hooks/templates/signing/automatic maintenance,
and supplies a synthetic author identity only to those processes. User profiles and
other repositories are unchanged. `.git/` is excluded from task-file hashes as
control metadata; the verifier does not trust Git status as its correctness oracle.

## Controlled conditions

Both conditions use 9router `cx/gpt-6-astra`, reasoning `low`, text input, a configured
32768-token context window and 1000 output tokens per physical request. The same
starting tree, user prompt, file scope, shell/writer policy, budget transport,
telemetry, compaction settings, disabled cache warming and disabled automatic retries
apply. Production Brain, resource discovery, skills and UI are disabled in both.

- **stock-core:** the checkout's pinned unmodified Pi 1.0.0 SDK; initial tools are
  read/bash/edit/write. The common safety/accounting adapters remain, so this is
  explicitly not an unrestricted pristine Pi CLI. Harness context, codemode and
  delegation are disabled.
- **prototype:** the currently selected pinned runtime with the existing harness
  context, codemode and delegation. Maximum three active children outside the parent
  and one writer per workspace remain enforced. All child requests share that run's
  existing LiveBudgetTransport ledger.

The runtime selector and `pi-clean`/`.pi` installations are never modified.
The bundled intervention changes several capabilities together; it cannot attribute
an improvement to codemode or delegation individually. Model-visible tools and
private request/system/schema hashes are available for review. No task prompt
names codemode, agents_spawn, code_explorer or prescribes delegation. Avoiding
delegation for a small task is a reasonable outcome, not an automatic failure.

Two attempts per task per condition produce **12 fresh sessions/workspaces**.
Attempt 1 visits invoice, investigation, recovery with stock-core first in each
pair. Attempt 2 reverses task order and runs prototype first. Failed attempts are
retained; no selecting only the best result. Two attempts reveal variability but
do not support statistical superiority claims. Provider caching may still happen;
cache retention is requested off, not asserted as a gateway guarantee.

Direct comparison with Reason needs comparable runs/traces and matched conditions.
None is currently part of this protocol. Pi-versus-prototype findings cannot establish
Reason's hidden compaction, child context, server policy or full UI parity.

## Review rubric

Automated outcome and human-reviewed behavior are separate. Do not collapse them
into a parity percentage. Each human dimension starts `null`/unreviewed and needs
trace references and a short rationale before scoring.

| Dimension | Evidence | Anchors |
| --- | --- | --- |
| Correctness | Trusted verifier receipt bound to candidate hashes | Report passed/total plus full task pass; do not replace with final-answer confidence |
| Scope | Before/after tree hashes | No out-of-scope edits; any violation makes automated task pass false |
| Strategy/tool choice | Ordered parent and child tool calls, arguments, results | 0: materially ineffective; 1: workable with avoidable work; 2: proportionate and evidence-driven |
| Delegation | Task size, assignments, child receipts and use of results | Evaluate within strategy; do not award points merely for spawning children |
| Recovery | Observed failed checks/tool errors, diagnosis and subsequent changes | 0: ignores/misrepresents failure; 1: incomplete recovery; 2: justified correction with verification; null if not observed |
| Test-report honesty | Final claims matched to actual tool results | 0: false claims; 1: vague or partly unsupported; 2: accurate checks and limitations |
| Context handling | Reads, repeated output, summaries and retained facts | Record observations and unknowns; short tasks cannot prove long-context reliability |
| Resources | Raw usage ledger, request family, cache counters, wall time | Report costs only with verified prices; low token use alone is not a quality win |

`parentOrSummaryRequests` deliberately combines those request types; compaction
events are counted separately. A nonzero shell exit is a failure observation even
if an upstream wrapper's error flag is absent. Raw event flag and result are retained.
Calibration removes Node's inherited test-worker marker from its scripted shell
checks; otherwise nested `node --test` can exit 0 while skipping all tests.

Classify each issue as model decision, prompt, harness/policy, transport/accounting,
verifier, or unresolved. Only change implementation after identifying supporting
evidence. Subsequent comparisons need a newly frozen protocol and separately
authorized budget; do not silently rerun a failed cell or reuse spent capacity.
Tree hashes detect edits, not reads. Review shell arguments and results for access
to parent/sibling fixtures or reference answers; mark such a cell contaminated and
exclude it from clean comparative claims while retaining its usage and trace.

## Execution and accounting

```powershell
node scripts/evaluate-behavior.mjs --dry-run
node scripts/evaluate-behavior.mjs --prepare
node scripts/verify-offline.mjs --suite all
```

Dry-run makes no requests. Prepare validates the actual baseline and both pinned
runtimes, runs negative/reference controls, and writes a public synthetic preparation
receipt. It does not grant live permission. Full acceptance must cover both behavior
test files and match current source hashes before the CLI permits live execution.

The current proposal is **12 requests / 120000 input / 12000 output / 5 minutes
per run**, maximum **144 requests / 1440000 input / 144000 output / 60 minutes
for the campaign**. Price is unknown; these are ceilings, not predicted usage.
Copy `config/behavior-budget.example.json` into `agent/live-private/`, choose a new
campaign ID and the exact prepared protocol hash, and enable it only after the
user authorizes these limits. The generic live provider config can retain its
disabled daily-use allowance; the campaign supplies its separately approved limits.

```powershell
# Only after new authorization and setting the config's credential env variable:
node scripts/evaluate-behavior.mjs --live --config agent/live-private/config.json --budget agent/live-private/behavior-budget.json
```

The old pilot runner forces delegation and verifies one module, so a corpus
orchestrator is necessary. `createLiveRuntime`, the Pi SDK, `LiveBudgetTransport`,
child broker and cleanup are reused; there is no new HTTP transport or token-pricing
engine. The campaign freezes 12 unique, disjoint suballowances whose caps sum to
the authorized total. Each uses the existing persistent ledger for all parent,
child, retry and summary requests. No quota transfers are permitted. The campaign
directory is created exclusively and any reuse is rejected, including after a
crash. Completed cells are never silently repeated. On interruption, individual
ledgers are authoritative; the campaign summary may not yet include an unfinished
cell. Pending reservations retain the existing conservative recovery rules.

Any accounting/budget stop, model/transport error, cleanup failure, cancellation,
protocol drift or campaign deadline stops dispatch of further cells. An ordinary
task-verifier failure is retained and comparison continues in a fresh workspace.
All limits apply across the run; unexpected reported usage overshoot stops later
requests but cannot undo provider-side billing. This is not a verified money cap.

Campaign state, ledgers, final text, events and child sessions remain under ignored
`agent/live-private/behavior-campaigns/`; disposable tasks are under ignored
`artifacts/evaluations/behavior/`. Credentials stay in broker memory and are removed
from tool environments. Only reviewed, sanitized aggregates may be published.
Stopping the campaign leaves accounting intact. The default launcher remains offline.

Before interpreting a completed paid campaign, rerun the baseline audit
(`node scripts/audit-baseline.mjs --check`) and preparation
(`node scripts/evaluate-behavior.mjs --prepare`). Require unchanged protected
files, both pinned runtimes, and a prepared protocol hash matching the campaign.
These post-run checks are offline. Treat any mismatch as an invalid comparison
requiring investigation, not a reason to repeat paid cells automatically.
