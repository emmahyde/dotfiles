"""
Monthly Recurring Revenue (MRR) calculator with mid-month proration.

Input: CSV file (or stdin) with columns:
  customer, plan_monthly_usd, start_day, days_in_month

Proration formula: plan_monthly_usd * (days_in_month - start_day + 1) / days_in_month

Output: per-customer breakdown + total MRR (human-readable; --json for machine use)

Usage:
  python mrr_calc.py subscriptions.csv
  python mrr_calc.py subscriptions.csv --json
  cat subscriptions.csv | python mrr_calc.py -
  python mrr_calc.py --test   # run smoke test

Example:
  python mrr_calc.py data.csv
  # acme       $100.00  (100% of month)
  # beta       $125.00  (50% of month)
  # ...
  # Total MRR: $448.33
"""

import csv
import json
import sys
from decimal import Decimal, ROUND_HALF_UP


def compute_mrr(rows):
    """
    rows: list of dicts with keys customer, plan_monthly_usd, start_day, days_in_month
    Returns list of {customer, plan_monthly_usd, start_day, days_in_month, prorated_usd, pct_of_month}
    """
    results = []
    for r in rows:
        plan = Decimal(str(r["plan_monthly_usd"]))
        start = int(r["start_day"])
        days = int(r["days_in_month"])
        active_days = days - start + 1
        prorated = (plan * active_days / days).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        results.append({
            "customer": r["customer"].strip(),
            "plan_monthly_usd": float(plan),
            "start_day": start,
            "days_in_month": days,
            "active_days": active_days,
            "prorated_usd": float(prorated),
            "pct_of_month": round(active_days / days * 100, 1),
        })
    return results


def load_csv(source):
    if source == "-":
        reader = csv.DictReader(sys.stdin)
    else:
        with open(source) as f:
            return list(csv.DictReader(f))
    return list(reader)


def format_human(results):
    total = sum(Decimal(str(r["prorated_usd"])) for r in results)
    lines = []
    for r in results:
        lines.append(
            f"  {r['customer']:<12} ${r['prorated_usd']:>8.2f}"
            f"  ({r['active_days']}/{r['days_in_month']} days = {r['pct_of_month']}%)"
        )
    lines.append(f"\n  {'Total MRR':<12} ${float(total):>8.2f}")
    return "\n".join(lines)


def smoke_test():
    rows = [
        {"customer": "acme",  "plan_monthly_usd": 100, "start_day": 1,  "days_in_month": 30},
        {"customer": "beta",  "plan_monthly_usd": 250, "start_day": 16, "days_in_month": 30},
        {"customer": "gamma", "plan_monthly_usd": 90,  "start_day": 1,  "days_in_month": 30},
        {"customer": "delta", "plan_monthly_usd": 400, "start_day": 21, "days_in_month": 30},
    ]
    results = compute_mrr(rows)
    totals = {r["customer"]: r["prorated_usd"] for r in results}
    assert totals["acme"]  == 100.00, f"acme: {totals['acme']}"
    assert totals["beta"]  == 125.00, f"beta: {totals['beta']}"
    assert totals["gamma"] ==  90.00, f"gamma: {totals['gamma']}"
    assert totals["delta"] == 133.33, f"delta: {totals['delta']}"
    total = sum(r["prorated_usd"] for r in results)
    assert abs(total - 448.33) < 0.01, f"total: {total}"
    print("smoke test PASSED")
    print(format_human(results))


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] == "--test":
        smoke_test()
        sys.exit(0)

    use_json = "--json" in args
    source = next((a for a in args if not a.startswith("--")), "-")

    rows = load_csv(source)
    results = compute_mrr(rows)
    total = round(sum(r["prorated_usd"] for r in results), 2)

    if use_json:
        print(json.dumps({"rows": results, "total_mrr_usd": total}, indent=2))
    else:
        print(format_human(results))
