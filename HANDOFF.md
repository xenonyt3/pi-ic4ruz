# Continue on another device

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
links. The existing application source and tests are preserved byte-for-byte;
packaging adds this handoff, bootstrap and redistribution notices.

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
