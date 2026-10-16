# Codex versus Pi through 9router

I26 prepares an exploratory, paired comparison requested by the user. The current
protocol is `codex-pi-v2`; [v1 stopped at its first request](CODEX-PI-RESULTS-V1.md)
and has no valid paired result. Both
conditions select **9router / `cx/gpt-6-astra` / low effort**, with a configured
32768-token context and 2000 output tokens per physical request. No paid run is
authorized by implementation, preparation, or the historical I24 allowance.

## Frozen comparison

The existing `behavior-v2` corpus supplies invoice, investigation and recovery.
Each condition gets two attempts per task: **12 fresh workspaces and sessions**.
The second attempt reverses task and condition order. Prompts, starting trees,
trusted verification, scope checks, disjoint quotas and review rubric are shared
with [the behavior protocol](BEHAVIOR-EVALUATION.md). Failed cells remain in the
results; no reruns or transfers of unused allowance are permitted.

This first comparison is **single-agent**. Delegation is disabled on both sides.
Pi retains harness context and codemode; Codex uses its native instructions and
tool dispatcher. This answers small-task completion and resource use, not larger
task delegation, interactive UI, or long-context reliability. I25 remains open.

| Condition | Runtime and transport | Tool execution |
| --- | --- | --- |
| Codex | Native Windows Codex CLI 0.162.1, binary SHA-256 pinned in `config/codex-benchmark.json`; Responses SSE | Native `codex exec`, workspace-write / unelevated sandbox, Windows Job Object for descendant cleanup |
| Pi | Selected pinned `1.0.0+reason-ui.4` SDK; Chat Completions SSE | Existing harness, codemode, file policy, owned Git Bash shell operations |

These are their native API paths. 9router may translate or cache them differently.
The native prompts, tools, shell and permission adapters also differ. Therefore
the experiment compares these two configured products; it cannot isolate a pure
harness effect or establish Reason parity. Custom model selection in Codex is
literal; no alias is substituted in the request. Response aliases must match the
explicit local provider configuration. Model-specific default metadata from
Codex is not evidence that this custom provider supports every native feature.
Cell wall time includes adapter startup and teardown: Codex binary hash checking
and Windows job-helper compilation, versus Pi SDK session creation. Preserve
per-request ledger durations separately; do not call total cell time pure model
latency or attribute adapter startup overhead to token efficiency.

Codex 0.162.1 sends namespaced tool definitions inside `additional_tools` input
items and invokes `functions.exec` as a custom tool. This format is preserved.
The gate hashes these definitions and does not translate them into another agent
protocol. V1 verified an initial 9router response and native command. Multi-turn
compatibility of the corrected v2 path still needs a newly authorized live attempt.

## Accounting and containment

`LiveBudgetTransport` now understands Responses usage alongside its existing
Chat Completions path. Reservations, pending/unknown usage charging, timers,
locks, model allowlists, retry accounting and persistence are the same mechanism.
An inbound loopback broker gives native Codex access to this gate; it is not a
second quota implementation. Provider credentials remain in the broker process.
Codex receives only an ephemeral loopback token, excluded from shell tool env.
V2 releases the upstream stream at its terminal Responses event. A client close
after fully accounted `response.completed` does not invalidate a completed request;
missing/invalid usage and earlier cancellation retain conservative stop behavior.

Only streamed `/responses` POST requests are accepted. Hidden server history,
background mode, storage, WebSockets, unknown routes and a changed model/effort
are rejected. The broker supplies `max_output_tokens` only when Codex omits it;
an explicit oversized cap is rejected. Local compaction stays on the same route
and budget; unaccountable remote `/responses/compact` calls stop the campaign.
Automatic transport retries are disabled, and every physical request still needs
a reservation. Missing terminal usage consumes the reservation and closes the
allowance. A provider-side reported overshoot cannot be retroactively unbilled.

Each Codex cell has a fresh `CODEX_HOME` under the ignored campaign tree. It does
not use the user's Codex auth/config/history, skills catalog, plugins, MCP servers,
web search, memory or hooks. The local executable is read and hash-checked, not
modified or installed globally. `scripts/codex-job.ps1` creates it suspended,
assigns it to a kill-on-close Windows Job Object, then resumes it. Normal exit
requires a zero-active-process receipt; cancellation also uses owned-tree
termination confirmation. A writer lease is retained if cleanup is unconfirmed.
This does not make the Pi shell policy a universal OS sandbox.

## Prepare and verify without inference

Use the absolute path to the installed executable matching the pin. The PowerShell
or npm shim is not accepted. Do not substitute another build silently.

