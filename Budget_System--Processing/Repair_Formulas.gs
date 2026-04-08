function rebuildUserDirectoryFormulas() {
  const hub = SpreadsheetApp.openById(CONFIG.BUDGET_HUB_ID);
  const sheet = hub.getSheetByName("UserDirectory");
  
  if (!sheet) {
    console.error("UserDirectory not found");
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  // Re-verify BudgetAvailable ($K) and Utilization Rate ($L) mapping:
  // H = BudgetAllocated, I = Spent, J = Encumbered, K = Available, L = UtilizationRate
  
  // Construct arrays of exact formulas for column I, J, K, L
  const spentFormulas = [];
  const encumberedFormulas = [];
  const availableFormulas = [];
  const utilFormulas = [];
  
  for (let i = 2; i <= lastRow; i++) {
    // Spent = Sum of ORDERED in Automated and Manual
    spentFormulas.push([`=SUMIFS(Sync_Automated!F:F, Sync_Automated!I:I, A${i}, Sync_Automated!H:H, "ORDERED") + SUMIFS(Sync_Manual!F:F, Sync_Manual!B:B, A${i}, Sync_Manual!H:H, "ORDERED")`]);
    
    // Encumbered = Sum of PENDING and APPROVED
    encumberedFormulas.push([`=SUMIFS(Sync_Automated!F:F, Sync_Automated!I:I, A${i}, Sync_Automated!H:H, "PENDING") + SUMIFS(Sync_Automated!F:F, Sync_Automated!I:I, A${i}, Sync_Automated!H:H, "APPROVED") + SUMIFS(Sync_Manual!F:F, Sync_Manual!B:B, A${i}, Sync_Manual!H:H, "PENDING") + SUMIFS(Sync_Manual!F:F, Sync_Manual!B:B, A${i}, Sync_Manual!H:H, "APPROVED")`]);
    
    // Available = Allocated - Spent - Encumbered
    availableFormulas.push([`=H${i} - I${i} - J${i}`]);
    
    // Utilization Rate
    utilFormulas.push([`=IF(H${i}>0, (I${i}+J${i})/H${i}, 0)`]);
  }
  
  // Actually apply them
  sheet.getRange(2, 9, lastRow - 1, 1).setFormulas(spentFormulas); // Column I
  sheet.getRange(2, 10, lastRow - 1, 1).setFormulas(encumberedFormulas); // Column J
  sheet.getRange(2, 11, lastRow - 1, 1).setFormulas(availableFormulas); // Column K
  sheet.getRange(2, 12, lastRow - 1, 1).setFormulas(utilFormulas); // Column L
  
  // Wait, let's also repair OrganizationBudgets in case that got mangled!
  const orgSheet = hub.getSheetByName("OrganizationBudgets");
  if (orgSheet) {
    const orgLast = orgSheet.getLastRow();
    if (orgLast >= 2) {
      // OrganizationBudgets format:
      // A=Organization, B=Type, C=Division, D=Allocated, E=Spent, F=Encumbered, G=Available, H=Utilization
      // For organizations, the target field in the Queues is the Department/Division column (Col D or E)
      // Usually Col D is Department, Col E is Division.
      // Wait, we need to respect if it's "Department" or "Division". Our previous Sync columns for Automated and Manual:
      // Queue Headers: "TransactionID", "Email", "Type", "Department", "Division", "Amount", "Description", "Status"
      // Wait! AutomatedQueue columns: A=ID, B=Email, C=Type, D=Department, E=Division, F=Amount, G=Description, H=Status
      // Ah! Status is Col H, Amount is Col F!
      // Sync_Automated uses the identical columns?
      
      const orgSpent = [];
      const orgEncumb = [];
      const orgAvail = [];
      const orgUtil = [];
      
      for (let o = 2; o <= orgLast; o++) {
        // Here we test whether we check Dept (D) or Division (E) based on org type (B)
        // If B="Division", sum by E:E. If B="Department", sum by D:D.
        let typeRef = `B${o}="Division"`;
        
        orgSpent.push([`=IF(B${o}="Division", SUMIFS(Sync_Automated!F:F, Sync_Automated!E:E, A${o}, Sync_Automated!H:H, "ORDERED") + SUMIFS(Sync_Manual!F:F, Sync_Manual!E:E, A${o}, Sync_Manual!H:H, "ORDERED"), SUMIFS(Sync_Automated!F:F, Sync_Automated!D:D, A${o}, Sync_Automated!H:H, "ORDERED") + SUMIFS(Sync_Manual!F:F, Sync_Manual!D:D, A${o}, Sync_Manual!H:H, "ORDERED"))`]);
        
        orgEncumb.push([`=IF(B${o}="Division", SUMIFS(Sync_Automated!F:F, Sync_Automated!E:E, A${o}, Sync_Automated!H:H, "PENDING") + SUMIFS(Sync_Automated!F:F, Sync_Automated!E:E, A${o}, Sync_Automated!H:H, "APPROVED") + SUMIFS(Sync_Manual!F:F, Sync_Manual!E:E, A${o}, Sync_Manual!H:H, "PENDING") + SUMIFS(Sync_Manual!F:F, Sync_Manual!E:E, A${o}, Sync_Manual!H:H, "APPROVED"), SUMIFS(Sync_Automated!F:F, Sync_Automated!D:D, A${o}, Sync_Automated!H:H, "PENDING") + SUMIFS(Sync_Automated!F:F, Sync_Automated!D:D, A${o}, Sync_Automated!H:H, "APPROVED") + SUMIFS(Sync_Manual!F:F, Sync_Manual!D:D, A${o}, Sync_Manual!H:H, "PENDING") + SUMIFS(Sync_Manual!F:F, Sync_Manual!D:D, A${o}, Sync_Manual!H:H, "APPROVED"))`]);
        
        orgAvail.push([`=D${o} - E${o} - F${o}`]);
        orgUtil.push([`=IF(D${o}>0, (E${o}+F${o})/D${o}, 0)`]);
      }
      
      orgSheet.getRange(2, 5, orgLast - 1, 1).setFormulas(orgSpent);
      orgSheet.getRange(2, 6, orgLast - 1, 1).setFormulas(orgEncumb);
      orgSheet.getRange(2, 7, orgLast - 1, 1).setFormulas(orgAvail);
      orgSheet.getRange(2, 8, orgLast - 1, 1).setFormulas(orgUtil);
    }
  }
}
