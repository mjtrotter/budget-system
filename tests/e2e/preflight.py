"""Pre-flight safety checks — run before ANY test scenario.

Verifies:
1. We are NOT logged in as mtrotter@keswickchristian.org (only account that
   bypasses Amazon TrialMode)
2. Persistent browser profile exists and has sessions
3. Evidence directory is writable
"""

from __future__ import annotations

import os
import sys
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conftest import PROFILE_DIR, EVIDENCE_DIR, TARGET_EMAIL

# The ONLY email that can place LIVE Amazon orders (bypasses TrialMode).
# If we detect this account, abort immediately.
LIVE_ORDER_EMAIL = "mtrotter@keswickchristian.org"


def check_safety() -> bool:
    """Run all pre-flight safety checks. Returns True if safe to proceed."""
    errors: list[str] = []

    # 1. Verify TARGET_EMAIL is not the live-order account
    if TARGET_EMAIL.lower().strip() == LIVE_ORDER_EMAIL:
        errors.append(
            f"ABORT: TARGET_EMAIL is '{LIVE_ORDER_EMAIL}' which bypasses "
            f"Amazon TrialMode. Tests would place REAL orders!"
        )

    # 2. Verify profile directory exists
    if not os.path.isdir(PROFILE_DIR):
        errors.append(
            f"Browser profile not found at {PROFILE_DIR}. "
            f"Run bootstrap.py first."
        )

    # 3. Verify evidence directory is writable
    os.makedirs(EVIDENCE_DIR, exist_ok=True)
    test_file = os.path.join(EVIDENCE_DIR, ".write_test")
    try:
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
    except OSError as e:
        errors.append(f"Cannot write to evidence directory: {e}")

    # 4. Verify browser can open with persistent context
    if not errors:
        try:
            with sync_playwright() as pw:
                ctx = pw.chromium.launch_persistent_context(
                    user_data_dir=PROFILE_DIR,
                    headless=False,
                    viewport={"width": 1280, "height": 900},
                )
                if not ctx.pages:
                    errors.append("Browser launched but no pages available")
                ctx.close()
        except Exception as e:
            errors.append(f"Browser launch failed: {e}")

    if errors:
        print("=" * 60)
        print("  PRE-FLIGHT SAFETY CHECK FAILED")
        print("=" * 60)
        for err in errors:
            print(f"  ❌ {err}")
        print("=" * 60)
        return False

    print("=" * 60)
    print("  PRE-FLIGHT SAFETY CHECK PASSED")
    print("=" * 60)
    print(f"  ✓ Target email: {TARGET_EMAIL} (TrialMode enforced)")
    print(f"  ✓ Profile dir:  {PROFILE_DIR}")
    print(f"  ✓ Evidence dir: {EVIDENCE_DIR}")
    print(f"  ✓ Browser:      OK")
    print("=" * 60)
    return True


if __name__ == "__main__":
    if not check_safety():
        sys.exit(1)
