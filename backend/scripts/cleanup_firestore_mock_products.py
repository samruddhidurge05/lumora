"""
backend/scripts/cleanup_firestore_mock_products.py
---------------------------------------------------
Standalone cleanup script that identifies and removes seeded/mock products
from the Firestore ``products`` collection using a multi-signal approach.

A product document is flagged as a seed/mock candidate when it satisfies
AT LEAST TWO of the five detection signals:
  1. ``unsplash_thumbnail``  — thumbnail URL contains "unsplash.com"
  2. ``generic_title``       — title/name matches generic seed-script pattern
  3. ``seed_vendor``         — vendor_id is a known seed-script vendor
  4. ``lorem_description``   — description contains filler/placeholder text
  5. ``batch_timestamp``     — doc shares the same UTC minute with 3+ other docs
                               (second-pass cluster detection across all candidates)

Guards (applied AFTER signal detection):
  • Recency protection: docs created within 30 calendar days are never deleted (task 6.2) [done]
  • Referential integrity: docs referenced in orders/reviews/downloads/analytics/
    customer collections are never deleted (task 6.3)
  • Dry-run mode: default True — nothing is deleted unless --no-dry-run passed (task 6.4)

Usage:
    python cleanup_firestore_mock_products.py           # dry-run (safe)
    python cleanup_firestore_mock_products.py --no-dry-run  # live deletion

Requirements: 2.1
"""

import re
import sys
import os
from datetime import date, datetime, timezone

# ---------------------------------------------------------------------------
# Firestore connection — imported from shared module (no SQLite dependency)
# ---------------------------------------------------------------------------
# Add the backend package root to sys.path so ``app`` is importable when this
# script is run directly from the backend/scripts/ directory.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_SCRIPT_DIR)
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.shared.firebase.connection import db, firebase_connected  # noqa: E402

# ---------------------------------------------------------------------------
# Known seed-script vendor IDs
# ---------------------------------------------------------------------------
# These are the vendor_id values that seed/test/demo scripts are known to
# produce.  The set is intentionally broad to catch variants:
#   • Literal strings used in ad-hoc seed scripts ("seed_vendor_1" etc.)
#   • Generic placeholder names that seeding utilities generate
#   • Normalized (lowercase, hyphenated) forms of the products.json vendors
#     used by backend/scripts/seed_products.py
#     (e.g. "DesignHub" → "designhub" and "design-hub")
#
# IMPORTANT: Do NOT add real production vendor IDs here.
# Scanning at runtime (see _load_seed_vendor_ids_from_json) supplements this
# static set with vendor IDs sourced from products.json so the script stays
# up-to-date as the seed data evolves.
# ---------------------------------------------------------------------------

KNOWN_SEED_VENDOR_IDS: set[str] = {
    # ── Explicit test/seed/demo identifiers ───────────────────────────────
    "seed_vendor",
    "seed_vendor_1",
    "seed_vendor_2",
    "seed_vendor_3",
    "test_vendor",
    "test_vendor_1",
    "demo_vendor",
    "demo_vendor_1",
    "mock_vendor",
    "mock_vendor_1",
    "placeholder_vendor",
    "sample_vendor",
    # ── Generic numeric patterns (vendor_1, vendor_2, …) ──────────────────
    "vendor_1",
    "vendor_2",
    "vendor_3",
    "vendor_4",
    "vendor_5",
    # ── Dev / local / CI placeholder values ───────────────────────────────
    "dev_vendor",
    "local_vendor",
    "ci_vendor",
    "generated_vendor",
    "filler_vendor",
    # ── Normalized seed_products.py vendor names (products.json origin) ───
    # seed_products.py normalises: str(seller_name).lower().replace(" ", "-")
    # These are the sellers defined in frontend/src/data/products.json that
    # are used purely as seeding fixtures during development.
    "designhub",
    "design-hub",
    "pixelforge",
    "pixel-forge",
    "creativelab",
    "creative-lab",
    "webstudio",
    "web-studio",
    "codeforge",
    "code-forge",
    "devmarket",
    "dev-market",
    "uxmasters",
    "ux-masters",
    "promptmaster",
    "prompt-master",
    "ailabs",
    "ai-labs",
    "notionflow",
    "notion-flow",
    "studyhub",
    "study-hub",
    "businessstack",
    "business-stack",
    "creatortools",
    "creator-tools",
    "financeflow",
    "finance-flow",
    "careerboost",
    "career-boost",
}


