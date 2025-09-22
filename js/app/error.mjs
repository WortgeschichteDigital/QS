
import dialog from "../dialog.mjs";
import overlay from "../overlay.mjs";
import shared from "../shared.mjs";

export { error as default };

const error = {
  // log file location
  log: "",

  // show error log
  async showLog () {
    if (!error.log) {
      error.log = await bridge.ipc.invoke("path-join", shared.info.userData, "error.log");
    }
    const pre = document.querySelector("#error pre");
    pre.replaceChildren();
    const exists = await bridge.ipc.invoke("exists", error.log);
    if (!exists) {
      pre.textContent = "Das Fehlerlog ist leer.";
    } else {
      let log = "";
      const result = await bridge.ipc.invoke("file-read", error.log);
      if (typeof result === "string") {
        log = result;
      }
      pre.textContent = log;
    }
    overlay.show("error");
    pre.scrollTop = pre.scrollHeight;
  },

  // open log file in external program
  async openLog () {
    const exists = await bridge.ipc.invoke("exists", error.log);
    if (!exists) {
      error.noLog();
      return;
    }
    const result = await bridge.ipc.invoke("open-path", error.log);
    if (result) {
      shared.error(result);
    }
  },

  // delete log file
  async deleteLog () {
    let exists = await bridge.ipc.invoke("exists", error.log);
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
    exists = await bridge.ipc.invoke("exists", error.log);
    if (!exists) {
      error.noLog();
      return;
    }
    result = await bridge.ipc.invoke("file-unlink", error.log);
    if (result !== true) {
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
