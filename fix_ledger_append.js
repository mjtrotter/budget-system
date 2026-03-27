// A helper to find true last row
function getTrueLastRow(sheet) {
  const data = sheet.getRange("A:A").getValues();
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][0] && data[i][0].toString().trim() !== "") {
      return i + 1;
    }
  }
  return 1;
}