# ---------------------------------------------------------------------------
# Optional runtime enrichment: parse products.json vendor IDs
# ---------------------------------------------------------------------------

def _load_seed_vendor_ids_from_json() -> set[str]:
    """
    Attempt to parse frontend/src/data/products.json at runtime and return
    the set of normalised vendor IDs that seed_products.py would derive.
    Falls back silently to an empty set if the file is not found.
    """
    import json

    candidate_paths = [
        os.path.join(_BACKEND_ROOT, "..", "frontend", "src", "data", "products.json"),
        os.path.join(_BACKEND_ROOT, "frontend", "src", "data", "products.json"),
    ]
    for path in candidate_paths:
        resolved = os.path.normpath(path)
        if os.path.exists(resolved):
            try:
                with open(resolved, "r", encoding="utf-8") as fh:
                    products = json.load(fh)
                ids: set[str] = set()
                for p in products:
                    seller = p.get("seller") or p.get("vendor_id") or ""
                    if seller:
                        normalised = str(seller).lower().replace(" ", "-")
                        ids.add(normalised)
                        # Also add the raw lower-case form (no hyphenation)
                        ids.add(str(seller).lower())
                return ids
            except Exception as exc:
                print(f"[cleanup] Warning: could not parse products.json: {exc}")
    return set()


# Enrich the static set at import time so tests and the runtime script both
# benefit without needing a separate initialisation call.
KNOWN_SEED_VENDOR_IDS.update(_load_seed_vendor_ids_from_json())


# ---------------------------------------------------------------------------
# Signal detection
# ---------------------------------------------------------------------------

# Pre-compiled regular expressions (compiled once at module load for performance)
_RE_GENERIC_TITLE = re.compile(
    r"^(product\s*\d+|test\s+product|sample.*|mock.*|demo.*|seed.*)",
    re.IGNORECASE,
)

_RE_LOREM_DESCRIPTION = re.compile(
    r"(lorem ipsum|this is a sample|generated|placeholder|filler)",
    re.IGNORECASE,
)


def evaluate_signals(doc) -> list[str]:
    """
    Evaluate the four per-document signals for a Firestore product document.

    The fifth signal (``"batch_timestamp"``) requires cross-document context
    and is therefore evaluated separately by
    :func:`evaluate_batch_timestamp_signal` after an initial pass collects all
    candidates.

    Parameters
    ----------
    doc:
        A Firestore ``DocumentSnapshot`` (or any object that exposes
        ``doc.to_dict()``).

    Returns
    -------
    list[str]
        List of signal names that fired for this document.  Possible values:
        ``"unsplash_thumbnail"``, ``"generic_title"``, ``"seed_vendor"``,
        ``"lorem_description"``.
    """
    data: dict = doc.to_dict() or {}
    signals: list[str] = []

    # ── Signal 1: Unsplash thumbnail ──────────────────────────────────────
    thumbnail: str = data.get("thumbnail") or ""
    if "unsplash.com" in thumbnail:
        signals.append("unsplash_thumbnail")

    # ── Signal 2: Generic / seeded title ─────────────────────────────────
    title: str = data.get("title") or data.get("name") or ""
    if _RE_GENERIC_TITLE.match(title):
        signals.append("generic_title")

    # ── Signal 3: Known seed-script vendor ID ────────────────────────────
    if data.get("vendor_id") in KNOWN_SEED_VENDOR_IDS:
        signals.append("seed_vendor")

    # ── Signal 4: Lorem-ipsum / filler description ───────────────────────
    description: str = data.get("description") or ""
    if _RE_LOREM_DESCRIPTION.search(description):
        signals.append("lorem_description")

    return signals


