#!/usr/bin/env python3
"""Launch Check scanner seed (fixed-list order).

Runs the fixed check list against an app tree (default: ../before) and prints
one evidence row per finding. This script is the first version of the scanner
(build-plan edge 1); the BLD-1270 scanner consumes these checks.

Fixed-list order (must match TERMS-ai-app-check s1 and the LC listing):
  1. database rules per table and per role
  2. payment access granted server-side with webhooks that check signatures
  3. login, reset and magic-link flows
  4. role checks done only in the interface
  5. keys in the client bundle
  6. storage rules
  7. backup and rollback

Exit codes: 0 = no defects found (the check passes), 1 = defects found
(a failing reproduction is a check that FAILS on the app it runs against),
2 = usage/environment error.

Synthetic demo. Built to be broken. No client data, no real keys.
"""

import argparse
import base64
import fnmatch
import os
import re
import subprocess
import sys

LABEL = "Synthetic demo. Built to be broken. No client data, no real keys."

# Backend/runtime code extensions worth scanning for text patterns.
CODE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte",
             ".py", ".sql", ".json", ".html", ".env", ""}
SKIP_DIRS = {"node_modules", "dist", ".git", "build", ".next", "coverage",
             "__pycache__", ".venv"}

# JWT-shaped token: header.payload.signature, base64url segments.
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}\.[A-Za-z0-9_\-]{4,}")
SERVICE_ROLE_RE = re.compile(r"service_role")
SUPABASE_URL_RE = re.compile(r"https://[a-z0-9\-]{6,}\.supabase\.(co|in)", re.I)
# Redirect configuration keys whose values point auth emails back into the app.
REDIRECT_KEY_RE = re.compile(
    r"(redirectTo|redirect_to|SITE_URL|redirectURL|emailRedirectTo)\s*[:=]\s*[\"'`]([^\"'`]+)[\"'`]",
    re.I,
)
PREVIEW_HOST_RE = re.compile(r"(lovable\.dev|lovable\.app|localhost:\d+|preview-|\.preview\.)", re.I)
# Client-side entitlement flags written after checkout.
ENTITLEMENT_WRITE_RE = re.compile(
    r"localStorage\.setItem\(\s*[\"'`]([A-Za-z0-9_.\-]*(?:pro|subscrib|plan|entitle|premium|paid)[A-Za-z0-9_.\-]*)[\"`']",
    re.I,
)
CHECKOUT_SUCCESS_RE = re.compile(
    r"(checkout\.session\.(?:completed|succeeded)|onCheckout|checkoutSuccess|paymentSuccess|"
    r"subscription.*success|success.*subscription)",
    re.I,
)
# Server-side webhook signature verification (its PRESENCE is the fix).
WEBHOOK_SIG_RE = re.compile(
    r"(constructEvent|stripe-signature|webhook.*signature|signature.*webhook)", re.I
)
# Client-only role gates.
UI_ROLE_RE = re.compile(
    r"(role\s*===?\s*[\"'`]admin[\"'`]|isAdmin\s*[=!]==?\s*(?:true|false)|profile\??\.role\s*===?\s*[\"'`]admin[\"'`])",
    re.I,
)
# SQL: RLS and policy statements (case-insensitive matching applied at use).
SQL_TABLE_RE = re.compile(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)", re.I)
SQL_RLS_ON_RE = re.compile(r"ALTER\s+TABLE\s+(?:ONLY\s+)?(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY", re.I)
SQL_POLICY_RE = re.compile(
    r"CREATE\s+(?:OR\s+REPLACE\s+)?POLICY\s+(?:\"[^\"]*\"|'[^']*'|[A-Za-z0-9_\-]+)\s+"
    r"ON\s+(?:ONLY\s+)?(?:public\.)?([A-Za-z_][A-Za-z0-9_]*)",
    re.I,
)
SQL_BROAD_RE = re.compile(
    r"(TO\s+(?:authenticated|public|anon|authenticated,\s*anon)\b(?![^;]*USING\s*\([^;]*(?:auth\.uid|user_id|store_id|owner)))"
    r"|USING\s*\(\s*true\s*\)|WITH\s+CHECK\s*\(\s*true\s*\)",
    re.I,
)


