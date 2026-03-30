function inspectOrganizationsTab() {
  const hub = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('BUDGET_HUB_ID') || '1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY');
  const orgSheet = hub.getSheetByName('Organizations');
  if (!orgSheet) return 'No Organizations tab found';
  
  const data = orgSheet.getDataRange().getValues();
  return JSON.stringify(data.slice(0, 5), null, 2);
}
console.log(inspectOrganizationsTab());
