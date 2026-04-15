---
name: opportunity-sweep
description: Use when scanning Reddit for software market opportunities, pain points, or unmet needs. Use when asked to find SaaS ideas, analyze market demand, or run opportunity gap analysis.
---

# 1-Month Opportunity Sweep

## Overview

Run a comprehensive scan of Reddit pain-point posts to identify software market opportunities. Collects posts, analyzes with Claude for pay signals and frustration scores, then exports actionable opportunities.

## Prerequisites

- `scrape-gaps` CLI installed (`uv pip install -e /Users/emma.hyde/personal/scrape-opportunity-gaps`)
- Environment variables set in `.env`:
  - `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`
  - `ANTHROPIC_API_KEY`

## Quick Reference

| Command | Purpose |
|---------|---------|
| `scrape-gaps collect` | Fetch posts from Reddit |
| `scrape-gaps analyze` | Run Claude analysis on unprocessed posts |
| `scrape-gaps query` | Search/filter opportunities |
| `scrape-gaps export` | Export to CSV |
| `scrape-gaps stats` | Show database statistics |

## The Sweep Process

```bash
# 1. Collect from high-signal subreddits (1 month, ~50 posts each)
scrape-gaps collect --subreddits "SaaS,microsaas,startups,Entrepreneur,smallbusiness,ADHD,selfhosted,productivity" --time month --limit 50

# 2. Collect via pain-point search queries
scrape-gaps collect --search "looking for a tool" --search "I wish there was" --search "I'd pay for" --search "frustrated with" --time month --limit 100

# 3. Analyze collected posts (in batches to manage API costs)
scrape-gaps analyze --limit 100

# 4. Review top opportunities
scrape-gaps query --min-opportunity 7 --limit 30

# 5. Export for deeper analysis
scrape-gaps export --output opportunities-$(date +%Y-%m-%d).csv
```

## High-Signal Subreddits

**Builder communities:** SaaS, microsaas, startups, Entrepreneur, indiehackers
**Business pain points:** smallbusiness, freelance, realestateinvesting
**Technical users (pay for tools):** selfhosted, devops, webdev, sysadmin
**Detailed feature requests:** ADHD, productivity, personalfinance

## Interpreting Results

| Score | Meaning |
|-------|---------|
| **Opportunity 8-10** | Strong signal - specific pain, pay intent, feasible solution |
| **Opportunity 5-7** | Moderate - valid pain but unclear monetization |
| **Pay Signal 7+** | Explicit budget/premium mentions |
| **Frustration 8+** | Long, detailed posts - treat as product requirements |

## Common Queries

```bash
# Find highest-paying opportunities
scrape-gaps query --min-pay-signal 7 --sort pay_signal_score

# Find most frustrated users (detailed requirements)
scrape-gaps query --min-frustration 8 --sort frustration_score

# Filter by category
scrape-gaps query --category "Finance" --min-opportunity 6
scrape-gaps query --category "DevTools" --min-opportunity 6

# Search specific topics
scrape-gaps query --search "inventory" --min-opportunity 5
scrape-gaps query --search "invoicing" --min-pay-signal 5
```

## Cost Estimate

- ~1000 tokens per post analysis
- 500 posts ≈ $2-4 with Claude Sonnet
- Full month sweep (1000+ posts) ≈ $5-10
