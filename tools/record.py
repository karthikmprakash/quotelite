#!/usr/bin/env python3
"""Evidence recorder. The ONLY way a feature may be marked verified.

Usage:
  python3 tools/record.py F3 --cmd "npm test"                 # runs it, records output, flips status on exit 0
  python3 tools/record.py F3 --cmd "npx playwright test" --note "offline sync"
  python3 tools/record.py F3 --status blocked --note "needs Stripe test key"
  python3 tools/record.py F3 --show                           # print the recorded evidence

Rules enforced:
  * status may only become 'verified' if the command ran and exited 0
  * the raw output (and exit code) is appended to replica/EVIDENCE.md as a receipt
  * statuses cannot be set to 'verified' with --status without --cmd
Stdlib only.
"""
import argparse, datetime, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEAT = os.path.join(ROOT, "replica", "features.json")
EVID = os.path.join(ROOT, "replica", "EVIDENCE.md")

def load():
    with open(FEAT, encoding="utf-8") as fh:
        return json.load(fh)

def save(p):
    with open(FEAT, "w", encoding="utf-8") as fh:
        json.dump(p, fh, indent=2)
        fh.write("\n")

def find(p, fid):
    for f in p["features"]:
        if f["id"].lower() == fid.lower():
            return f
    sys.exit(f"no such feature id: {fid}")

def append_evidence(fid, name, cmd, code, out, note):
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    with open(EVID, "a", encoding="utf-8") as fh:
        fh.write(f"\n## [{fid}] {name} — {ts}\n\n")
        if note:
            fh.write(f"note: {note}\n\n")
        fh.write(f"command: `{cmd or '(none)'}`\nexit code: {code}\n\n")
        if out:
            fh.write("```\n" + out.strip()[:6000] + "\n```\n")

def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("fid")
    ap.add_argument("--cmd")
    ap.add_argument("--note", default="")
    ap.add_argument("--status", choices=["pending", "in_progress", "verified", "blocked"])
    ap.add_argument("--show", action="store_true")
    a = ap.parse_args(argv)

    p = load()
    f = find(p, a.fid)

    if a.show:
        print(f"{f['id']} {f['name']}\n  status: {f.get('status')}\n  accept: {f['acceptance']}\n  verify: {f['verify']}")
        return 0

    if a.status == "verified" and not a.cmd:
        sys.exit("REFUSED: 'verified' requires --cmd that exits 0. Use --status blocked with a note if it cannot be run.")

    code, out = None, ""
    if a.cmd:
        print(f"$ {a.cmd}")
        r = subprocess.run(a.cmd, shell=True, cwd=ROOT, capture_output=True, text=True)
        code, out = r.returncode, (r.stdout or "") + (r.stderr or "")
        print(out[-3000:] if out else "(no output)")
        print(f"exit code: {code}")

    if a.status:
        new = a.status
        if new == "verified" and code != 0:
            sys.exit(f"REFUSED: command exited {code}; cannot mark verified. Fix it or mark blocked.")
        f["status"] = new
    elif code is not None:
        f["status"] = "verified" if code == 0 else "in_progress"

    f["last_attempt"] = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    save(p)
    append_evidence(f["id"], f["name"], a.cmd, code, out, a.note)
    print(f"\n{f['id']} -> {f['status']}  (evidence appended to replica/EVIDENCE.md)")
    return 0 if f["status"] in ("verified", "blocked") else 1

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
