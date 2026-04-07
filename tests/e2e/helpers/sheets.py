"""Google Sheets navigation and editing helpers.

CRITICAL: All cell navigation uses the Name Box (the cell reference input
at top-left of Google Sheets, e.g. showing "A1"). This is the ONLY reliable
way to navigate to a specific cell. Never use Home+ArrowRight — it drifts.

Usage:
    page = open_sheet(context, BUDGET_HUB, "UserDirectory")
    goto_cell(page, "H2")         # Navigate to cell H2
    type_into_cell(page, "500")   # Type value and confirm
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import BrowserContext, Page


# ---------------------------------------------------------------------------
# Navigation
# ---------------------------------------------------------------------------

def open_sheet(context: BrowserContext, url: str, sheet_name: str) -> Page:
    """Open a spreadsheet URL and switch to the named tab.

    Returns the Page positioned on the requested sheet.
    """
    page = context.new_page()
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    # Dismiss any modal dialogs (e.g. "Some features have changed")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    page.evaluate("document.querySelectorAll('.modal-dialog-bg').forEach(el => el.remove());")
    page.evaluate("document.querySelectorAll('.modal-dialog').forEach(el => el.remove());")
    page.evaluate("document.querySelectorAll('.picker.modal-dialog-bg').forEach(el => el.remove());")

    tab = page.locator(f"text={sheet_name}").first
    tab.click()
    page.wait_for_timeout(3000)
    return page


def goto_cell(page: Page, cell_ref: str) -> None:
    """Navigate to a cell using the Name Box and strictly verify success.

    This clicks the Name Box, types the reference, presses Enter, and
    verifies the Name Box actually updated to the target cell.
    """
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelectorAll('.picker.modal-dialog-bg, .modal-dialog-bg, .modal-dialog').forEach(el => el.remove());")

    name_box = page.locator("#t-name-box").first
    if not name_box.is_visible():
        name_box = page.locator(".waffle-name-box").first

    target = cell_ref.upper()
    
    for attempt in range(3):
        # We must explicitly set the value to an empty string because
        # sometimes fill() appends if the input has weird internal state.
        name_box.evaluate("el => el.value = ''")
        page.wait_for_timeout(100)
        
        name_box.click()
        page.wait_for_timeout(100)
        name_box.fill(target)
        page.wait_for_timeout(100)
        
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)
        
        # Verify the Name Box now reflects the new active cell
        current_val = name_box.input_value().upper()
        if current_val == target:
            return  # Successfully navigated
            
        page.wait_for_timeout(500)

    # If it fails 3 times, crash explicitly so we NEVER type into the wrong cell
    raise Exception(f"CRITICAL SAFETY ABORT: Failed to navigate to {target}. Cursor is stuck at {current_val}.")


def type_into_cell(page: Page, value: str) -> None:
    """Type a value into the currently selected cell and confirm with Enter.

    Clears the cell first with Delete, then types the new value.
    """
    page.keyboard.press("Delete")
    page.wait_for_timeout(200)
    page.keyboard.type(str(value), delay=20)
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)


def set_cell(page: Page, cell_ref: str, value: str) -> None:
    """Navigate to a cell by reference and set its value.

    Example: set_cell(page, "H2", "500")
    """
    goto_cell(page, cell_ref)
    type_into_cell(page, value)


def read_cell(page: Page, cell_ref: str) -> str:
    """Navigate to a cell and read its value from the formula bar.

    Returns the text shown in the formula bar for that cell.
    """
    goto_cell(page, cell_ref)
    page.wait_for_timeout(500)
    # The formula bar input in Google Sheets
    formula_bar = page.locator("#t-formula-bar-input, .cell-input").first
    if formula_bar.is_visible():
        return formula_bar.inner_text()
    return ""


# ---------------------------------------------------------------------------
# Search (for queue sheets where row number is unknown)
# ---------------------------------------------------------------------------

def find_row_by_value(page: Page, search_text: str) -> None:
    """Use Ctrl+F to find and select a cell containing search_text.

    After calling this, the active cell is on the matched cell.
    Use this ONLY when you don't know the row number (e.g. queue sheets).
    For UserDirectory where the row is known, use goto_cell() directly.
    """
    page.keyboard.press("Control+f")
    page.wait_for_timeout(500)
    # The search input in Google Sheets
    search_input = page.locator(
        "input[aria-label='Find in spreadsheet'], "
        "#t-find-input, "
        ".docs-findinput-input"
    ).first
    if search_input.is_visible():
        search_input.fill(search_text)
    else:
        page.keyboard.type(search_text, delay=30)
    page.wait_for_timeout(300)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
