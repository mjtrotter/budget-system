"""Outlook Web App (OWA) email helpers."""

from __future__ import annotations

import re
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.sync_api import BrowserContext, Page

from conftest import OWA_URL


def open_owa(context: BrowserContext) -> Page:
    """Open a new tab to OWA inbox.

    Args:
        context: Persistent browser context.

    Returns:
        Page positioned on the OWA inbox.
    """
    page = context.new_page()
    page.goto(OWA_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(5000)
    return page


def search_emails(page: Page, query: str) -> None:
    """Use OWA search bar to find emails.

    Args:
        page: OWA inbox page.
        query: Search query (e.g. 'subject:Approval').
    """
    search_box = page.locator("#topSearchInput, [aria-label='Search'], input[type='search']").first
    search_box.click()
    page.wait_for_timeout(500)
    search_box.fill(query)
    page.keyboard.press("Enter")
    page.wait_for_timeout(4000)


def open_latest_email(page: Page) -> None:
    """Click the first/latest email in the current view.

    Args:
        page: OWA page with search results or inbox visible.
    """
    # Use the verified role="option" for the message list
    first_message = page.locator("div[role='option']").first
    if first_message.is_visible():
        first_message.click()
        page.wait_for_timeout(3000)
    else:
        # Fallback to general message locator
        alt_message = page.locator("[data-convid]").first
        if alt_message.is_visible():
            alt_message.click()
            page.wait_for_timeout(2000)


def get_email_body_text(page: Page) -> str:
    """Extract the text content of the currently open email.

    Args:
        page: OWA page with an email open in the reading pane.

    Returns:
        Plain text content of the email body.
    """
    body = page.locator(
        "[role='document'], .ReadMsgBody, [aria-label*='Message body']"
    ).first
    return body.inner_text() if body.is_visible() else ""


def extract_approval_link(page: Page) -> str | None:
    """Extract the Apps Script approval URL from the open email.

    Looks for an <a> tag whose href contains 'script.google.com'.

    Args:
        page: OWA page with an approval email open.

    Returns:
        The approval URL string, or None if not found.
    """
    links = page.locator("a[href*='script.google.com']").all()
    if links:
        for link in links:
            href = link.get_attribute("href")
            # Prefer 'approve' link over 'reject' if both present
            if href and "decision=approve" in href:
                return href
        # Fallback to first script link
        return links[0].get_attribute("href")

    # Fallback: search body text for URL pattern
    body_text = get_email_body_text(page)
    match = re.search(r"https://script\.google\.com\S+", body_text)
    return match.group(0) if match else None


def click_approval_link(page: Page) -> bool:
    """Extract and click the approval link in the current email.

    Args:
        page: OWA page with an email open.

    Returns:
        True if link was found and clicked, False otherwise.
    """
    url = extract_approval_link(page)
    if url:
        # Navigate to the approval URL in the same page or new tab?
        # Usually easier to navigate the current page.
        page.goto(url, wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        return True
    return False


def delete_current_email(page: Page) -> None:
    """Delete the currently open/selected email in OWA.

    Args:
        page: OWA page with an email selected.
    """
    delete_btn = page.locator(
        "button[aria-label='Delete'], button:has-text('Delete')"
    ).first
    if delete_btn.is_visible():
        delete_btn.click()
        page.wait_for_timeout(1500)
    else:
        # Keyboard shortcut fallback
        page.keyboard.press("Delete")
        page.wait_for_timeout(1000)


def search_and_delete_emails(page: Page, query: str) -> int:
    """Search for emails and delete all results.

    Args:
        page: OWA inbox page.
        query: Search query to find test emails.

    Returns:
        Number of emails deleted.
    """
    search_emails(page, query)
    page.wait_for_timeout(2000)

    deleted = 0
    # Use verified role="option"
    messages = page.locator("div[role='option']").all()

    for msg in messages:
        if msg.is_visible():
            msg.click()
            page.wait_for_timeout(1000)
            delete_current_email(page)
            deleted += 1
            page.wait_for_timeout(1000)

    return deleted
