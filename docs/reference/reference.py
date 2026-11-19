#!/usr/bin/env python3
"""MedGit reference implementation (executable specification).

Purpose: an independent oracle for the normaliser and the merge described in
docs/MERGE_SEMANTICS.md. It produced the `expected` blocks in data/scenarios/*.json.
It is NOT shipped in the app. Use it to settle "what should this input normalise to?"
questions:

    python3 docs/reference/reference.py --check            # verify all scenario fixtures
    python3 docs/reference/reference.py --item "Glucophage 500 BD"   # quick normalise probe

Rules here and in docs/MERGE_SEMANTICS.md must agree. If they do not, stop and ask the human.
"""
import json, re, sys, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
F = json.load(open(os.path.join(ROOT, "data", "formulary.json")))["items"]
issues_dup = []

# ---------------------------------------------------------------- normaliser + merge reference
def norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()

ALIAS = []  # (tokens tuple, id)
seen = {}
for it in F:
    for a in it["aliases"]:
        t = tuple(norm(a).split())
        if t in seen and seen[t] != it["id"]:
            raise SystemExit(f"alias collision {a} {it['id']} {seen[t]}")
        seen[t] = it["id"]
        ALIAS.append((t, it["id"]))
ALIAS.sort(key=lambda x: (-len(x[0]), x[0]))
BYID = {i["id"]: i for i in F}

def map_drug(name, form):
    toks = norm((name or "") + " " + (form or "")).split()
    for t, id_ in ALIAS:
        n = len(t)
        for i in range(len(toks) - n + 1):
            if tuple(toks[i:i+n]) == t:
                return id_
    return None

UNIT_MG = {"g": 1000.0, "mg": 1.0, "mcg": 0.001, "ug": 0.001, "µg": 0.001}
SRE = re.compile(r"(\d+(?:\.\d+)?)(?:\s*/\s*(\d+(?:\.\d+)?))?\s*(mg|mcg|µg|ug|g|ml|iu)\b", re.I)

def r6(x):
    return round(x + 0.0, 6)

def parse_strength(text, unit_c):
    if not text: return None
    m = SRE.search(text)
    if not m: return None
    vals = [float(m.group(1))] + ([float(m.group(2))] if m.group(2) else [])
    u = m.group(3).lower()
    if u in UNIT_MG:
        if unit_c in (None,):
            tgt = "mcg" if u in ("mcg","ug","µg") else "mg"
        else:
            tgt = unit_c
        if tgt not in UNIT_MG: return None
        vals = [r6(v * UNIT_MG[u] / UNIT_MG[tgt]) for v in vals]
        return (vals, tgt)
    # ml / iu: only valid if canonical matches
    if unit_c is None or unit_c == u:
        return ([r6(v) for v in vals], u)
    return None

ONCE = {"od","qd","once daily","once a day","once","daily","hs","at night","nocte","night","mane","morning","every morning","in the morning","at bedtime","bedtime","1 day"}
TWICE = {"bd","bid","bds","twice daily","twice a day","2 times a day","two times daily"}
THRICE = {"tds","tid","three times daily","three times a day","3 times a day"}
FOUR = {"qid","qds","four times daily","4 times a day"}
PRN = {"prn","sos","as needed","when required","if needed","as required"}

def parse_freq(text):
    if not text: return None
    t = text.strip().lower()
    m = re.fullmatch(r"([01])-([01])-([01])(?:-([01]))?", t)
    if m:
        s = sum(int(g) for g in m.groups() if g is not None)
        return ("s", s) if 1 <= s <= 4 else None
    m = re.fullmatch(r"([1-4])\s*/\s*day", t)
    if m: return ("s", int(m.group(1)))
    n = norm(t.replace(".", ""))
    if n in ONCE: return ("s", 1)
    if n in TWICE: return ("s", 2)
    if n in THRICE: return ("s", 3)
    if n in FOUR: return ("s", 4)
    if n in PRN: return ("p", None)
    return None

ACTIVE = {"active","current","taking","continue","continuing","ongoing"}
STOPPED = {"stopped","discontinued","dc","ceased","not taking","stop"}
HOLD = {"on hold","hold","held","paused","suspended"}

def parse_status(text):
    if text is None or text.strip() == "": return "active", None
    n = norm(text)
    if n in ACTIVE: return "active", None
    if n in STOPPED: return "stopped", None
    if n in HOLD: return "on-hold", None
    return "active", "UNPARSED_STATUS"

def fmt_strength(s):
    if s is None: return "null"
    vals, u = s
    return "/".join(("%g" % v) for v in vals) + " " + u

def fmt_freq(fq):
    if fq is None: return "null"
    return "prn" if fq[0] == "p" else f"{fq[1]}/day"

