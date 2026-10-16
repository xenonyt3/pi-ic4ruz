# Explicit interactive live mode

## Daily use without a local usage budget

As requested on 17 October 2026, daily use can follow provider limits without
setting a request/token/time allowance. Use `config/live-daily.example.json`
as the local template under ignored `agent/live-private/`. It replaces the
`budget` object with `"accounting":{"mode":"provider","id":"astra-daily"}`.
Never specify both. This is explicit daily opt-in, not the default offline mode.
The existing bounded `config/live.example.json` and evaluation campaigns retain
their budget/authorization requirements; old ledgers are not converted or reset.

The accounting ID is a stable storage namespace, not a quota. Requests from the
parent, children, retries and summaries still pass through `LiveBudgetTransport`
and the same persistent, locked ledger. There is no local maximum request count,
cumulative input/output token cap or elapsed-time deadline, including idle time
and downtime. The status displays `provider limits; no local usage budget` with
cumulative usage. Upstream quota/rate limits and pricing still apply; the UI does
not invent remaining provider quota or treat SDK cost zero as actual billing.

One response still has a generation limit (default 4000 output tokens, optionally
`accounting.perRequestMaxOutputTokens`) and a 120-second request timeout. These
bound individual generation/network operations, not daily usage. Context window,
max three children, writer lease, model/credential validation, response-model
allowlist, cancellation and cleanup remain unchanged. Reported output above its
generation bound, malformed/missing usage, unconfirmed cleanup or wrong response
model still stop the accounting stream rather than silently losing records.
Errors are not automatically retried. Do not delete a stopped ledger to reset it.

Typical portable launch after setting the credential environment variable:

```powershell
cd workspace
node ../launch-live.mjs --live --config ../agent/live-private/daily-config.json --check
node ../launch-live.mjs --live --config ../agent/live-private/daily-config.json
# Later, with the same accounting ID and workspace:
node ../launch-live.mjs --live --config ../agent/live-private/daily-config.json --continue
```

On this workstation the ignored `agent/live-private/start-daily.mjs` wrapper reads
the existing local 9router credential in memory, selects the checkout's `workspace/`
and runs these commands without copying credentials or changing global profiles:

```powershell
node agent/live-private/start-daily.mjs
node agent/live-private/start-daily.mjs --continue
```

The repository-local `icarus.ps1`/`icarus.cmd` shortcut maps the same flows without
changing PATH or any global launcher:

```powershell
.\icarus.ps1 live
.\icarus.ps1 check
.\icarus.ps1 resume
```

The user-approved daily configuration is 9router / `cx/gpt-6-astra`, low effort,
with web tools enabled and Brain disabled. Configuration and the wrapper stay
untracked. This authorization does not authorize new evaluation campaigns.

The sections below describe shared mechanics and the optional bounded mode.

Optional parent-owned web tools are installed from selected oh-my-pi components:
see [WEB-TOOLS.md](WEB-TOOLS.md). They use the same live launcher, are deferred
through codemode and do not call a search model. Brain remains disabled. Public
search provider availability is separate from model connectivity and native
browser verification.

`node launch.mjs` and `npm start` remain offline. `config/harness.json` must
retain `liveInference:false`; changing it is not the live opt-in mechanism.
The separate `launch-live.mjs --live --config PATH` uses the same Pi SDK,
presentation, tools, child supervisor, writer leases and `LiveBudgetTransport`.
There is no Reason service dependency. Brain production remains disabled; the
sole vault contract stays `D:/.vault-brain/vault`.

## Reused paths and audit decisions

- `launch.mjs` validates the pinned runtime and fixture profile, strips inherited
  credentials and starts Pi with the offline network guard. Its input/compaction
  guards are retained. Live setup reuses its isolation checks without modifying it.
- `live-evaluation.mjs` already has a physical-request budget gate and parent model
  broker. Its one-shot campaign scope and completed-message stream adapter are
  appropriate for the evaluator; daily InteractiveMode needs incremental events.
