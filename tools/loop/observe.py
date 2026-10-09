#!/usr/bin/env python3
"""remedy-loop Level 1 — the nightly HQ observer. Runs every check, writes one report.

    python tools/loop/observe.py observe-report.md

Checks (each finding is a row; tools/loop/file_findings.py turns rows into issues):
  C1 Tests      — every suite in package.json "test", run on its own, each FAIL line
  C2 Build      — npm run build + node --check on the bundle
  C3 Manuals    — directory → compose → pagecheck → coverage
  C4 Workflows  — the latest run of every other workflow on main; leftover bot branches
  C5 Live site  — hq.healthspan.ph: page up, running main's build, a session-checked
                  function answers 401, the sign-in screen has no errors

Exit 0 always (findings are information, not a broken job). Read-only: it never
changes the repo; the manuals step puts _directory.json back.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAMES = {"C1": "Tests", "C2": "Build", "C3": "Manuals", "C4": "Workflows", "C5": "Live site"}


def sh(cmd: str, timeout: int = 900, env: dict | None = None) -> tuple[int, str]:
    e = dict(os.environ, **(env or {}))
    try:
        r = subprocess.run(cmd, shell=True, cwd=ROOT, text=True, capture_output=True,
                           timeout=timeout, env=e)
        return r.returncode, (r.stdout + r.stderr)
    except subprocess.TimeoutExpired as ex:
        return 124, f"timed out after {timeout}s: {cmd}"


def clean(msg: str) -> str:
    return re.sub(r"\s+", " ", msg.replace("|", "/")).strip()[:180]


def check_tests(rows: list) -> None:
    script = json.loads((ROOT / "package.json").read_text())["scripts"]["test"]
    for part in [p.strip() for p in script.split("&&")]:
        suite = part.split()[-1]
        rc, out = sh(part, env={"TZ": "Asia/Manila"})
        fails = [l for l in out.splitlines() if l.startswith("FAIL ")]
        for l in fails:
            rows.append(("C1", suite, "fail", clean(l[5:].split("  → ")[0])))
        if rc != 0 and not fails:
            last = [l for l in out.splitlines() if l.strip()][-1:] or ["(no output)"]
            rows.append(("C1", suite, "fail", clean(f"suite stopped with exit {rc}: {last[0]}")))


def check_build(rows: list) -> str:
    rc, out = sh("rm -rf dist && npm run build && node --check dist/app.*.js")
    bundle = ""
    m = re.search(r"app\.[0-9a-f]+\.js", out)
    if m:
        bundle = m.group(0)
    if rc != 0:
        rows.append(("C2", "tools/build.mjs", "fail", clean("build smoke failed: " + out.strip().splitlines()[-1])))
    sh("rm -rf dist")
    return bundle


def check_manuals(rows: list) -> None:
    try:
        rc, out = sh("rm -rf manuals-new && node tools/manuals/directory.js")
        if rc != 0:
            rows.append(("C3", "directory.js", "fail", clean("directory build failed: " + out.strip()[-150:])))
            return
        rc, out = sh("cd tools/manuals && python3 compose.py ../../manuals-new")
        if rc != 0:
            rows.append(("C3", "compose.py", "fail", clean("manuals did not compose: " + out.strip()[-150:])))
            return
        rc, out = sh("cd tools/manuals && python3 pagecheck.py ../../manuals-new")
        if rc != 0 or "pagecheck: clean" not in out:
            for l in [l for l in out.splitlines() if l.strip() and "pagecheck: clean" not in l][:20]:
                rows.append(("C3", "pagecheck", "fail", clean(l)))
        rc, out = sh("node tools/manuals/coverage.js")
        for l in out.splitlines():
            m = re.match(r"^(\S+)\s+allowed\s+\d+\s+missing: (.+)$", l)
            if m and m.group(2).strip() != "—":
                rows.append(("C3", m.group(1), "fail", clean("manual does not document: " + m.group(2))))
    finally:
        sh("git checkout -q -- tools/manuals/content/_directory.json; rm -rf manuals-new")


def check_workflows(rows: list) -> None:
    rc, out = sh("gh api 'repos/{owner}/{repo}/actions/workflows' -q '.workflows[] | [.id, .path] | @tsv'", timeout=60)
    if rc != 0:
        rows.append(("C4", "gh", "warn", clean("could not read workflow runs: " + out.strip()[-120:])))
        return
    for line in out.strip().splitlines():
        wid, wpath = line.split("\t")
        name = Path(wpath).name
        if name in ("observe.yml", "repair.yml"):
            continue
        rc, runs = sh(f"gh api 'repos/{{owner}}/{{repo}}/actions/workflows/{wid}/runs?branch=main&status=completed&per_page=1'"
                      " -q '.workflow_runs[0] | [.conclusion, .created_at, .html_url, .event] | @tsv'", timeout=60)
        if rc != 0 or not runs.strip():
            continue
        concl, at, url, event = (runs.strip().split("\t") + ["", "", "", ""])[:4]
        if concl == "failure":
            rows.append(("C4", name, "fail", clean(f"last {event} run failed ({at[:10]}): {url}")))
    rc, br = sh("gh api 'repos/{owner}/{repo}/branches?per_page=100' -q '.[].name'", timeout=60)
    if rc == 0:
        bot = [b for b in br.split() if b.startswith("manuals/")]
        if bot:
            rows.append(("C4", "branches", "warn",
                         clean(f"{len(bot)} leftover manuals/* branches from failed nightly runs (oldest {sorted(bot)[0]})")))


def check_live(rows: list, bundle: str) -> None:
    rc, out = sh(f"node tools/loop/live-check.mjs --bundle '{bundle}'", timeout=180)
    i = out.find("{")
    try:
        j, _ = json.JSONDecoder().raw_decode(out[i:])   # stderr may follow the JSON
    except Exception:
        rows.append(("C5", "live-check", "warn", clean("live check did not run: " + out.strip()[-150:])))
        return None
    for f in j["findings"]:
        rows.append(("C5", f["loc"], f["sev"], clean(f["msg"])))
    return j.get("info")


def main() -> int:
    out_path = Path(sys.argv[1] if len(sys.argv) > 1 else "observe-report.md")
    rows: list = []
    check_tests(rows)
    bundle = check_build(rows)
    check_manuals(rows)
    check_workflows(rows)
    info = check_live(rows, bundle)

    lines = ["# HQ nightly observer", "",
             f"{sum(1 for r in rows if r[2] == 'fail')} fail · {sum(1 for r in rows if r[2] == 'warn')} warn"
             + (f" · live bundle {info.get('liveBundle')} · main bundle {bundle}" if info else ""), ""]
    for cid, name in NAMES.items():
        mine = [r for r in rows if r[0] == cid]
        lines += [f"## {cid} — {name}", ""]
        if not mine:
            lines += ["No findings.", ""]
            continue
        lines += ["| Location | Severity | Message |", "|---|---|---|"]
        lines += [f"| {loc} | {sev} | {msg} |" for _, loc, sev, msg in mine]
        lines.append("")
    out_path.write_text("\n".join(lines))
    print("\n".join(lines[:4]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
