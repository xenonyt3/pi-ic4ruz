# Codex versus Pi through 9router: v2 results

Both conditions passed all six runs, with **12/12 task passes and 68/68 trusted
assertions**. Pi used less total input, while Codex used fewer requests and slightly
less output. Aggregate cell time was similar. These results do not establish a
monetary winner: cache reporting is incomplete on the Pi path and billing rates
are unverified.

The separately authorized campaign `codex-pi-v2-20261016` ran once at commit
`ec343ad49b33689132d11d8e3cc8185e71684028`, using protocol hash
`a4f9010c3b698add88b9f9b8eef7c629055a3445909443b3b4b6ab93f1a0803c`.
Both selected **9router / `cx/gpt-6-astra` / low effort**. All 73 provider requests
returned HTTP 200, reported the explicitly allowed `gpt-6-astra` alias, and were
fully accounted. There was no budget stop, model fallback, unknown total usage,
scope violation or unconfirmed cleanup.

Public receipt: `artifacts/checkpoint/codex-pi-live-v2.json`.
Protocol, limits and transport differences: [CODEX-PI-BENCHMARK.md](CODEX-PI-BENCHMARK.md).

## Aggregate observations

Three synthetic tasks, two attempts per condition, fresh sessions/workspaces.
The second attempt reversed task and condition order. Delegation was disabled
on both sides; Pi retained its harness/codemode and Codex retained native tools.

| Metric, six runs each | Codex CLI 0.162.1 | Pi prototype reason-ui.4 |
| --- | ---: | ---: |
| Task passes | 6/6 | 6/6 |
| Trusted assertions | 34/34 | 34/34 |
| Physical model requests | 33 | 40 |
| Input tokens, including cached input | 432804 | 192300 |
| Output tokens | 6996 | 7310 |
| Reported cached input | 362880, complete | At least 69248, incomplete |
| Requests without cache counters | 0/33 | 11/40 |
| Sum of cell wall time | 320.794 s | 312.069 s |
| Sum of request durations | 250.797 s | 289.713 s |

Pi used **55.6% less total input**. Codex used **17.5% fewer requests** and **4.3%
less output**. Pi's cell-time total was 2.7% lower, a small descriptive difference
that is not evidence of statistical superiority. Cell time includes adapter
startup, tool execution, cleanup and trusted verification. Request duration is a
shared-gate observation, not isolated model compute time.

The whole campaign took **639.255 seconds** including orchestration. Usage was
**73 requests / 625104 input / 14306 output**, within every approved aggregate,
per-cell, per-request and time ceiling. No extra paid run followed the campaign.

## Why raw input does not establish price

Codex reported 362880 cached tokens and 69924 uncached tokens. Pi reported 69248
cached tokens, but cache counters were absent on 11 requests totaling 49659 input
tokens. Those missing counters remain **unknown**, not zero. Pi's cached input is
bounded by 69248..118907 and uncached input by 73393..123052.

All input/output totals are known; only the cache subdivision is incomplete.
Thus this is not a failure of the token allowance accounting. It prevents an
exact cache-discounted cost calculation. SDK cost zero is not used as a price.

For verified per-million rates `I` (uncached input), `C` (cached input), and `O`
(output), the token-based expressions would be:

```text
Codex = (69924*I + 362880*C + 6996*O) / 1000000
Pi    = ((123052-x)*I + (69248+x)*C + 7310*O) / 1000000
        where x is the unknown cached subset, 0 <= x <= 49659
```

Neither the rates nor `x` are verified. The two native API paths may also differ
in gateway cache handling. Do not label Pi cheaper merely because its total input
is lower, or Codex cheaper merely because it sends fewer requests.

## Behavior and environment

- Both repaired exact-cent/quantity handling, produced the two required contract
  counterexamples, and corrected normalized cache writes/invalidation.
- Both recovery attempts in each condition reproduced failing regression checks,
  corrected the source, and verified the result. Final answers identified the
  obsolete exact-key assumption in the legacy note.
- Pi selected codemode in all six runs. No syntax/quoting failure was observed in
  its recorded tool results. Codex uses its native `functions.exec` dispatcher;
  this is not a matched voluntary-codemode adoption comparison.
- **All six Codex runs encountered `spawn EPERM` during standard test execution.**
  They recovered using direct Node tests with `--test-isolation=none`, and disclosed
  the limitation. Pi did not encounter this error. The exact interaction between
  Windows sandboxing, the job wrapper and Node process creation was not isolated.
- Both Codex recovery runs unnecessarily tried an appended npm isolation flag
  after finding a working direct Node command. That retry still hit EPERM. A
  no-match `rg` exit also contributes to one raw tool-error count. Raw nonzero
  counts therefore mix environmental errors, expected regression failures and
  ordinary search outcomes; they are not comparable model-failure rates.
- Recorded final test claims were consistent with tool results. Both invoice
  conditions executed exhaustive one-million-cent checks. Investigation reports
  distinguished passing visible examples from the uncovered counterexamples.

These are **Codex trace judgments, not independent human ratings**. The raw
`humanReviewComplete:false` and null human rubric fields remain unchanged. Public
trace annotations use private event line/sequence references and trace hashes;
raw events, final answers, sessions and vendor instructions remain unpublished.
No reference-answer or sibling-workspace access was observed in the reviewed
traces. This is not an OS-level read-confinement guarantee.

## Limits of the comparison

Codex used Responses SSE and a Windows workspace-write subprocess environment.
Pi used Chat Completions SSE and its existing owned shell/file adapters. The
initial prompts, tool definitions, shells, permission behavior and transport
serialization differ. EPERM recovery adds work on the Codex side; cache reporting
differs by route. Results describe these configured products on this device,
not a pure causal effect of the harness or a universal cost/quality ranking.

The small corpus is saturated at 6/6 for both conditions. It does not assess
large-repository work, autonomous delegation, production Brain, Reason parity or
long-context quality. Pi recorded no compaction events; the Codex compaction
count is not instrumented and remains unknown.

## Integrity and retained history

After the run, the acceptance source hashes still matched. Preparation passed
all 17 reference assertions with the same protocol hash, and checked the original
baseline plus both pinned runtimes. All 289 Markdown vault files matched the
pre-request snapshot. Every writer lease and ledger lock was released. A literal
credential-value scan of 3116 private campaign/workspace files found zero hits.

The v1 campaign and its ledger remain byte-for-byte unchanged. Its interrupted
request is retained separately in [the v1 report](CODEX-PI-RESULTS-V1.md), not added
to either side's paired totals. Across v1 plus v2, total actual usage is **74
requests / 636898 input / 14414 output**. Both allowances are closed; unused
capacity is not transferable to daily use or another campaign.

Next evidence work is offline: isolate the Windows nested-process restriction,
determine the gateway's missing-cache semantics, and obtain verified pricing or
attributable billing. Larger/delegation tasks remain I25; any later paid
comparison requires a newly frozen protocol and explicit allowance.
