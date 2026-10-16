"""Read-only reconciliation of the frozen v2 benchmark with local 9router usage.

Rates are a dated Standard API reference, not OAuth subscription billing.
No credentials, request bodies or provider configuration are read or exported.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
import sqlite3
from contextlib import closing
from decimal import Decimal

ROOT = pathlib.Path(__file__).resolve().parents[1]
RATES = {"input": Decimal("10"), "cached": Decimal("1"),
         "output": Decimal("50"), "cache_write": Decimal("12.5")}
MILLION = Decimal(1000000)


def load(file):
    return json.loads(file.read_text(encoding="utf-8"))


def timestamp_ms(value):
    return round(dt.datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)


def money(value):
    return format(value.quantize(Decimal("0.000001")), "f")


def audit(database, campaign):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,32}", campaign):
        raise ValueError("INVALID_CAMPAIGN_ID")
    directory = ROOT / "agent/live-private/behavior-campaigns" / campaign
    state = load(directory / "campaign.json")
    if state["status"] != "finished" or state["plan"]["protocol"] != "codex-pi-v2":
        raise ValueError("COMPLETED_V2_REQUIRED")
    if state["plan"]["model"]["model"] != "cx/gpt-6-astra":
        raise ValueError("MODEL_MISMATCH")
    start = dt.datetime.fromtimestamp(state["startedAt"] / 1000, dt.timezone.utc)
    end = dt.datetime.fromtimestamp(state["completedAt"] / 1000, dt.timezone.utc)
    # Query an existing DB in read-only mode. Export only selected usage columns.
    with closing(sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True)) as con:
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA query_only=ON")
        rows = [dict(r) for r in con.execute("""
          SELECT h.id,h.timestamp,h.provider,h.model,h.endpoint,
                 h.promptTokens,h.completionTokens,h.cost,h.status,h.tokens,p.authType
          FROM usageHistory h LEFT JOIN providerConnections p ON p.id=h.connectionId
          WHERE h.provider='codex' AND h.model='gpt-6-astra'
            AND h.timestamp >= ? AND h.timestamp <= ?
        """, ((start - dt.timedelta(seconds=2)).isoformat().replace("+00:00", "Z"),
              (end + dt.timedelta(seconds=2)).isoformat().replace("+00:00", "Z")))]
    matched, used = [], set()
    for job in state["jobs"]:
        native = job["condition"] == "codex"
        endpoint = "/v1/responses" if native else "/v1/chat/completions"
        for record in load(directory / job["id"] / "ledger.json")["requests"]:
            completion = record["startedAt"] + record["durationMs"]
            candidates = [r for r in rows if r["endpoint"] == endpoint
                          and r["completionTokens"] == record["outputTokens"]
                          and abs(timestamp_ms(r["timestamp"]) - completion) <= 250]
            if len(candidates) != 1 or candidates[0]["id"] in used:
                raise ValueError("MISSING_OR_AMBIGUOUS_ROUTER_RECORD")
            row = candidates[0]
            used.add(row["id"])
            tokens = json.loads(row["tokens"])
            for field in ("prompt_tokens", "completion_tokens", "cached_tokens",
                          "cache_creation_input_tokens"):
                if type(tokens.get(field)) is not int or tokens[field] < 0:
                    raise ValueError("INVALID_ROUTER_USAGE")
            if row["status"] != "ok" or row["authType"] != "oauth":
                raise ValueError("ROUTER_STATUS_OR_AUTH_CHANGED")
            if tokens["prompt_tokens"] != row["promptTokens"] or tokens["completion_tokens"] != row["completionTokens"]:
                raise ValueError("ROUTER_USAGE_INCONSISTENT")
            if record["inputTokens"] - row["promptTokens"] != (0 if native else 2000):
                raise ValueError("INPUT_PADDING_PATTERN_CHANGED")
            cached = tokens["cached_tokens"]
            if not 0 <= cached <= row["promptTokens"] or row["promptTokens"] > 272000:
                raise ValueError("CACHE_OR_CONTEXT_TIER_INVALID")
            if record["cacheReadTokens"] is not None and record["cacheReadTokens"] != cached:
                raise ValueError("CACHE_COUNTER_MISMATCH")
            if record["cacheReadTokens"] is None and cached != 0:
                raise ValueError("MISSING_CACHE_NOT_ZERO")
            if tokens["cache_creation_input_tokens"] != 0:
                raise ValueError("CACHE_WRITE_REQUIRES_SEPARATE_REVIEW")
            reasoning = tokens.get("reasoning_tokens", 0)
            if type(reasoning) is not int or not 0 <= reasoning <= row["completionTokens"]:
                raise ValueError("INVALID_REASONING_DETAIL")
            equivalent = ((row["promptTokens"] - cached) * RATES["input"]
                          + cached * RATES["cached"] + row["completionTokens"] * RATES["output"]) / MILLION
            router_formula = equivalent + reasoning * RATES["output"] / MILLION
            if abs(Decimal(str(row["cost"])) - router_formula) > Decimal("0.000000001"):
                raise ValueError("ROUTER_COST_FORMULA_MISMATCH")
            matched.append({"cell": job["id"], "condition": job["condition"],
                            "request": record["id"], "routerRowId": row["id"],
                            "timestampDeltaMs": timestamp_ms(row["timestamp"]) - completion,
                            "ledgerInput": record["inputTokens"], "upstreamInput": row["promptTokens"],
                            "output": row["completionTokens"], "cached": cached, "reasoning": reasoning,
                            "recoveredZeroCache": record["cacheReadTokens"] is None,
                            "routerCostUsd": money(Decimal(str(row["cost"]))),
                            "standardApiEquivalentUsd": money(equivalent)})
    if len(matched) != state["usage"]["requests"] or len(matched) != 73:
        raise ValueError("INCOMPLETE_CAMPAIGN_MATCH")
    groups = []
    for condition in ("codex", "prototype"):
        subset = [r for r in matched if r["condition"] == condition]
        totals = {key: sum(r[key] for r in subset) for key in
                  ("ledgerInput", "upstreamInput", "output", "cached", "reasoning", "recoveredZeroCache")}
        totals.update(condition=condition, requests=len(subset),
                      uncached=totals["upstreamInput"] - totals["cached"],
                      routerCostUsd=money(sum(Decimal(r["routerCostUsd"]) for r in subset)),
                      standardApiEquivalentUsd=money(sum(Decimal(r["standardApiEquivalentUsd"]) for r in subset)))
        groups.append(totals)
    result = {"schemaVersion": 1, "campaignId": campaign, "matchedRequests": len(matched),
              "uniqueRouterRows": len(used), "maxTimestampDifferenceMs": max(abs(r["timestampDeltaMs"]) for r in matched),
              "ratesUsdPerMillion": {k: str(v) for k, v in RATES.items()},
              "rateReference": "https://developers.openai.com/api/docs/models/gpt-6-astra",
              "rateVerifiedDate": "2026-10-16", "authType": "oauth", "totals": groups,
              "basis": "Standard short-context API-equivalent; no logged cache writes; reasoning already included in output",
              "actualInvoiceVerified": False, "modelRequestsPerformedByAudit": 0,
              "matchDigest": hashlib.sha256(json.dumps(matched, sort_keys=True).encode()).hexdigest()}
    return result, matched


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", required=True, type=pathlib.Path)
    parser.add_argument("--campaign", default="codex-pi-v2-20261016")
    args = parser.parse_args()
    summary, records = audit(args.database, args.campaign)
    private = ROOT / "agent/live-private/codex-pi-cost-audit.json"
    private.write_text(json.dumps({"summary": summary, "matches": records}, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
