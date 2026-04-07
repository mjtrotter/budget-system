"""Sequential E2E test runner for all Keswick Budget System scenarios.

Execution order:
  0. Pre-flight safety check (abort if unsafe)
  1. Global reset via Apps Script
  2. A1: Amazon Auto-Approval ($45)
  3. Global reset
  4. A2: Velocity Denial ($480 + $30)
  5. Global reset
  6. A3: Over Threshold ($205) + approval flow
  7. Global reset
  8. A4: Over Budget ($150 on $50)
  9. Global reset
  10. B1: Curriculum Manual Route
  11. Global reset
  12. B2: Field Trip Review
  13. Final reset + cleanup
"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from conftest import PROFILE_DIR, WEBAPP_URL, EVIDENCE_DIR, TARGET_EMAIL

# Safety: hard-coded check that we're not using the live-order account
LIVE_ORDER_EMAIL = "mtrotter@keswickchristian.org"
assert TARGET_EMAIL.lower().strip() != LIVE_ORDER_EMAIL, (
    f"SAFETY ABORT: TARGET_EMAIL={TARGET_EMAIL} would bypass Amazon TrialMode!"
)


def global_reset(context) -> bool:
    """Call resetAllTestData via the WebApp endpoint.

    Returns True if reset was successful.
    """
    print("  → Running global reset...")
    page = context.new_page()
    try:
        page.goto(
            f"{WEBAPP_URL}?action=reset",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        # Wait up to 30s for the reset confirmation
        page.wait_for_timeout(10000)
        content = page.content().lower()
        success = "reset successfully" in content or "reset complete" in content
        if success:
            print("  ✓ Reset complete")
        else:
            # Take screenshot for debugging
            page.screenshot(path=os.path.join(EVIDENCE_DIR, "reset_debug.png"))
            print(f"  ⚠ Reset may not have completed — check reset_debug.png")
            print(f"    Page content snippet: {page.inner_text('body')[:200]}")
        return success
    except Exception as e:
        print(f"  ✗ Reset failed: {e}")
        return False
    finally:
        page.close()


def run_scenario(name: str, run_fn) -> str:
    """Execute a single scenario's run() function and return result string."""
    print(f"\n{'='*60}")
    print(f"  SCENARIO {name}")
    print(f"{'='*60}")
    try:
        result = run_fn()
        print(f"  → Result: {result}")
        return result
    except Exception as e:
        result = f"{name}: FAIL — Exception: {e}"
        print(f"  → {result}")
        return result


def main() -> None:
    os.makedirs(EVIDENCE_DIR, exist_ok=True)

    # Pre-flight
    from preflight import check_safety
    if not check_safety():
        print("\nAborting: pre-flight safety check failed.")
        sys.exit(1)

    # Import scenarios (deferred to avoid import errors if preflight fails)
    from scenarios import (
        a1_auto_approval,
        a2_velocity,
        a3_over_threshold,
        a4_over_budget,
        b1_curriculum,
        b2_field_trip,
        c1_warehouse,
        c2_admin,
        d1_amazon_batch,
        d2_warehouse_batch,
    )

    results: list[str] = []
    start_time = datetime.now()

    with sync_playwright() as pw:
        context = pw.chromium.launch_persistent_context(
            user_data_dir=PROFILE_DIR,
            headless=False,
            viewport={"width": 1280, "height": 900},
        )

        try:
            # Phase 1: Initial global reset
            if not global_reset(context):
                print("WARNING: Initial reset may have failed. Proceeding with caution.")

            # A1
            context.close()
            results.append(run_scenario("A1", a1_auto_approval.run))

            # Reset before A2
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("A2", a2_velocity.run))

            # Reset before A3
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("A3", a3_over_threshold.run))

            # Reset before A4
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("A4", a4_over_budget.run))

            # Reset before B1
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("B1", b1_curriculum.run))

            # B2
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("B2", b2_field_trip.run))

            # C1: Warehouse
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("C1", c1_warehouse.run))

            # C2: Admin
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("C2", c2_admin.run))

            # D1: Amazon Batch
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("D1", d1_amazon_batch.run))

            # D2: Warehouse Batch
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)
            context.close()
            results.append(run_scenario("D2", d2_warehouse_batch.run))

            # Final reset
            context = pw.chromium.launch_persistent_context(
                user_data_dir=PROFILE_DIR, headless=False,
                viewport={"width": 1280, "height": 900},
            )
            global_reset(context)

        finally:
            context.close()

    # Summary
    elapsed = datetime.now() - start_time
    print(f"\n{'='*60}")
    print(f"  E2E TEST SUITE RESULTS")
    print(f"  Elapsed: {elapsed}")
    print(f"  Target:  {TARGET_EMAIL} (TrialMode enforced)")
    print(f"{'='*60}")
    for r in results:
        status = "✓" if "PASS" in r else "✗"
        print(f"  {status} {r}")
    print(f"{'='*60}")

    passed = sum(1 for r in results if "PASS" in r)
    total = len(results)
    print(f"\n  {passed}/{total} scenarios passed")

    # Write results to file
    report_path = os.path.join(EVIDENCE_DIR, "results.txt")
    with open(report_path, "w") as f:
        f.write(f"Keswick Budget System E2E Results\n")
        f.write(f"Run: {start_time.isoformat()}\n")
        f.write(f"Duration: {elapsed}\n")
        f.write(f"Target: {TARGET_EMAIL}\n\n")
        for r in results:
            f.write(f"{r}\n")
        f.write(f"\n{passed}/{total} passed\n")
    print(f"  Report saved: {report_path}")


if __name__ == "__main__":
    main()
