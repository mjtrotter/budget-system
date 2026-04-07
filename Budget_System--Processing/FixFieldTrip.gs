function fixFieldTripUploads() {
  const formId = CONFIG.FORMS.FIELD_TRIP;
  const form = FormApp.openById(formId);
  const items = form.getItems();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.getType() === FormApp.ItemType.FILE_UPLOAD) {
      console.log('Found File Upload Item: ' + item.getTitle());
      item.asFileUploadItem().setRequired(false);
      console.log('Set to NOT required.');
    } else if (item.getTitle().indexOf('Supporting Documentation') !== -1) {
      console.log('Found documentation item: ' + item.getTitle());
      item.setRequired(false);
      console.log('Set to NOT required.');
    }
  }
}