```powershell
node scripts/evaluate-behavior.mjs --comparison codex --dry-run
node scripts/check-codex-fixture.mjs --codex 'C:/path/to/pinned/codex.exe'
node scripts/evaluate-behavior.mjs --comparison codex --prepare --codex 'C:/path/to/pinned/codex.exe'
node scripts/verify-offline.mjs --suite all
```

The native fixture uses synthetic SSE exclusively: tool read/write, completion
without transport EOF, credential
environment exclusion, wrong model, missing usage, stream/tool cancellation and
the full 12-cell scripted campaign. Scripted reference edits verify the runner,
not model quality. Its public receipt is `artifacts/checkpoint/codex-native-fixture.json`.
Preparation preserves the baseline/runtime prerequisites and calibrates all 17
trusted assertions. Full acceptance must include `codex-evaluation` and match
the current source hashes. The native receipt must match the prepared protocol
hash before live execution. Missing original baseline/reference prerequisites
remain blocking; never replace them and call the suite fully accepted.

## Proposed fresh allowance

| Limit | Per cell | Whole campaign |
| --- | ---: | ---: |
| Physical requests | 12 | 144 |
| Input tokens, including cached input | 240000 | 2880000 |
| Output tokens, including reported reasoning | 24000 | 288000 |
| Wall time | 5 minutes | 60 minutes |

These are ceilings, not predicted usage or verified monetary prices. The higher
input reservation accommodates Codex's native prompt/schema envelope; both sides
receive the same cap. Output is limited to 2000 per request on both sides.
All cells share the aggregate authorization through fixed disjoint suballowances.

Only after the user approves this new allowance, create a new private JSON file:

```json
{
  "schemaVersion": 1,
  "authorized": true,
  "campaignId": "codex-pi-NEW-UNUSED-ID",
  "protocolHash": "EXACT_HASH_FROM_PREPARATION",
  "maxRequests": 144,
  "maxInputTokens": 2880000,
  "maxOutputTokens": 288000,
  "maxDurationMs": 3600000
}
```

```powershell
node scripts/evaluate-behavior.mjs --comparison codex --live --codex 'C:/path/to/pinned/codex.exe' --config agent/live-private/config.json --budget agent/live-private/codex-pi-budget.json
```

The provider config retains its existing `openai-completions` API for Pi; the
Codex adapter derives `/responses` from the same base URL. Supply its named
credential environment variable locally. Never put the credential in arguments,
config, screenshots, session text or Git. Daily-use allowance can remain disabled.

Report correctness/scope, final-answer honesty, recovery, requests, input/output,
cached input and wall time separately. Calculate currency only from verified
provider prices or attributable billing; API list prices do not establish the
9router account's cost. Human rubric fields stay unreviewed until an explicitly
labeled review. Two attempts on three small tasks cannot prove general superiority.

## Status and rollback

- Implemented: shared Responses gate, native Codex adapter, comparison selection,
  protocol pinning and private accounting.
- Tested: **198/198 full offline acceptance**, including nine new Codex tests and
  51 existing UI tests; 17 trusted preparation assertions. Source, both runtimes,
  original baseline and vault unchanged; zero unexpected tracked network attempts.
- Runtime-verified with synthetic responses: six native scenarios and **12/12
  scripted Codex/Pi cells**, including shell writes, credential environment
  exclusion, cancellation and confirmed cleanup. Campaign replay is rejected.
- Runtime-verified with 9router at v1: one streamed response, one native read
  command, actual usage accounting and cleanup. The campaign then stopped.
- Unknown: v2 multi-turn paid compatibility, comparative model decisions, price
  and broader workload quality. **No valid paired comparison exists.**

Receipts: `artifacts/checkpoint/codex-pi-verification.json`,
`artifacts/checkpoint/codex-native-fixture.json`, and
`artifacts/checkpoint/codex-pi-preparation.json`. The initial synthetic setup
failures (loopback binding under the guard, incomplete fake Responses usage, and
a cleanup receipt race) were fixed before these final runs. Their private fixture
artifacts remain retained; they were not paid provider failures.

Stop an active benchmark with Ctrl+C and wait for cleanup. Preserve its campaign,
ledger and locks; reopening an existing campaign is rejected. Raw events, configs,
native state and synthetic/live workspaces are excluded by `PUBLICATION.md`.
Return to `node launch.mjs` for offline Pi. No global profile, launcher, `pi-clean`,
`.pi` installation or production Brain configuration needs changing.

Official references used for the native adapter:
- https://developers.openai.com/codex/noninteractive
- https://developers.openai.com/codex/config-advanced
- https://developers.openai.com/codex/config-schema.json

The pinned executable and actual synthetic request/response tests determine the
observed version-specific behavior; documentation alone is not a runtime proof.
