#!/usr/bin/env python3
"""Count tokens of stdin using tiktoken cl100k_base.

A standard tokenizer, so mcx's numbers are reproducible. Measurement tool only —
the scenario logic lives in the Ruby scripts under chains/.

Usage:
  producer | python3 count_tokens.py           -> prints an integer
  producer | python3 count_tokens.py --batch    -> stdin is a JSON {label: text}
                                                    map; prints {label: count} JSON
"""
import json
import sys

try:
    import tiktoken
except ImportError:
    sys.stderr.write("tiktoken not installed; run via: uv run --with tiktoken python3 count_tokens.py\n")
    sys.exit(2)

enc = tiktoken.get_encoding("cl100k_base")
data = sys.stdin.buffer.read().decode("utf-8", errors="replace")

if "--batch" in sys.argv[1:]:
    items = json.loads(data)
    print(json.dumps({k: len(enc.encode(v)) for k, v in items.items()}))
else:
    print(len(enc.encode(data)))
