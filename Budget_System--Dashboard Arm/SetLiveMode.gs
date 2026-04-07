function setLiveMode() {
  PropertiesService.getScriptProperties().setProperty("DEMO_MODE", "false");
  console.log("DEMO MODE disabled. Dashboard is now live.");
}
