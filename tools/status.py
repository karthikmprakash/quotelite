#!/usr/bin/env python3
"""Build status from replica/features.json. Stdlib only.

Usage:
  python3 tools/status.py            # summary + next pending feature
  python3 tools/status.py --all      # list every feature
  python3 tools/status.py --next N   # list next N pending (default 5)
Exit codes: 0 = nothing pending (safe to finish), 2 = work remaining.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, "replica", "features.json")

def load():
    with open(F, encoding="utf-8") as fh:
        return json.load(fh)

def main(argv):
    show_all = "--all" in argv
    n = 5
    if "--next" in argv:
        n = int(argv[argv.index("--next") + 1])
    p = load()
    feats = p["features"]
    by_status = {}
    for f in feats:
        by_status.setdefault(f.get("status", "pending"), []).append(f)
    counts = {k: len(v) for k, v in sorted(by_status.items())}
    done = counts.get("verified", 0) + counts.get("blocked", 0)
    print(f"PRODUCT: {p.get('product')}   reference: {p.get('reference', {}).get('primary')}")
    print(f"PROGRESS: {done}/{len(feats)} resolved  {counts}")
    for k in ("verified", "blocked"):
        for f in by_status.get(k, []):
            print(f"  [{k[:4].upper()}] {f['id']} {f['name']}")
    if show_all:
        for f in feats:
            print(f"  {f.get('status','pending'):9} {f['id']:<4} {f['name']}")
    doneids = {f["id"] for f in by_status.get("verified", [])}
    todo = [f for f in feats if f.get("status", "pending") == "pending"]
    todo.sort(key=lambda f: (len(f.get("depends_on", [])), f["id"]))
    ready = [f for f in todo if all(d in doneids for d in f.get("depends_on", []))]
    if not todo:
        print("\nALL FEATURES RESOLVED. Run tools/verify.sh, then write the final report.")
        return 0
    print(f"\nNEXT {min(n, len(ready))} ACTIONABLE (deps satisfied):")
    for f in ready[:n]:
        print(f"  {f['id']}  {f['name']}")
        print(f"      accept: {f['acceptance']}")
        print(f"      verify: {f['verify']}")
    blocked_by_deps = [f for f in todo if f not in ready]
    if blocked_by_deps:
        print(f"\nWAITING ON DEPS: {', '.join(f['id'] for f in blocked_by_deps)}")
    print("\nLoop: implement next feature -> tools/record.py -> repeat. Do not stop.")
    return 2

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
