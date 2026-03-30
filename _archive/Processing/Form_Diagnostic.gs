/**
 * ============================================================================
 * FORM DIAGNOSTIC UTILITY
 * ============================================================================
 * Run dumpAllFormStructures() in the Apps Script Editor to get the current
 * column layout for all 5 forms. Use the output to update COLUMN_MAP in
 * Forms_Engine.gs after any manual form edits.
 *
 * Usage: Run > dumpAllFormStructures()
 * Output: Check Execution Log for full column mapping
 */

function dumpAllFormStructures() {
  const forms = [
    { name: 'Amazon', id: CONFIG.FORMS.AMAZON },
    { name: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE },
    { name: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP },
    { name: 'Curriculum', id: CONFIG.FORMS.CURRICULUM },
    { name: 'Admin', id: CONFIG.FORMS.ADMIN }
  ];

  const allResults = {};

  forms.forEach(f => {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`  ${f.name.toUpperCase()} FORM`);
    console.log(`${'='.repeat(70)}`);

    try {
      const form = FormApp.openById(f.id);
      const items = form.getItems();

      console.log(`Form Title: "${form.getTitle()}"`);
      console.log(`Total Items: ${items.length}`);
      console.log(`Collects Email: ${form.collectsEmail()}`);
      console.log('');

      // Track which column index each question maps to in the response sheet
      // Col 0 = Timestamp, Col 1 = Email (if collectsEmail), then questions follow
      let sheetCol = form.collectsEmail() ? 2 : 1; // Start after timestamp + optional email

      const formItems = [];

      console.log('--- FORM ITEMS (in order) ---');
      items.forEach((item, idx) => {
        const type = item.getType().toString();
        const title = item.getTitle();

        const itemInfo = {
          formIndex: idx,
          type: type,
          title: title
        };

        // PAGE_BREAK and SECTION_HEADER don't create columns in the response sheet
        const nonColumnTypes = ['PAGE_BREAK', 'SECTION_HEADER', 'IMAGE', 'VIDEO'];
        if (nonColumnTypes.includes(type)) {
          itemInfo.sheetCol = null;
          console.log(`  [${idx}] ${type}: "${title}" (no sheet column)`);

          // For PAGE_BREAK, log navigation info
          if (type === 'PAGE_BREAK') {
            try {
              const pageBreak = item.asPageBreakItem();
              const goTo = pageBreak.getGoToPage();
              const navType = pageBreak.getPageNavigationType();
              console.log(`        Navigation: ${navType}${goTo ? ' -> "' + goTo.getTitle() + '"' : ''}`);
            } catch (e) {
              // First page can't be cast to PageBreakItem
            }
          }
        } else {
          itemInfo.sheetCol = sheetCol;
          console.log(`  [${idx}] ${type}: "${title}" -> Sheet Column ${sheetCol} (index ${sheetCol})`);

          // For MULTIPLE_CHOICE and LIST, log choices and navigation
          if (type === 'MULTIPLE_CHOICE') {
            try {
              const mc = item.asMultipleChoiceItem();
              const choices = mc.getChoices();
              choices.forEach(choice => {
                const nav = choice.getPageNavigationType();
                const goTo = choice.getGotoPage();
                console.log(`        Choice: "${choice.getValue()}" -> ${nav}${goTo ? ' ("' + goTo.getTitle() + '")' : ''}`);
              });
            } catch (e) {
              console.log(`        (could not read choices: ${e.message})`);
            }
          }

          // For GRID, note it creates one column per row
          if (type === 'GRID') {
            try {
              const grid = item.asGridItem();
              const rows = grid.getRows();
              console.log(`        Grid rows (${rows.length}): ${JSON.stringify(rows)}`);
              // Grid creates one column per row, but we already counted 1
              sheetCol += rows.length - 1;
              itemInfo.sheetColEnd = sheetCol;
            } catch (e) {
              console.log(`        (could not read grid: ${e.message})`);
            }
          }

          // For CHECKBOX_GRID, same as grid
          if (type === 'CHECKBOX_GRID') {
            try {
              const grid = item.asCheckboxGridItem();
              const rows = grid.getRows();
              console.log(`        Grid rows (${rows.length}): ${JSON.stringify(rows)}`);
              sheetCol += rows.length - 1;
              itemInfo.sheetColEnd = sheetCol;
            } catch (e) {
              console.log(`        (could not read grid: ${e.message})`);
            }
          }

          sheetCol++;
        }

        formItems.push(itemInfo);
      });

      // Now read the actual response sheet headers for comparison
      console.log('');
      console.log('--- RESPONSE SHEET HEADERS ---');
      try {
        const destId = form.getDestinationId();
        if (destId) {
          const ss = SpreadsheetApp.openById(destId);
          const sheet = ss.getSheets()[0];
          const lastCol = sheet.getLastColumn();
          if (lastCol > 0) {
            const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
            headers.forEach((header, col) => {
              console.log(`  Col[${col}]: "${header}"`);
            });

            // Also show last row count for context
            console.log(`  Total responses: ${Math.max(0, sheet.getLastRow() - 1)}`);
          } else {
            console.log('  (no columns in response sheet)');
          }
        } else {
          console.log('  (no destination spreadsheet linked)');
        }
      } catch (e) {
        console.log(`  (could not read response sheet: ${e.message})`);
      }

      // Generate COLUMN_MAP suggestion
      console.log('');
      console.log('--- SUGGESTED COLUMN_MAP ---');
      const mapEntries = formItems
        .filter(item => item.sheetCol !== null)
        .map(item => {
          const key = item.title
            .toUpperCase()
            .replace(/[^A-Z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);
          return `    ${key}: ${item.sheetCol}`;
        });
      console.log(`  ${f.name.toUpperCase()}: {`);
      console.log(`    EMAIL: ${form.collectsEmail() ? 1 : 'N/A'},`);
      mapEntries.forEach(entry => console.log(`  ${entry},`));
      console.log(`  }`);

      allResults[f.name] = { items: formItems };

    } catch (e) {
      console.error(`  ERROR reading ${f.name} form: ${e.message}`);
      allResults[f.name] = { error: e.message };
    }
  });

  console.log(`\n${'='.repeat(70)}`);
  console.log('  DIAGNOSTIC COMPLETE');
  console.log(`${'='.repeat(70)}`);
  console.log('Copy the output above and use it to update COLUMN_MAP in Forms_Engine.gs');

  return allResults;
}

/**
 * Quick check: dumps just the response sheet headers for all forms.
 * Faster than the full diagnostic if you just need column positions.
 */
function dumpResponseSheetHeaders() {
  const forms = [
    { name: 'Amazon', id: CONFIG.FORMS.AMAZON },
    { name: 'Warehouse', id: CONFIG.FORMS.WAREHOUSE },
    { name: 'Field Trip', id: CONFIG.FORMS.FIELD_TRIP },
    { name: 'Curriculum', id: CONFIG.FORMS.CURRICULUM },
    { name: 'Admin', id: CONFIG.FORMS.ADMIN }
  ];

  forms.forEach(f => {
    console.log(`\n=== ${f.name.toUpperCase()} ===`);
    try {
      const form = FormApp.openById(f.id);
      const destId = form.getDestinationId();
      if (!destId) {
        console.log('  No destination linked');
        return;
      }
      const ss = SpreadsheetApp.openById(destId);
      const sheet = ss.getSheets()[0];
      const lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        headers.forEach((header, col) => {
          console.log(`  [${col}] "${header}"`);
        });
      }
    } catch (e) {
      console.log(`  ERROR: ${e.message}`);
    }
  });
}
