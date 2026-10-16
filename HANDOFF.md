# Continue on another device

I26 adds the requested Codex-versus-Pi benchmark through the same 9router model.
Read [docs/CODEX-PI-BENCHMARK.md](docs/CODEX-PI-BENCHMARK.md) before using
`evaluate-behavior.mjs --comparison codex`. This is a new single-agent protocol,
with native Codex Responses and Pi Chat Completions sharing LiveBudgetTransport.
Codex CLI 0.162.1 is hash-pinned; native state is isolated per cell. Preparation
and synthetic fixtures do not authorize paid inference. The proposed new ceiling
is 144 requests / 2880000 input / 288000 output / 60 minutes, 2000 output/request.
The user approved v1, which stopped after its first Codex request due to an adapter
stream-completion defect: **1 request / 11794 input / 108 output**, cleanup confirmed.
Pi and the other 11 cells never started, so there is no valid paired comparison.
Read [docs/CODEX-PI-RESULTS-V1.md](docs/CODEX-PI-RESULTS-V1.md). The used v1 allowance
is closed; the corrected `codex-pi-v2` protocol needs new authorization.
Current I26 verification: **198/198 full offline acceptance PASS**, with source,
both runtimes, original baseline and vault unchanged, zero unexpected tracked
network attempts, and complete receipts. Native synthetic verification passes
six scenarios plus all 12 scripted Codex/Pi cells; preparation passes 17 assertions.
See `artifacts/checkpoint/codex-pi-verification.json`. This is zero-paid-inference
verification, not a model-quality/cost result. The protocol hash is
`a4f9010c3b698add88b9f9b8eef7c629055a3445909443b3b4b6ab93f1a0803c`.
The acceptance counts below describe earlier checkpoints.

I24 adds three synthetic behavior tasks and a goal-only paired
stock-core/prototype protocol. Read [docs/BEHAVIOR-EVALUATION.md](docs/BEHAVIOR-EVALUATION.md).
Use `node scripts/evaluate-behavior.mjs --dry-run` or `--prepare` without inference.
The separately authorized v1 live campaign completed: **12/12 task passes**, 83
requests, 368647 input tokens and 15453 output tokens. See
[docs/BEHAVIOR-RESULTS-V1.md](docs/BEHAVIOR-RESULTS-V1.md) for the Codex trace review,
method limitations and source checkpoint. It is not independent human review or
Reason parity. No child was selected and no compaction was triggered.
V2 applies offline fixes for command escaping, Git fixture isolation and sparse
invoice coverage. No v2 live run is authorized by the used v1 budget.
I24 v2 acceptance was **189/189 PASS**, with 17 behavior tests, 51 UI tests and
the nested-command quoting regression. Preparation passes 17 assertions. Source,
both runtimes, protected baseline and vault remain unchanged during the run;
unexpected network attempts are zero. Receipt:
`artifacts/checkpoint/behavior-v2-verification.json`.
The pre-campaign I24 acceptance was **186/186 PASS**, including 15 behavior tests and 51 UI
tests, with source/both runtimes/baseline/vault unchanged and zero unexpected network
attempts. Preparation passes all three negative/reference controls (16 assertions).
Receipt: `artifacts/checkpoint/behavior-verification.json`. The 171/171 I23 result
below is retained as the previous milestone, not the current source acceptance.

I23 adds an explicitly opted-in interactive live launcher. Start with
[docs/LIVE.md](docs/LIVE.md): `launch-live.mjs --live --config PATH`, local
credential environment variable, pinned provider/model and a new persistent
allowance. `launch.mjs` remains offline and `liveInference:false` stays unchanged.
The user selected 9router / `cx/gpt-6-astra` and subsequently authorized one new
interactive smoke: 6 requests, 120000 input tokens, 6000 output tokens, 1000 output
per request, 5 minutes. It **passed**, consuming 5 requests (3 parent + 2 child),
18430 input tokens and 250 output tokens. Native launcher, delegated read, parent
write, cleanup and resume without another request were verified. Pricing remains
unknown. This is not permission for another smoke or daily unlimited usage.
Do not reuse historical campaign allowances. Current implementation
and verification are recorded in the I23 backlog and
`artifacts/checkpoint/live-interactive-verification.json`.
The subsequent paid smoke receipt is `artifacts/checkpoint/interactive-live-smoke.json`;
raw sessions, terminal capture, configuration and credentials remain unpublished.

Current-checkout I23 verification: **171/171 full offline acceptance PASS**, including
51 UI tests and 11 live fixtures; baseline/vault/source/both runtimes unchanged and
zero unexpected network attempts. The original private baseline snapshot and
source oracle were available locally, copied into ignored locations and verified;
they were not recreated or published. This does not establish acceptance on a
different device without those prerequisites, nor full O14/live Reason parity.

Checkpoint: Pi `1.0.0+reason-ui.4`, adding content-order transcript/tool grouping
to the prior startup/shimmer and user/assistant/reasoning hooks. Five patched-file
TypeScript checks and 96 composition comparisons pass on the original workstation.
Full acceptance is **159/159 PASS** (51 UI tests), with the initial 158/159 EPERM
fixture failure retained. This is original-machine evidence, not a fresh-device
result. O14/full UI parity remains incomplete.

## Read first

