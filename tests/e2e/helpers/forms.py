"""Google Forms filling helpers."""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import BrowserContext, Page


def open_form(context: BrowserContext, form_url: str) -> Page:
    """Open a Google Form in a new tab.

    Args:
        context: Persistent browser context.
        form_url: URL of the Google Form.

    Returns:
        Page with the form loaded.
    """
    page = context.new_page()
    page.goto(form_url, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    return page


def fill_text_fields(page: Page, values: list[str]) -> None:
    """Fill all visible text input fields in order.

    Google Forms renders text inputs as <input> or <textarea> inside
    question containers. This fills them sequentially.

    Args:
        page: Page with a Google Form loaded.
        values: List of values to fill, in order of appearance.
    """
    inputs = page.locator(
        "input[type='text'], input[type='number'], textarea, "
        "input:not([type='hidden']):not([type='submit'])"
    ).all()

    # Filter to only visible, editable inputs within the form
    editable = [inp for inp in inputs if inp.is_visible() and inp.is_editable()]

    for i, value in enumerate(values):
        if i < len(editable):
            editable[i].click()
            editable[i].fill(str(value))
            page.wait_for_timeout(200)


def fill_amazon_form(
    page: Page,
    *,
    description: str,
    url: str,
    qty: int,
    price: str,
) -> None:
    """Fill the Amazon purchase request form.

    Args:
        page: Page with the Amazon form loaded.
        description: Item description.
        url: Amazon product URL.
        qty: Quantity.
        price: Unit price as string (e.g. '45.00').
    """
    fill_text_fields(page, [description, url, str(qty), price])
    
    # "Add another item?" is required. Select "No".
    no_radio = page.locator("div[role='radio'][aria-label='No'], div[role='radio'][data-value='No']").first
    if no_radio.is_visible():
        no_radio.click()
        page.wait_for_timeout(200)


def fill_warehouse_form(
    page: Page,
    *,
    catalog_id: str,
    qty: int,
) -> None:
    """Fill the Warehouse supply request form.

    Args:
        page: Page with the Warehouse form loaded.
        catalog_id: Warehouse item ID.
        qty: Quantity.
    """
    fill_text_fields(page, [catalog_id, str(qty)])
    
    # Select "No" for "Add another item?"
    no_radio = page.locator("div[role='radio'][aria-label='No'], div[role='radio'][data-value='No']").first
    if no_radio.is_visible():
        no_radio.click()
        page.wait_for_timeout(200)


def fill_curriculum_form(
    page: Page,
    *,
    resource_name: str,
    grade_levels: str,
    quantity: int,
    unit_price: str,
    entry_method: str = "Manual",
) -> None:
    """Fill the Curriculum purchase request form.

    Args:
        page: Page with the Curriculum form loaded.
        resource_name: Name of the curriculum resource.
        grade_levels: Grade level range (e.g. '6-8').
        quantity: Number of units.
        unit_price: Price per unit as string.
        entry_method: 'Manual' or 'Automated'.
    """
    fill_text_fields(page, [resource_name, grade_levels, str(quantity), unit_price])

    # Select entry method radio button if present
    if entry_method:
        radio = page.locator(f"div[role='radio'][aria-label='{entry_method}'], div[role='radio'][data-value='{entry_method}']").first
        if radio.is_visible():
            radio.click()
            page.wait_for_timeout(300)


def fill_field_trip_form(
    page: Page,
    *,
    destination: str,
    trip_date: str,
    students: int,
    transportation: str,
    total_cost: str,
) -> None:
    """Fill the Field Trip request form.

    Args:
        page: Page with the Field Trip form loaded.
        destination: Trip destination name.
        trip_date: Date string (e.g. '2026-05-15').
        students: Number of students.
        transportation: Transportation type (e.g. 'Bus', 'Charter').
        total_cost: Total cost as string.
    """
    fill_text_fields(page, [destination, trip_date, str(students), transportation, total_cost])


def fill_admin_form(
    page: Page,
    *,
    description: str,
    amount: str,
    category: str = "Office Supplies",
    notes: str = "E2E Test Submission",
) -> None:
    """Fill the Admin purchase request form.

    Args:
        page: Page with the Admin form loaded.
        description: Purchase description.
        amount: Total amount as string.
        category: Radio button value.
        notes: Additional notes for the textarea.
    """
    fill_text_fields(page, [description, amount])
    
    # Select category radio
    if category:
        radio = page.locator(f"div[role='radio'][aria-label='{category}'], div[role='radio'][data-value='{category}']").first
        if radio.is_visible():
            radio.click()
            page.wait_for_timeout(300)
            
    # Notes is the textarea (last field)
    fill_text_fields(page, ["", "", notes]) # Skip first two if already filled, or just target the textarea


def submit_form(page: Page) -> None:
    """Click the Submit button on a Google Form.

    Args:
        page: Page with a filled Google Form.
    """
    submit = page.locator(
        "[role='button']:has-text('Submit'), "
        "div:has-text('Submit'):not(:has(div:has-text('Submit'))), "
        "span:has-text('Submit')"
    ).first
    submit.click()
    page.wait_for_timeout(2000)
