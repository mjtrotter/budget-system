function inspectFormulas() {
  const hub = SpreadsheetApp.openById("1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY");
  const sheet = hub.getSheetByName("UserDirectory");
  const formulas = sheet.getRange("A2:M2").getFormulas();
  const values = sheet.getRange("A2:M2").getValues();
  console.log("Values row 2:", values);
  console.log("Formulas row 2:", formulas);
}
