function dumpHeaders() {
  const hub = SpreadsheetApp.openById("1GpCs2p3dra7xf68Ezz-FSsIScqtc7A62h95FIDc-mKY");
  const sheet = hub.getSheetByName("UserDirectory");
  const data = sheet.getDataRange().getValues();
  console.log(data[0]);
  console.log(data[1]);
}
