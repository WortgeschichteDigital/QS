"use strict";

const error = {
  // log file location
  log: "",

  // show error log
  async showLog () {
    if (!error.log) {
      error.log = modules.path.join(shared.info.userData, "error.log");
    }
    const pre = document.querySelector("#error pre");
    pre.replaceChildren();
    const exists = await modules.ipc.invoke("exists", error.log);
    if (!exists) {
      pre.textContent = "Das Fehlerlog ist leer.";
    } else {
      const log = await modules.fsp.readFile(error.log, { encoding: "utf8" });
      pre.textContent = log;
    }
    overlay.show("error");
    pre.scrollTop = pre.scrollHeight;
  },

  // open log file in external program
  async openLog () {
    const exists = await modules.ipc.invoke("exists", error.log);
    if (!exists) {
      error.noLog();
      return;
    }
    const result = await modules.shell.openPath(error.log);
    if (result) {
      shared.error(result);
    }
  },

  // delete log file
  async deleteLog () {
    let exists = await modules.ipc.invoke("exists", error.log);
    if (!exists) {
      error.noLog();
      return;
    }
    let result = await dialog.open({
      type: "confirm",
      text: "Soll das Fehlerlog wirklich gelöscht werden?",
    });
    if (!result) {
      return;
    }
    exists = await modules.ipc.invoke("exists", error.log);
    if (!exists) {
      error.noLog();
      return;
    }
    result = await modules.fsp.unlink(error.log);
    if (result) {
      shared.error(result);
    } else {
      document.querySelector("#error pre").textContent = "Das Fehlerlog ist leer.";
    }
  },

  // message that no log is present (yet)
  noLog () {
    dialog.open({
      type: "alert",
      text: "Das Fehlerlog existiert (noch) nicht.",
    });
  },
};
