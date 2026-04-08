function doGetDebugData() {
  const hub = SpreadsheetApp.openById("1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY");
  const data = hub.getSheetByName("UserDirectory").getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(data.slice(0, 3))).setMimeType(ContentService.MimeType.JSON);
}