- `LiveBudgetTransport` remains the only live HTTP/accounting gate. Interactive
  mode adds resumable locked state and an explicit configuration fingerprint;
  campaign mode retains its original model/cap/reuse restrictions. The separate
  `EvaluationBudget` remains an offline reservation fixture, not a second live ledger.
- `live-interactive.mjs` wraps both the session stream function and runtime
  `streamSimple`. Pi compaction/branch summaries therefore use the same gate as
  normal turns. It forwards parent deltas, then settles raw usage before the final
  result. The existing process-child broker sends completed child messages and
  keeps real credentials out of child workers.
- Shutdown explicitly waits for parent abort, interactive shell completion and
  owned child cleanup. Concurrent child cancellation is coalesced; a cleanup
  receipt is accepted only together with observed process exit. The standard
  supervisor still retains capacity and writer leases when cleanup is unconfirmed.

## Local setup

Bootstrap the pinned runtime as described in HANDOFF.md first. Store the live
configuration under the ignored `agent/live-private/` directory. Copy
`config/live-daily.example.json` there for provider-limited daily use, or
`config/live.example.json` for bounded use. The bounded example is deliberately
unusable: `authorized:false` and zero limits are not an allowance.

Required configuration:

- `provider`: `9router`; `api`: `openai-completions` (OpenAI Chat Completions SSE).
- `baseUrl`: the user's gateway URL; HTTP is accepted only on loopback, otherwise
  HTTPS is required. No URL credentials, query strings or redirects.
- `models`: an explicit local allowlist; `model`: an exact member of that list.
  `responseModels`: exact accepted response IDs, including any documented gateway
  alias. Unknown response IDs stop the allowance. No automatic model fallback.
- `thinkingLevel`, `contextWindow`, and a positive per-request generation limit
  (daily default 4000). Model and effort are pinned, including children/summaries.
- `credentialEnv`: the name of an environment variable containing the credential.
  Set it locally before launching; do not paste the value into a prompt or config.
- For bounded mode only, `budget`: a **new** `allowanceId`, `authorized:true`, and positive
  `maxRequests`, `maxInputTokens`, `maxOutputTokens`, `maxDurationMs`, and
  `perRequestMaxOutputTokens`. Historical pilot budgets do not grant new usage.

Run from `workspace/` or a separate task workspace, not the checkout root or an
ancestor of `agent/`. This keeps credential/control files outside file-tool scope.
The gateway credential is removed from the launcher environment before SDK/tools
start. It stays in the broker's memory and is attached only at the HTTP boundary;
child IPC, session model metadata and telemetry use no production credential.

```powershell
# From the checkout root, after editing the private config and setting its env var:
cd workspace
node ../launch-live.mjs --live --config ../agent/live-private/config.json --check
node ../launch-live.mjs --live --config ../agent/live-private/config.json
```

`--check` validates local configuration, runtime identity, session ownership and
ledger state without contacting the gateway. It cannot establish remote credential
validity, server-side model availability, pricing or provider behavior. A new paid
smoke test requires separate authorization after offline verification.

Type prompts normally in Pi. Streaming text, reasoning and tool calls use upstream
InteractiveMode. Deferred `agents_spawn`/`agents_wait` and follow-ups reuse the
existing broker; there are at most three active children outside the parent.
`code_explorer` is read-only; `default` shares the one-writer lease policy.
Child replies are delivered when complete, as in the existing broker protocol;
the parent transcript streams incrementally. Child auto-compaction is disabled;
parent compaction and branch summaries pass through the same accounting gate.

The footer and `/live-status` show LIVE, provider/model, cumulative requests and
tokens, state/stop reason and `cost unknown`. Pi's SDK zero-valued cost fields
are not a billing measurement. Escape/Ctrl+C retain Pi's interrupt behavior;
parent abort also cancels owned children. Ctrl+D on an empty editor exits with
cleanup. Interactive `!` shell commands also use the shared writer lease. The
standard offline launcher remains available separately.

