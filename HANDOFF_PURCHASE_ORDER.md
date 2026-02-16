# Purchase Order Design - Session Handoff

## Current Status
Working on purchase order header design for Keswick Christian School budget system. File located at: `_scratch/batch_invoice_preview.html`

## Completed
✅ Changed from "INVOICE" to "PURCHASE ORDER"
✅ Multi-line descriptions working properly
✅ Multi-page layout with proper page breaks
✅ Signature section with green lines matching brand
✅ Font changed to Palatino serif to match logo
✅ Items count moved to totals section
✅ Removed redundant gray metadata box
✅ 4 pages total with distributed content

## Outstanding Issues

### 1. **CRITICAL: Margins Not Equal**
- Left/right margins visually unequal despite @page margin: 0.75in
- Content appears shifted left
- Logo/table left edge closer to paper edge than right margin
- **Root cause**: Need to investigate table width, container constraints

### 2. **Green Color Mismatch**
- Current: #1B5E20
- Logo green appears different (needs color picker)
- Use [ImageColorPicker.com](https://imagecolorpicker.com/) to extract exact hex from logo
- Apply consistent green to:
  - PURCHASE ORDER text
  - Order details (Order No, Date, Division values)
  - Table header borders
  - Signature lines
  - Totals

### 3. **Logo Redesign Needed**
**Proposed approach:**
- Split logo into 2 components:
  - Shield/crest graphic (centered in header)
  - "Keswick Christian School" as TEXT (left-aligned)
- **Critical**: School name and PURCHASE ORDER must match:
  - Same font: Palatino
  - Same weight: 600
  - Same color: (extracted logo green)
  - Same letter-spacing

**Layout:**
```
[Keswick Christian School]     [SHIELD]     [PURCHASE ORDER]
        (left)                 (center)           (right)
```

### 4. **Page 4 Orphaned Signatures**
- Currently 4 pages with only signatures on page 4
- Need slight row padding compression to fit on page 3
- Adjust: `tbody td { padding: 10px 8px; }` (reduce from 12px)
- Or reduce `txn-group-first/last` padding

## File Locations
- HTML: `_scratch/batch_invoice_preview.html`
- PDF output: `_scratch/purchase_order_preview.pdf`
- Logo: `/Users/mjtrotter/Downloads/text logo kcs.png`
- Test images: `/tmp/po_*.png`

## Key Design Principles Established
1. **Serif typography** - Palatino matches logo's classical aesthetic
2. **Visual hierarchy** - Logo/title on same level, details below
3. **Generous whitespace** - 25-30px between sections
4. **Green accent color** - Keswick brand (needs exact match)
5. **Professional balance** - Equal visual weight left/right

## Next Steps (Priority Order)

1. **Fix margins** - Ensure true 0.75in all sides
   - Check table width constraints
   - Remove any hidden padding/margins
   - Test with ruler measurement

2. **Extract exact logo green**
   - Use color picker on logo file
   - Replace all #1B5E20 with exact color
   - Test visual consistency

3. **Implement logo split design**
   - Create text element: "Keswick Christian School"
   - Position shield/crest centered
   - Match school name to PURCHASE ORDER styling exactly

4. **Compress pagination**
   - Reduce row padding to fit signatures on page 3
   - Test with full 32-item invoice

5. **Final polish**
   - Verify all fonts use Palatino
   - Check color consistency throughout
   - Test multi-line description wrapping
   - Verify signature alignment

## Technical Notes

### CSS Structure
```css
@page { margin: 0.75in; }
body { font-family: 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif; }
.header-top { /* Logo level */ }
.header-bottom { /* Details level */ }
.invoice-title h1 { font-weight: 600; font-variant: small-caps; }
```

### Color Variables to Update
- All instances of `#1B5E20` → [LOGO GREEN]
- Keep `#555`, `#444`, `#888`, `#333` for text hierarchy

### Testing Checklist
- [ ] Print to PDF, measure margins with ruler
- [ ] Compare green to logo side-by-side
- [ ] Verify font consistency (all Palatino)
- [ ] Check page count (should be 3 pages)
- [ ] Multi-line descriptions wrap properly
- [ ] Signature section on last content page

## Context for Next Session
User wants professional, balanced invoice header that:
- Matches school's classical brand aesthetic
- Has visual harmony between all elements
- Uses consistent typography and color
- Feels "inspired" not generic

Key frustration: Headers have felt "uninspired," "unbalanced," "cramped" in iterations. The logo/text relationship is critical to get right.

## Resources
- Invoice design best practices: [PDForge](https://pdforge.com/blog/invoice-header-essentials-everything-you-need-to-know-for-a-professional-billing-header)
- Color picker tools: [ImageColorPicker](https://imagecolorpicker.com/)
- Reference samples: `~/Downloads/sample1 invoice.jpg`, `sample2 invoice.avif`, `sample3 invoice.png`
