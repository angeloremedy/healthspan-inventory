#!/usr/bin/env python3
"""remedy-loop triage — one read-only Claude pass per NEW observer issue.

    python tools/loop/triage.py created-issues.txt

For each issue number in the file (written by file_findings.py), reads the issue, asks
Claude (Read/Glob/Grep only, small budget) for likely cause, proposed fix and whether
the loop can take it, and posts that as a comment. It never adds `agent:ready`: a
person decides that. At most MAX_ISSUES per night so a bad night cannot run up usage.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
import sys
from pathlib import Path

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

ROOT = Path(__file__).resolve().parents[2]
AGENT = (Path(__file__).resolve().parent / "agents" / "triage.md").read_text()
MAX_ISSUES = 5


def gh(*args: str, input_text: str | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(["gh", *args], text=True, capture_output=True, input=input_text, cwd=ROOT)


async def triage(num: str) -> tuple[str, float]:
    r = gh("issue", "view", num, "--json", "title,body")
    if r.returncode != 0:
        return "", 0.0
    it = json.loads(r.stdout)
    prompt = (f"Issue #{num}: {it['title']}\n\n{it.get('body') or ''}\n\n"
              "Read what you need, then write the comment.")
    options = ClaudeAgentOptions(
        system_prompt={"type": "preset", "preset": "claude_code", "append": AGENT},
        allowed_tools=["Read", "Glob", "Grep"],
        permission_mode="default",
        cwd=str(ROOT),
        setting_sources=["project"],
        max_turns=25,
        max_budget_usd=1.0,
    )
    text, cost = "", 0.0
    async for msg in query(prompt=prompt, options=options):
        if isinstance(msg, ResultMessage):
            text, cost = msg.result or "", float(msg.total_cost_usd or 0.0)
    return text.strip(), cost


async def main() -> int:
    f = Path(sys.argv[1] if len(sys.argv) > 1 else "created-issues.txt")
    nums = [n.strip() for n in (f.read_text().split() if f.exists() else []) if n.strip().isdigit()]
    if not nums:
        print("no new issues to triage")
        return 0
    total = 0.0
    for num in nums[:MAX_ISSUES]:
        try:
            text, cost = await triage(num)
        except Exception as e:                       # triage is a nicety; never fail the night
            print(f"#{num}: triage failed: {e}")
            continue
        total += cost
        if text:
            gh("issue", "comment", num, "--body-file", "-",
               input_text=f"🤖 **Triage** (read-only, no changes made)\n\n{text}\n\n_cost ${cost:.2f}_")
            print(f"#{num}: commented (${cost:.2f})")
    if len(nums) > MAX_ISSUES:
        print(f"{len(nums) - MAX_ISSUES} new issues not triaged (nightly cap {MAX_ISSUES})")
    print(f"triage total ${total:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