1. [Implementation plan](PI-IMPLEMENTATION-PLAN.md).
2. [Backlog](RECONSTRUCTION-BACKLOG.md), especially I22 and remaining unknowns.
3. [Design](DESIGN.md), [reference](docs/UI-REFERENCE.md), [parity](docs/UI-PARITY.md).
4. [Layout verification](upstream-patches/transcript-hook/LAYOUT-VERIFICATION.md).
5. [Startup/working verification](docs/STARTUP-WORKING-VERIFICATION.md) and
   [reasoning checkpoint](upstream-patches/transcript-hook/THINKING-VERIFICATION.md).

The repository root is the prototype root. It contains a copy of the two planning
documents that originally lived separately in `D:/Pi-Ic4ruz`. Historical absolute
paths in reports remain evidence pointers to the original machine, not portable
links. Initial publication preserved application source and tests byte-for-byte;
I23 subsequently adds the explicit live path and corrects relocated test imports.
Private baseline/reference prerequisites remain intentionally unpublished.

## Windows setup

Install Node.js 24+ and Git for Windows. Keep this checkout separate from `.pi`
and any clean/fork installation. Bootstrap writes only inside the checkout.

```powershell
git clone https://github.com/xenonyt3/pi-ic4ruz.git
cd pi-ic4ruz
node scripts/bootstrap-device.mjs
node scripts/typecheck-candidate.mjs
cd workspace
node ../launch.mjs
```

Bootstrap installs exact npm lockfile dependencies with install scripts disabled,
checks upstream source-map/original-source hashes, copies an isolated candidate,
builds the patch, pins the new local trees and smoke-tests `--version`. It does not
copy credentials or enable inference. If fd 10.5.0 is available, use
`node scripts/bootstrap-device.mjs --fd 'C:/path/to/fd.exe'` on the initial setup;
its SHA-256 must match `config/tool-binaries.json`. Without fd, startup works but
find-related coverage is not established. Git Bash defaults to
`C:/Program Files/Git/bin/bash.exe`.

`--offline` uses npm's existing cache. Maintainers may use `--runtime-from PATH`
to copy a trusted installed runtime with the identical lockfile; this is a local
cache optimization, not a substitute for source/hash checks.

The bootstrap refuses to overwrite an existing candidate. Use a new checkout if
setup fails after candidate creation. Bootstrap updates machine-dependent
`source-provenance.json` paths and regenerates `transcript-hook.patch`; inspect the
diff before committing subsequent work. New pins are ignored by Git.

Initial publication validation (reason-ui.3): bootstrap succeeded in a separate checkout on the original
Windows machine using the matching runtime cache, npm offline cache and verified
fd executable. The newly built candidate reported `1.0.0+reason-ui.3`; its four-file
strict TypeScript check passed with zero diagnostics. Receipts:
`artifacts/checkpoint/device-bootstrap-smoke.json` and `typecheck-bootstrap.json`.
This verifies relocation/rebuild on Windows, not a clean-device npm download,
another operating system, or the full original-machine acceptance suite.

I22 upgrade validation: the existing relocated Windows candidate rebuilt as
`1.0.0+reason-ui.4`, passed its version smoke test and five-file strict typecheck.
See `artifacts/checkpoint/device-upgrade-reason-ui.4.json` and the updated
`typecheck-bootstrap.json`. For an existing bootstrapped checkout, inspect/commit
local changes before pulling, then run `node upstream-patches/transcript-hook/build.mjs`
and `node scripts/typecheck-candidate.mjs`; do not rerun fresh-only bootstrap over
an existing candidate directory.

## Acceptance and external evidence

The full suite is coupled to the original clean/fork snapshots, single
Brain vault and a locally extracted Reason source oracle. Those are not in this
public repository. Therefore **do not claim `npm test` or full 159/159 portability
until the new machine's test prerequisites and evidence model are explicitly set
up**. Do not silently skip these checks or generate a replacement baseline and
label it as the original audit.

Public evidence includes the final report, test output, prototype terminal replay
and selected ConPTY receipts. Reference hashes/constants are available in
`artifacts/ui-reference/provenance-public.json`. Raw proprietary Reason code/binary,
credentials, sessions, private baseline inventories, live raw campaigns and vault
contents are intentionally not published. See [PUBLICATION.md](PUBLICATION.md).

Current limitations: Windows-specific paths still exist in original research,
baseline, native-smoke and fixture scripts. Linux/macOS portability is unverified.
There is no dependency on a Reason server. Brain production remains deferred;
the sole vault contract remains `D:/.vault-brain/vault`, with no second memory store.

## Prompt for the next coding agent

> Continue this Pi/Reason prototype from HANDOFF.md and RECONSTRUCTION-BACKLOG.md.
> Preserve the 1.0.0+reason-ui.4 checkpoint and upstream-first architecture.
> Read code and current setup before editing. Separate original-machine evidence
> from results obtained here. Do not enable paid inference, rerun live campaigns,
> modify another Pi profile/launcher, or connect production Brain. Keep one writer
> per workspace and at most three child agents. First verify the local bootstrap
> and remaining prerequisites; never mark omitted reference/baseline tests passed.
> Track implemented, tested, runtime-verified and unknown separately. Full UI parity
> is not complete. Ask only about material scope changes.

For I23 continuation, preserve the shared `LiveBudgetTransport`, brokered child
workers and private allowance ledgers. Tests use a synthetic provider fixture;
they do not read production credentials. The actual Windows live launcher has
also been exercised against loopback synthetic SSE (stream/tool/resume/cancel),
with zero paid requests; see `artifacts/checkpoint/live-native-verification.json`.
