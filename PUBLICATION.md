# Public snapshot boundaries

I28 publishes selected MIT oh-my-pi 18.10.1 components, source hashes, Node
adaptations and dependency lockfile. The generated ARIA snapshot bundle includes
Playwright Apache-2.0 code; both licenses are retained under `vendor/oh-my-pi/`.
Installed web dependencies are ignored. Actual browser profiles, screenshots,
public-page captures, private launchers and provider configs remain unpublished
under ignored live state/evaluation directories. No OMP authentication is copied.

This repository is a development handoff of an isolated Windows prototype.
It includes implementation, tests, patch source, lockfiles, planning/design/status
documents and selected synthetic verification artifacts. It is not a dump of the
developer's profile or an independently verified portable release.

Excluded deliberately:

- Auth files, production provider configurations, tokens and environment secrets.
- The entire `agent/live-private/` tree: live configuration, resume wrappers,
  allowance ledgers/locks, model stores, telemetry, parent/child sessions and receipts.
- Agent sessions, telemetry, writer leases, models cache and private Brain vault.
- Installed dependencies, generated candidate runtime and machine-specific pins.
- Raw live campaign sessions and private baseline file inventories.
- Reason CLI binaries, extracted proprietary source oracle and marketing captures.

The locally inspected Reason CLI license notice identifies that software as
proprietary. The repository does not redistribute its binary/extracted source.
Public provenance hashes and a description of the observed behavior are provided.
The prototype has its own Pi branding and no Reason server dependency.

Upstream Pi source files under `upstream-patches/transcript-hook/source-original`
and modified copies under `source` derive from `@earendil-works/pi-coding-agent`
1.0.0 (MIT). Its copyright and permission notice are preserved in
[LICENSE.upstream](upstream-patches/transcript-hook/LICENSE.upstream). Dependency
packages retain their own licenses when installed. No blanket license is assigned
to unrelated third-party materials by making this repository public.

Historical paths, session identifiers in synthetic receipts, model labels and
usage totals in project documents are evidence, not production credentials.
The bundled `agent/models.json` uses `127.0.0.1:9` and an explicit fixture credential.
`config/live.example.json` is disabled with zero allowance. Test provider files
contain synthetic credentials only and never grant paid inference authorization.
The I24 behavior corpus/reference solutions and preparation receipt are synthetic
and publishable. Raw behavior campaign events, final answers, sessions and ledgers
remain private under the existing exclusions; only reviewed aggregates are public.
I26 also excludes native Codex homes, raw request/tool envelopes, stderr/events,
process receipts and provider configuration. The repository publishes the native
binary hash and synthetic tests, not the installed Codex executable or its bundled
instructions. Synthetic fixture directories remain under ignored `tests/.tmp/`.
Cost reconciliation publishes aggregate counts, bundle hashes and reproducible
arithmetic only. Raw router database rows, row IDs and account linkage remain in
`agent/live-private/`; the router database and authentication stores are excluded.

Original implementation provenance is recorded in
`artifacts/checkpoint/public-source-snapshot.json`. New-machine bootstrap results
are stored separately in ignored `.device-bootstrap/receipt.json`.