def normalise_item(raw):
    issues = []
    id_ = map_drug(raw.get("name"), raw.get("form"))
    if id_ is None:
        slug = "unmapped:" + norm(raw.get("name","")).replace(" ", "-")
        unit_c = None
        issues.append("UNMAPPED_DRUG")
    else:
        slug = id_
        unit_c = BYID[id_]["canonicalUnit"]
    s = parse_strength(raw.get("strength"), unit_c)
    if s is None and not raw.get("strength"):
        s = parse_strength(raw.get("name"), unit_c)
    if s is None:
        issues.append("UNPARSED_STRENGTH")
    elif id_ is not None and s[0] not in [x for x in BYID[id_]["strengths"]]:
        issues.append("STRENGTH_NOT_IN_FORMULARY")
    fq = parse_freq(raw.get("frequency"))
    if fq is None:
        issues.append("UNPARSED_FREQUENCY")
    st, si = parse_status(raw.get("status"))
    if si: issues.append(si)
    return dict(drugKey=slug, strength=s, frequency=fq, status=st), issues

def summary(e):
    return f"{fmt_strength(e['strength'])}|{fmt_freq(e['frequency'])}|{e['status']}"

def normalise_list(items):
    """Returns ({drugKey: entry}, issues). A repeated drugKey inside one list adds DUPLICATE_DRUG
    (a blocking issue: the list is invalid and merge must refuse it)."""
    out, iss = {}, []
    for it in items:
        e, i = normalise_item(it)
        if e["drugKey"] in out:
            iss.append("DUPLICATE_DRUG")
            continue
        out[e["drugKey"]] = e
        iss += i
    return out, iss

# ---------------------------------------------------------------- merge reference
KIND_ORDER = {"OMISSION": 0, "DOSE": 1, "FREQUENCY": 2, "STATUS": 3}

def merge(sources, base_entries):
    ids = sorted(sources)
    keys = sorted(set(k for s in ids for k in sources[s]))
    clean, conflicts = [], []
    for k in keys:
        listing = [s for s in ids if k in sources[s]]
        has_conflict = False
        if len(listing) < len(ids):
            has_conflict = True
            conflicts.append(dict(id=f"{k}::OMISSION", kind="OMISSION",
                claims={s: (summary(sources[s][k]) if k in sources[s] else None) for s in ids}))
        for kind, fld, fmt in (("DOSE","strength",fmt_strength),("FREQUENCY","frequency",fmt_freq),("STATUS","status",str)):
            vals = {s: fmt(sources[s][k][fld]) for s in listing}
            if len(set(vals.values())) > 1:
                has_conflict = True
                conflicts.append(dict(id=f"{k}::{kind}", kind=kind, claims=vals))
        if not has_conflict:
            e = sources[listing[0]][k]
            change = None
            if base_entries is not None:
                if k not in base_entries: change = "added"
                else: change = "unchanged" if summary(base_entries[k]) == summary(e) else "changed"
            clean.append(dict(drugKey=k, agreedBy=ids, changeVsBase=change))
    conflicts.sort(key=lambda c: (c["id"].split("::")[0], KIND_ORDER[c["kind"]]))
    removed = []
    if base_entries is not None:
        removed = sorted(k for k in base_entries if k not in keys)
    return clean, conflicts, removed



def build(sc):
    srcs, issues = {}, {}
    for s in sc["sources"]:
        lst, iss = normalise_list(s["items"])
        srcs[s["id"]] = lst
        issues[s["id"]] = sorted(set(iss))
    base = None
    if sc["priorCommits"]:
        base, _ = normalise_list(sc["priorCommits"][-1]["items"])
    clean_, conf, removed = merge(srcs, base)
    return dict(
        normalised={sid: {k: summary(e) for k, e in sorted(l.items())} for sid, l in srcs.items()},
        issues={k: v for k, v in issues.items() if v},
        clean=clean_, conflicts=conf, removedVsBase=removed)

def check():
    bad = 0
    d = os.path.join(ROOT, "data", "scenarios")
    for fn in sorted(os.listdir(d)):
        sc = json.load(open(os.path.join(d, fn)))
        got = build(sc)
        for k in ("normalised", "issues", "clean", "conflicts", "removedVsBase"):
            if got[k] != sc["expected"][k]:
                bad += 1
                print("MISMATCH", sc["id"], k)
        print("ok  " if not bad else "....", sc["id"], "clean", len(got["clean"]), "conflicts", len(got["conflicts"]))
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    if "--check" in sys.argv:
        check()
    elif "--item" in sys.argv:
        text = sys.argv[sys.argv.index("--item") + 1]
        raw = {"name": text}
        e, i = normalise_item(raw)
        print(json.dumps(dict(drugKey=e["drugKey"], summary=summary(e), issues=i), indent=2))
    else:
        print(__doc__)