def evaluate_batch_timestamp_signal(
    candidates: list[tuple[str, dict, list[str]]],
) -> set[str]:
    """
    Second-pass batch-timestamp cluster detection.

    Groups the candidate documents by the UTC minute in which their
    ``createdAt`` timestamp falls (floor to ``YYYY-MM-DDTHH:MM``).  Any
    document that belongs to a cluster of 3 or more documents sharing the
    same UTC minute is assigned the ``"batch_timestamp"`` signal.

    Parameters
    ----------
    candidates:
        List of ``(doc_id, data_dict, signals_list)`` tuples collected during
        the first pass (i.e. documents that already triggered at least one
        per-document signal, or ALL documents when a broader scan is desired).

    Returns
    -------
    set[str]
        Set of ``doc_id`` values whose ``createdAt`` falls inside a cluster
        of 3 or more documents sharing the same UTC minute.
    """
    from collections import defaultdict

    # Map from "YYYY-MM-DDTHH:MM" UTC minute string → list of doc_ids
    minute_buckets: dict[str, list[str]] = defaultdict(list)

    for doc_id, data, _signals in candidates:
        created_raw: str | None = data.get("createdAt")
        if not created_raw:
            continue

        # Parse ISO-8601 string (with or without trailing "Z")
        normalised = created_raw.rstrip("Z").replace("+00:00", "")
        try:
            dt = datetime.fromisoformat(normalised).replace(tzinfo=timezone.utc)
        except ValueError:
            # Unparseable timestamp — skip
            continue

        # Floor to UTC minute: "YYYY-MM-DDTHH:MM"
        minute_key = dt.strftime("%Y-%m-%dT%H:%M")
        minute_buckets[minute_key].append(doc_id)

    # Return doc_ids that are in clusters of 3+
    clustered: set[str] = set()
    for doc_ids in minute_buckets.values():
        if len(doc_ids) >= 3:
            clustered.update(doc_ids)

    return clustered


# ---------------------------------------------------------------------------
# Recency helper
# ---------------------------------------------------------------------------

def _parse_created_at(data: dict) -> "date | None":
    """
    Safely parse the ``createdAt`` ISO-8601 string from a Firestore document
    data dict into a :class:`datetime.date` object (UTC calendar date).

    Returns ``None`` when the key is absent, the value is ``None`` / empty,
    or the string cannot be parsed as ISO-8601.

    Parameters
    ----------
    data:
        The ``dict`` returned by ``doc.to_dict()`` for a Firestore document.

    Returns
    -------
    datetime.date | None
        The UTC calendar date of the ``createdAt`` field, or ``None`` on any
        error.
    """
    created_raw: str | None = data.get("createdAt")
    if not created_raw:
        return None

    # Normalise ISO-8601: strip trailing "Z", replace explicit UTC offset
    normalised = str(created_raw).rstrip("Z").replace("+00:00", "")
    try:
        dt = datetime.fromisoformat(normalised).replace(tzinfo=timezone.utc)
        return dt.date()
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Referential integrity check
# ---------------------------------------------------------------------------

def check_references(pid: str) -> list[dict]:
    """
    Check whether the given Firestore product document ID is referenced in any
    of the following collections:

      • ``orders``          — items array contains an element with ``productId == pid``
      • ``reviews``         — documents where ``productId == pid``
      • ``downloads``       — documents where ``productId == pid``
      • ``analytics``       — documents where ``productId == pid``
      • ``wishlist``        — documents where ``productId == pid``
      • ``favorites``       — documents where ``productId == pid``
      • ``bookmarks``       — documents where ``productId == pid``
      • ``recommendations`` — documents where ``productId == pid``

    Parameters
    ----------
    pid:
        The Firestore product document ID (string form of the product's integer
        primary key).

    Returns
    -------
    list[dict]
        List of ``{"collection": <name>, "doc_id": <id>}`` dicts — one entry per
        referencing document found across all queried collections.  An empty list
        means the product is safe to delete.
    """
    references: list[dict] = []

    # ── Orders: items is an array of objects; each element may have productId ──
    for doc in db.collection("orders").stream():
        data: dict = doc.to_dict() or {}
        items = data.get("items") or []
        if any(str(item.get("productId", "")) == pid for item in items):
            references.append({"collection": "orders", "doc_id": doc.id})

    # ── Collections that store productId as a top-level field ────────────────
    _direct_collections = [
        "reviews",
        "downloads",
        "analytics",
        # Customer-facing collections
        "wishlist",
        "favorites",
        "bookmarks",
        "recommendations",
    ]
    for collection_name in _direct_collections:
        for doc in (
            db.collection(collection_name).where("productId", "==", pid).stream()
        ):
            references.append({"collection": collection_name, "doc_id": doc.id})

    return references


# ---------------------------------------------------------------------------
# Entry-point stub (deletion, recency guard, and reporting in tasks 6.2–6.4)
# ---------------------------------------------------------------------------

