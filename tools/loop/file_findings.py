#!/usr/bin/env python3
"""Turn the HQ observer report into GitHub issues, idempotently.

    python tools/loop/file_findings.py observe-report.md

- Groups findings into *classes*: (check id, message with digits/handles stripped).
  One issue per class, listing every affected location.
- Each issue carries a hidden `<!-- finding-key: ... -->` marker in its body.
- New class      -> open an issue (labels: hq-finding, check:<id>, severity:<fail|warn>,
                    plus agent:ready if the check is in AUTOFIX_CHECKS).
- Existing class -> update the body if the location list changed.
- Vanished class -> close the issue with a comment.

Needs `gh` on PATH and GH_TOKEN / GH_REPO in the environment (GitHub Actions
provides both). Checks listed in IGNORE_CHECKS are skipped. The numbers of issues
created in this run are written, one per line, to $FINDINGS_CREATED (if set) so the
triage step comments on new issues only.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

LABEL_BASE = "hq-finding"
KEY_RE = re.compile(r"<!-- finding-key: (.+?) -->")
ROW_RE = re.compile(r"^\|\s*(\S+)\s*\|\s*(fail|warn)\s*\|\s*(.+?)\s*\|\s*$")
SECTION_RE = re.compile(r"^## (C\d+) — (.+)$")

IGNORE = {c.strip() for c in os.environ.get("IGNORE_CHECKS", "").split(",") if c.strip()}
AUTOFIX = {c.strip() for c in os.environ.get("AUTOFIX_CHECKS", "").split(",") if c.strip()}


def gh(*args: str, input_text: str | None = None) -> str:
    r = subprocess.run(["gh", *args], text=True, capture_output=True, input=input_text)
    if r.returncode != 0:
        sys.stderr.write(r.stderr)
        raise SystemExit(f"gh {' '.join(args[:2])} failed")
    return r.stdout


# ------------------------------------------------------------------ parse

def parse_report(path: Path) -> dict[str, dict]:
    """Return {class_key: {check, name, severity, message, locations}}."""
    classes: dict[str, dict] = {}
    check, name = None, None
    for line in path.read_text().splitlines():
        m = SECTION_RE.match(line)
        if m:
            check, name = m.group(1), m.group(2)
            continue
        m = ROW_RE.match(line)
        if not (m and check):
            continue
        loc, sev, msg = m.groups()
        if loc == "Location" or check in IGNORE:
            continue
        # class = check + message with volatile bits normalised
        norm = re.sub(r"\d[\d,\.]*", "N", msg)
        norm = re.sub(r"(https?://\S+|/[\w\-/]+)", "PATH", norm)
        key = f"{check}|{norm}"
        c = classes.setdefault(key, {"check": check, "name": name, "severity": sev,
                                     "message": msg, "locations": []})
        c["locations"].append((loc, msg))
        if sev == "fail":
            c["severity"] = "fail"
    return classes


# ------------------------------------------------------------------ issues

def existing_issues() -> dict[str, dict]:
    out = gh("issue", "list", "--state", "open", "--label", LABEL_BASE,
             "--limit", "200", "--json", "number,title,body,labels")
    found = {}
    for it in json.loads(out):
        m = KEY_RE.search(it.get("body") or "")
        if m:
            found[m.group(1)] = it
    return found


def issue_title(c: dict) -> str:
    n = len(c["locations"])
    where = f"{n} place{'s' if n != 1 else ''}"
    return f"[{c['check']}] {c['severity']}: {c['message'][:70]} ({where})"


def issue_body(key: str, c: dict, run_url: str) -> str:
    rows = "\n".join(f"- {loc} — {msg}" for loc, msg in c["locations"])
    return f"""<!-- finding-key: {key} -->
**Check:** {c['check']} — {c['name']}
**Severity:** {c['severity']}
**Filed by:** nightly observer ({run_url})

### Affected
{rows}

### Acceptance criterion
`bash tools/loop/gate.sh` passes, and the next nightly observer run reports no
`{c['check']}` finding matching "{c['message']}" for the locations above. The issue
closes itself when that happens.

### Notes for the repair loop
- Only change what is needed to clear this finding class.
- Follow CLAUDE.md: never touch its protected paths, never weaken a test to make it pass.
- If the fix needs SQL, a secret, a Netlify or GitHub setting, or a product decision,
  say so instead of working around it.

To let the loop try a fix, add the label `agent:ready`.
"""


def ensure_labels(needed: set[str]) -> None:
    have = {l["name"] for l in json.loads(gh("label", "list", "--limit", "200", "--json", "name"))}
    colours = {"hq-finding": "0E8A16", "agent:ready": "5319E7",
               "severity:fail": "B60205", "severity:warn": "FBCA04"}
    for lab in needed - have:
        gh("label", "create", lab, "--color", colours.get(lab, "BFD4F2"), "--force")


# ------------------------------------------------------------------- main

def main() -> int:
    report = Path(sys.argv[1] if len(sys.argv) > 1 else "live-report.md")
    if not report.exists():
        print(f"no report at {report}; nothing to file")
        return 0
    run_url = (f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/"
               f"{os.environ.get('GH_REPO', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}")

    classes = parse_report(report)
    open_now = existing_issues()

    labels_needed = {LABEL_BASE, "severity:fail", "severity:warn", "agent:ready"} | \
                    {f"check:{c['check']}" for c in classes.values()}
    ensure_labels(labels_needed)

    created = updated = closed = 0
    new_numbers: list[str] = []
    for key, c in classes.items():
        body = issue_body(key, c, run_url)
        labels = [LABEL_BASE, f"check:{c['check']}", f"severity:{c['severity']}"]
        if c["check"] in AUTOFIX:
            labels.append("agent:ready")
        if key in open_now:
            it = open_now.pop(key)
            old_locs = set(re.findall(r"^- (\S+) — ", it["body"], re.M))
            if old_locs != {loc for loc, _ in c["locations"]}:
                gh("issue", "edit", str(it["number"]), "--title", issue_title(c),
                   "--body-file", "-", input_text=body)
                updated += 1
        else:
            url = gh("issue", "create", "--title", issue_title(c),
                     "--label", ",".join(labels), "--body-file", "-", input_text=body).strip()
            new_numbers.append(url.rstrip("/").split("/")[-1])
            created += 1

    for key, it in open_now.items():   # classes that no longer appear
        gh("issue", "close", str(it["number"]), "--comment",
           f"Not present in tonight's observer run ({run_url}). Closing.")
        closed += 1

    if os.environ.get("FINDINGS_CREATED"):
        Path(os.environ["FINDINGS_CREATED"]).write_text("\n".join(new_numbers))
    print(f"findings: {len(classes)} classes | issues created {created}, "
          f"updated {updated}, closed {closed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