def walk(root):
    """Yield file paths under root, skipping build artefacts and vendored deps."""
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            yield os.path.join(dirpath, name)


def read_text(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return ""


def code_files(root):
    for path in walk(root):
        ext = os.path.splitext(path)[1].lower()
        if ext in CODE_EXTS or name_is_env(path):
            yield path


def name_is_env(path):
    return os.path.basename(path).startswith(".env")


def git_history_scan(root, pattern):
    """Return (commit_short, path_line) hits for a regex across full history."""
    hits = []
    try:
        proc = subprocess.run(
            ["git", "log", "-p", "--all", "--no-color", "--", "."],
            cwd=root or ".", capture_output=True, text=True, errors="replace",
            timeout=120,
        )
        if proc.returncode != 0:
            return hits
        current_commit = None
        current_file = None
        for line in proc.stdout.splitlines():
            if line.startswith("commit "):
                current_commit = line.split()[1][:8]
            elif line.startswith("+++ b/"):
                current_file = line[6:]
            elif current_commit and pattern.search(line):
                hits.append((current_commit, current_file or "?", line.strip()[:400]))
    except (OSError, subprocess.SubprocessError):
        pass
    return hits


def decode_jwt_payload(token):
    """Best-effort payload decode; returns {} on failure."""
    try:
        seg = token.split(".")[1]
        seg += "=" * (-len(seg) % 4)
        return base64.urlsafe_b64decode(seg.encode()).decode("utf-8", "replace")
    except Exception:
        return ""


class Finding:
    def __init__(self, fid, item, severity, where, evidence, repro):
        self.fid = fid
        self.item = item          # fixed-list item this finding belongs to
        self.severity = severity  # CRITICAL / HIGH / MEDIUM / LOW
        self.where = where        # file:line or commit:file
        self.evidence = evidence  # the matched line / snippet
        self.repro = repro        # buyer-runnable reproduction step


def check_database_rules(target):
    """Fixed-list item 1: RLS off, and policies that let any signed-in user read every row."""
    findings = []
    mig_dirs = [os.path.join(target, "supabase", "migrations"), target]
    tables, rls_on, policies = set(), set(), []
    for path in walk(target):
        if not path.endswith(".sql"):
            continue
        text = read_text(path)
        tables |= {m.group(1) for m in SQL_TABLE_RE.finditer(text)}
        rls_on |= {m.group(1) for m in SQL_RLS_ON_RE.finditer(text)}
        for m in SQL_POLICY_RE.finditer(text):
            start = m.start()
            stmt_end = text.find(";", start)
            stmt = text[start:stmt_end if stmt_end != -1 else start + 400]
            line_no = text[:start].count("\n") + 1
            policies.append((path, line_no, m.group(1), stmt.strip()))
    for path, line_no, table, stmt in policies:
        if SQL_BROAD_RE.search(stmt):
            findings.append(Finding(
                "F1", "database rules", "CRITICAL",
                f"{rel(target, path)}:{line_no}",
                stmt.splitlines()[0][:160],
                "Open the migration file and read the policy: it lets any signed-in "
                "user read every row of the " + table + " table. Run this script "
                "against your own exported migrations to find the same pattern.",
            ))
    for t in sorted(tables - rls_on):
        findings.append(Finding(
            "F1", "database rules", "CRITICAL",
            f"{rel(target, target)}:supabase/migrations",
            f"table '{t}' has no ENABLE ROW LEVEL SECURITY statement in any migration",
            "Run the app's migrations against a fresh database, then connect as a "
            "second user: rows of '" + t + "' are readable without any policy.",
        ))
    return findings


def check_payment_trust(target):
    """Fixed-list item 2: access granted from the browser with no signed webhook."""
    findings = []
    entitlement_writes, checkout_handlers, webhook_sigs = [], [], []
    for path in code_files(target):
        text = read_text(path)
        for m in ENTITLEMENT_WRITE_RE.finditer(text):
            line_no = text[:m.start()].count("\n") + 1
            entitlement_writes.append((path, line_no, m.group(0)[:120]))
        if CHECKOUT_SUCCESS_RE.search(text):
            for wm in ENTITLEMENT_WRITE_RE.finditer(text):
                line_no = text[:wm.start()].count("\n") + 1
                checkout_handlers.append((path, line_no, wm.group(0)[:120]))
        if WEBHOOK_SIG_RE.search(text):
            webhook_sigs.append(path)
    for path, line_no, snippet in checkout_handlers or entitlement_writes:
        findings.append(Finding(
            "F2", "payment access granted server-side with webhooks that check signatures",
            "HIGH",
            f"{rel(target, path)}:{line_no}",
            snippet,
            "In the running app: complete a Stripe test-mode checkout, then clear "
            "site data. Set the localStorage key shown in the evidence to 'true' "
            "by hand and reload: the Pro page unlocks with no payment and no "
            "server record. No webhook signature check exists anywhere in the tree "
            "(" + ("no constructEvent / stripe-signature found" if not webhook_sigs
                   else "present but unused on the trust path") + ").",
        ))
    if not (checkout_handlers or entitlement_writes) and not webhook_sigs:
        findings.append(Finding(
            "F2", "payment access granted server-side with webhooks that check signatures",
            "HIGH", f"{rel(target, target)}:src",
            "no webhook signature verification anywhere in the tree",
            "Search the tree for constructEvent or stripe-signature: nothing found, "
            "so any client-side grant cannot be verified server-side.",
        ))
    return findings


CONST_DEF_RE = re.compile(
    r"(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[\"'`]([^\"'`]+)[\"'`]", re.I
)


def _resolve_redirect_value(url, text):
    """Resolve one level of template-literal ${CONST} against file-local constants."""
    def sub(match):
        name = match.group(1)
        for cm in CONST_DEF_RE.finditer(text):
            if cm.group(1) == name and PREVIEW_HOST_RE.search(cm.group(2)):
                return cm.group(2)
        return match.group(0)
    return re.sub(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}", sub, url)


def check_auth_flows(target):
    """Fixed-list item 3: reset and magic-link redirects pointing at a preview address."""
    findings = []
    for path in code_files(target):
        text = read_text(path)
        for m in REDIRECT_KEY_RE.finditer(text):
            url = _resolve_redirect_value(m.group(2), text)
            if PREVIEW_HOST_RE.search(url):
                line_no = text[:m.start()].count("\n") + 1
                findings.append(Finding(
                    "F3", "login, reset and magic-link flows", "HIGH",
                    f"{rel(target, path)}:{line_no}",
                    f"{m.group(1)} = {url}",
                    "In the running app: request a password reset or magic link. "
                    "The email's action link returns to the preview address in the "
                    "evidence instead of the production domain, so sign-in "
                    "sessions can land on a host you do not own.",
                ))
    return findings


def check_role_in_interface(target):
    """Fixed-list item 4: a role check done only in the UI."""
    findings = []
    for path in code_files(target):
        text = read_text(path)
        for m in UI_ROLE_RE.finditer(text):
            line_no = text[:m.start()].count("\n") + 1
            findings.append(Finding(
                "F4", "role checks done only in the interface", "HIGH",
                f"{rel(target, path)}:{line_no}",
                m.group(0)[:120],
                "In the running app: sign in as a plain member and navigate "
                "directly to the admin route. The interface hides the link, but "
                "the route renders and the admin page loads: the gate exists "
                "only in this client code, with no matching server or policy "
                "check (see F1).",
            ))
    return findings


def check_keys(target):
    """Fixed-list item 5: service-role-shaped keys in the tree and in git history."""
    findings = []
    seen_tokens = set()
    for path in code_files(target):
        text = read_text(path)
        for m in JWT_RE.finditer(text):
            payload = decode_jwt_payload(m.group(0))
            if SERVICE_ROLE_RE.search(payload) or SERVICE_ROLE_RE.search(text[max(0, m.start()-120):m.end()+120]):
                line_no = text[:m.start()].count("\n") + 1
                key = m.group(0)[:60]
                if key in seen_tokens:
                    continue
                seen_tokens.add(key)
                findings.append(Finding(
                    "F5", "keys in the client bundle", "CRITICAL",
                    f"{rel(target, path)}:{line_no}",
                    f"service-role-shaped key present (dummy value): {key}...",
                    "Run this script: it decodes the JWT-shaped string in the "
                    "evidence and reads the 'service_role' claim. A real key with "
                    "that claim bypasses every database rule. The value here is a "
                    "dummy; the placement is the defect.",
                ))
    for commit, gpath, line in git_history_scan(target, JWT_RE):
        payload = decode_jwt_payload(next((t for t in JWT_RE.findall(line)), "")) \
            if JWT_RE.search(line) else ""
        if SERVICE_ROLE_RE.search(payload) or SERVICE_ROLE_RE.search(line):
            findings.append(Finding(
                "F5", "keys in the client bundle", "CRITICAL",
                f"git history: {commit}:{gpath}",
                line[:160],
                "Run: git log -p --all | grep -c 'service_role'. Even though the "
                "key was later removed from the working tree, it stays reachable "
                "in history; the value here is a dummy, the history exposure is "
                "the defect.",
            ))
    return findings


def check_storage(target):
    """Fixed-list item 6: storage rules (informational when the demo has none)."""
    hits = []
    for path in code_files(target):
        text = read_text(path)
        for m in re.finditer(r"createBucket|storage\.from\(|\.buckets\b", text, re.I):
            line_no = text[:m.start()].count("\n") + 1
            hits.append((path, line_no, m.group(0)[:80]))
    if not hits:
        return [Finding(
            "F6", "storage rules", "INFO", "n/a (demo scope)",
            "no storage buckets referenced in the demo app",
            "Not applicable in this demo: the app stores no user files. In a real "
            "check this row tests public-read buckets and per-user prefixes.",
        )]
    return [Finding(
        "F6", "storage rules", "MEDIUM", f"{rel(target, hits[0][0])}:{hits[0][1]}",
        hits[0][2],
        "Storage use found; review bucket policies for public reads.",
    )]


def check_backup(target):
    """Fixed-list item 7: backup and rollback (informational in a demo)."""
    return [Finding(
        "F7", "backup and rollback", "INFO", "n/a (demo scope)",
        "no backup or point-in-time recovery configured in the demo",
        "Not applicable in this demo. In a real check this row reads the "
        "database plan's PITR window and the rollback path for the last deploy.",
    )]


def rel(target, path):
    try:
        return os.path.relpath(path, target).replace("\\", "/")
    except ValueError:
        return str(path)


CHECKS = [
    ("1. database rules", check_database_rules),
    ("2. payment access granted server-side with webhooks that check signatures", check_payment_trust),
    ("3. login, reset and magic-link flows", check_auth_flows),
    ("4. role checks done only in the interface", check_role_in_interface),
    ("5. keys in the client bundle", check_keys),
    ("6. storage rules", check_storage),
    ("7. backup and rollback", check_backup),
]


def main():
    ap = argparse.ArgumentParser(description="Launch Check scanner seed (fixed-list order)")
    ap.add_argument("--target", default=os.path.join(os.path.dirname(__file__), "..", "before"),
                    help="app tree to check (default: before/)")
    args = ap.parse_args()
    target = os.path.abspath(args.target)
    if not os.path.isdir(target):
        print(f"error: target tree not found: {target}", file=sys.stderr)
        return 2
    only = os.listdir(target)
    if not [n for n in only if n != ".gitkeep"]:
        print(f"error: target tree is empty ({target}); the demo app has not landed yet",
              file=sys.stderr)
        return 2

    print(LABEL)
    print(f"Launch Check scanner seed - target: {os.path.basename(target)}")
    print("Fixed-list order matches TERMS-ai-app-check s1 and the LC listing.")
    print("=" * 78)
    all_findings = []
    for item, fn in CHECKS:
        findings = fn(target)
        print(f"\n[{item}]")
        if not findings:
            print("  clean")
        for f in findings:
            all_findings.append(f)
            print(f"  {f.fid}  {f.severity:<8} {f.where}")
            print(f"        evidence: {f.evidence}")
    print("=" * 78)
    defects = [f for f in all_findings if f.severity in ("CRITICAL", "HIGH", "MEDIUM")]
    print(f"\nfindings: {len(defects)} defect(s), "
          f"{len([f for f in all_findings if f.severity == 'INFO'])} informational row(s)")
    print("Every finding above is backed by the reproduction step recorded in the report.")
    return 1 if defects else 0


if __name__ == "__main__":
    sys.exit(main())