def run_cleanup(dry_run: bool = True) -> None:
    """
    Orchestrate the Firestore mock-product cleanup.

    Signal detection and recency protection (task 6.2) are implemented.
    Referential integrity checks (task 6.3) and deletion/report generation
    (task 6.4) will be added in subsequent tasks.

    Parameters
    ----------
    dry_run:
        When ``True`` (the default), no Firestore documents are deleted.
        Pass ``False`` (via ``--no-dry-run``) only after reviewing the dry-run
        report.
    """
    if not firebase_connected or db is None:
        print("[cleanup] Firestore is unavailable — aborting.")
        return

    print(f"[cleanup] Starting Firestore mock-product cleanup (dry_run={dry_run}) …")

    # ── Step 1: Fetch all product documents ──────────────────────────────
    all_docs = list(db.collection("products").stream())
    total_before = len(all_docs)
    print(f"[cleanup] Total product documents fetched: {total_before}")

    # ── Step 2: First pass — per-document signal evaluation ──────────────
    initial_candidates: list[tuple[str, dict, list[str]]] = []
    for doc in all_docs:
        signals = evaluate_signals(doc)
        if signals:
            initial_candidates.append((doc.id, doc.to_dict() or {}, signals))

    # ── Step 3: Second pass — batch timestamp cluster detection ──────────
    batch_signal_ids = evaluate_batch_timestamp_signal(initial_candidates)

    # Enrich candidates: append "batch_timestamp" signal where applicable
    enriched_candidates: list[tuple[str, dict, list[str]]] = []
    for doc_id, data, signals in initial_candidates:
        enriched_signals = list(signals)
        if doc_id in batch_signal_ids and "batch_timestamp" not in enriched_signals:
            enriched_signals.append("batch_timestamp")
        enriched_candidates.append((doc_id, data, enriched_signals))

    # ── Step 4: Filter to documents with >= 2 signals ────────────────────
    flagged_candidates: list[tuple[str, dict, list[str]]] = [
        (doc_id, data, signals)
        for doc_id, data, signals in enriched_candidates
        if len(signals) >= 2
    ]

    print(f"[cleanup] Candidates flagged (>= 2 signals): {len(flagged_candidates)}")
    for doc_id, data, signals in flagged_candidates:
        title = data.get("title") or data.get("name") or "<no title>"
        print(f"[cleanup]   · {doc_id!r} — {title!r} — signals: {signals}")

    # ── Step 5: Recency guard (30-day protection) ─────────────────────────
    # Documents created within the last 30 calendar days (UTC) are never
    # eligible for deletion, regardless of how many seed signals they match.
    # Boundary rule: (run_date - created_date).days < 30 → protected.
    #                (run_date - created_date).days >= 30 → eligible.
    run_date: date = datetime.now(timezone.utc).date()

    blocked_recent: list[str] = []
    eligible_candidates: list[tuple[str, dict, list[str]]] = []

    for doc_id, data, signals in flagged_candidates:
        created_date = _parse_created_at(data)

        if created_date is not None and (run_date - created_date).days < 30:
            blocked_recent.append(doc_id)
            print(
                f"[cleanup]   ~ {doc_id!r} -- skipped -- reason: recency_protected "
                f"(createdAt={created_date.isoformat()}, "
                f"age={(run_date - created_date).days}d)"
            )
            continue

        eligible_candidates.append((doc_id, data, signals))

    print(
        f"[cleanup] Recency-protected (skipped): {len(blocked_recent)}, "
        f"eligible after recency guard: {len(eligible_candidates)}"
    )

    # ── Step 6: Referential integrity checks ──────────────────────────────
    # For each candidate that survived the recency guard, query all dependent
    # collections.  A non-empty reference set blocks deletion unconditionally.
    blocked_referenced: list[dict] = []   # {doc_id: refs} for blocked candidates
    deletion_queue: list[tuple] = []       # (doc_id, data, signals) ready to delete

    for doc_id, data, signals in eligible_candidates:
        refs = check_references(doc_id)

        if refs:
            blocked_referenced.append({"doc_id": doc_id, "references": refs})
            title = data.get("title") or data.get("name") or "<no title>"
            print(
                f"[cleanup]   ✗ {doc_id!r} — {title!r} — BLOCKED (referenced): "
                f"{refs}"
            )
        else:
            deletion_queue.append((doc_id, data, signals))

    print(
        f"[cleanup] Referential integrity: "
        f"{len(blocked_referenced)} blocked, "
        f"{len(deletion_queue)} in deletion queue."
    )

    # ── Step 7: Deletion execution and report (task 6.4) ──────────────────
    # For each document in the deletion queue:
    #   • Log the candidate (ID, title, signals) before acting.
    #   • If dry_run=False: call Firestore delete.
    #   • If dry_run=True: log the would-be deletion without touching Firestore.
    deleted: list[str] = []

    for doc_id, data, signals in deletion_queue:
        title = data.get("title") or data.get("name") or "<no title>"
        print(
            f"[cleanup]   {'[DRY-RUN] would delete' if dry_run else 'deleting'} "
            f"{doc_id!r} — {title!r} — signals: {signals}"
        )
        if not dry_run:
            db.collection("products").document(doc_id).delete()
        deleted.append(doc_id)

    # ── Step 8: Build report ──────────────────────────────────────────────
    # (a) Deleted IDs — those actually removed (or would be in dry-run)
    # (b) 50 most recent preserved product IDs by createdAt descending
    # (c) Blocked IDs with reference details
    # (d) Total counts before / after

    total_after = total_before - len(deleted) if not dry_run else total_before

    # Preserved = all docs minus deleted
    deleted_set = set(deleted)

    def _sort_key(doc) -> datetime:
        """Return a UTC datetime for sorting; missing/bad createdAt sorts last."""
        data_dict: dict = doc.to_dict() or {}
        created_raw = data_dict.get("createdAt") or ""
        normalised = str(created_raw).rstrip("Z").replace("+00:00", "")
        try:
            return datetime.fromisoformat(normalised).replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            return datetime.min.replace(tzinfo=timezone.utc)

    preserved_docs_sorted = sorted(
        [doc for doc in all_docs if doc.id not in deleted_set],
        key=_sort_key,
        reverse=True,  # most recent first
    )
    top_50_preserved: list[str] = [doc.id for doc in preserved_docs_sorted[:50]]

    # ── Print structured report ───────────────────────────────────────────
    separator = "=" * 70

    print()
    print(separator)
    print("  FIRESTORE MOCK-PRODUCT CLEANUP REPORT")
    print(f"  Mode       : {'DRY-RUN (no changes made)' if dry_run else 'LIVE'}")
    print(f"  Run date   : {run_date.isoformat()} UTC")
    print(separator)

    # (a) Deleted / would-be-deleted product IDs
    print()
    print(
        f"(a) {'Would-be-deleted' if dry_run else 'Deleted'} product document IDs "
        f"({len(deleted)} total):"
    )
    if deleted:
        for doc_id in deleted:
            print(f"    - {doc_id}")
    else:
        print("    (none)")

    # (b) 50 most recent preserved product IDs
    print()
    print(
        f"(b) 50 most recent preserved product IDs by createdAt desc "
        f"({min(len(top_50_preserved), 50)} shown):"
    )
    if top_50_preserved:
        for doc_id in top_50_preserved:
            print(f"    - {doc_id}")
    else:
        print("    (none)")

    # (c) Blocked product IDs (recency + referential integrity)
    print()
    total_blocked = len(blocked_recent) + len(blocked_referenced)
    print(f"(c) Blocked product IDs ({total_blocked} total):")

    if blocked_recent:
        print(f"    Recency-protected ({len(blocked_recent)}):")
        for doc_id in blocked_recent:
            print(f"      ~ {doc_id}  [reason: created within last 30 days]")

    if blocked_referenced:
        print(f"    Reference-blocked ({len(blocked_referenced)}):")
        for entry in blocked_referenced:
            b_doc_id = entry["doc_id"]
            refs = entry["references"]
            ref_summary = ", ".join(
                f"{r['collection']}:{r['doc_id']}" for r in refs
            )
            print(f"      ✗ {b_doc_id}  [references: {ref_summary}]")

    if not blocked_recent and not blocked_referenced:
        print("    (none)")

    # (d) Document counts
    print()
    print("(d) Document counts:")
    print(f"    Before : {total_before}")
    if dry_run:
        print(
            f"    After  : {total_before} (unchanged — dry-run mode; "
            f"{len(deleted)} would be removed)"
        )
    else:
        print(f"    After  : {total_after} ({len(deleted)} removed)")

    print()
    print(separator)
    print("[cleanup] Done.")
    print(separator)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    _dry_run = "--no-dry-run" not in sys.argv
    run_cleanup(dry_run=_dry_run)
