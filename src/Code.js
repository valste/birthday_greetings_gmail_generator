function runDailyBirthdayJob() {
  return BirthdayAgent.runDailyBirthdayJob();
}

function previewDailyBirthdayJob(targetDateIso) {
  return BirthdayAgent.previewDailyBirthdayJob(targetDateIso);
}

function installDailyTrigger() {
  return BirthdayAgent.installDailyTrigger();
}

function syncScriptProperties(values) {
  return BirthdayAgent.syncScriptProperties(values);
}

if (typeof module !== "undefined") {
  module.exports = {
    installDailyTrigger: installDailyTrigger,
    previewDailyBirthdayJob: previewDailyBirthdayJob,
    runDailyBirthdayJob: runDailyBirthdayJob,
    syncScriptProperties: syncScriptProperties
  };
}
