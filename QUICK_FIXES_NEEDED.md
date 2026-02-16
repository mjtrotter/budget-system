# Immediate Fixes for Next Session

## 1. Margin Centering (HIGHEST PRIORITY)
**Problem**: Content shifted left, margins visually unequal
**Root Cause**: `.page-container` with `max-width: 8.5in` conflicts with `@page margin: 0.75in`
**Fix**:
```css
/* Remove or simplify page-container */
.page-container {
  width: 100%;
  margin: 0;
  padding: 0;
  background: white;
}
```
The @page margins should handle all spacing - no need for container constraints.

## 2. Extract Logo Green Color
**Action**: Upload `/Users/mjtrotter/Downloads/text logo kcs.png` to https://imagecolorpicker.com/
**Then**: Replace ALL instances of `#1B5E20` with the extracted hex color
**Files to update**: Search/replace in `batch_invoice_preview.html`

## 3. Logo Split Implementation
**Current**: Full logo image
**Proposed**:
```html
<div class="header-top">
  <div class="school-name-text">Keswick Christian School</div>
  <div class="shield-crest"><img src="shield-only.png" /></div>
  <div class="invoice-title"><h1>PURCHASE<br>ORDER</h1></div>
</div>
```
**CSS**:
```css
.school-name-text, .invoice-title h1 {
  font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  font-weight: 600;
  font-size: 20pt;
  color: [LOGO-GREEN]; /* Same exact color */
  letter-spacing: 4px;
}
```

## 4. Pagination Compression
**Change**: `tbody td { padding: 10px 8px; }` (reduce from 12px)
**Goal**: Fit signatures on page 3 (not orphaned on page 4)

## Command to Test
```bash
cd /Users/mjtrotter/budget-system/_scratch
python3 -c "from weasyprint import HTML; HTML('batch_invoice_preview.html').write_pdf('purchase_order_preview.pdf')"
open purchase_order_preview.pdf
```

## Success Criteria
✓ Left/right margins equal when measured
✓ Green matches logo exactly
✓ School name and PURCHASE ORDER match font/weight/color
✓ 3 pages total (not 4)
✓ Professional, balanced, inspired design