## Resume and accounting

```powershell
node ../launch-live.mjs --live --config ../agent/live-private/config.json --continue
node ../launch-live.mjs --live --config ../agent/live-private/config.json --session <owned-session.jsonl>
```

The Windows exit hint uses a generated private `resume.mjs` wrapper with the
same explicit config. The credential env var must still be set in the invoking
shell. Sessions live under `agent/live-private/<allowanceId>/sessions/` and carry
an allowance fingerprint. `/new`, `/resume`, `/fork`, compaction and restarts do
not replenish the shared allowance. Foreign/offline sessions cannot be imported
as a funded live session. A changed model, endpoint, workspace or budget for an
existing allowance is rejected. Missing ledger with retained sessions is rejected.

`ledger.json` records every physical POST, including retries, before dispatch.
Reservation includes concurrent parent/child requests. Input reservation uses the
existing UTF-8 payload-size estimate plus 8192 tokens; output reserves the full
per-request cap. Raw provider SSE usage settles the reservation, including cached
input. Missing/invalid usage charges the reservation and stops; reported overshoot
also stops. These are conservative local accounting controls, not a promise that
an untrusted gateway honors output caps or reports billing correctly. Money caps
are rejected until pricing enforcement exists. Automatic retries and cache warming
are disabled; any physical retry through the transport still consumes a request.

In bounded mode, elapsed allowance time starts at the first request and includes idle time and
downtime. Closing and reopening does not reset its deadline. Closing an unused
`--check` does not start that clock. A stopped allowance stays stopped; obtain new
authorization before creating another allowance. Never delete or edit accounting
to reuse spent capacity.

The ledger has an exclusive directory lock. Normal exit releases it after child
and writer cleanup. A crash leaves it locked deliberately. Inspect
`ledger.json.lock/owner.json`, owned child receipts/processes and writer leases;
only after confirming the owner and children are gone may an operator remove that
specific stale ledger lock. Keep `ledger.json`. On recovery, any pending request
is charged at its reservation and the allowance stops because usage is unknown.
An unconfirmed writer lease is a separate recovery requirement, never auto-cleared.

## Boundaries and verification

The parent network guard grants HTTP capability only to the budget broker;
workers retain the offline network guard. These trusted-process guards and file
tool rules are not an OS sandbox for arbitrary shell programs. Do not treat the
prototype as confinement against hostile tools or manually edited private state.

Fake SSE/SDK tests cover opt-in/config rejection, streaming, file tools, brokered
children, shared accounting, summaries, retries, errors, cancellation, restart,
expiration, exclusive locking and cleanup. Baseline/reference-dependent acceptance
must use the real prerequisite evidence, as described in HANDOFF.md. See the
current I23 backlog and `artifacts/checkpoint/live-interactive-verification.json`
for offline results. A subsequently authorized live 9router/Astra smoke passed
through the native Windows launcher: 5 requests (3 parent, 2 child), 18430 input
tokens, 250 output tokens, exact child-read/parent-write result, clean exit and
resume without another request. See `artifacts/checkpoint/interactive-live-smoke.json`.
No retry/campaign rerun was needed. Prices, broad daily-workload reliability and
O14/full Reason parity remain unknown. This smoke does not grant another allowance.

The native synthetic smoke runner is `node scripts/verify-native-live.cjs PATH_TO_NODE_PTY`.
It requires a locally installed Windows-compatible node-pty module, starts its own
loopback SSE server and supplies only a synthetic credential. It does not contact
9router or consume an actual provider allowance. It is separate from full offline
acceptance because that suite prohibits even incidental network connections.

I29 verification passed: 215/215 full offline acceptance, 23/23 focused daily tests, and native synthetic ConPTY verification. No paid inference ran. See `artifacts/checkpoint/daily-live-verification.json`.
