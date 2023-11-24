"use strict";

const modules = {
  ipc: require("electron").ipcRenderer,
  crypto: require("crypto"),
  fsp: require("fs").promises,
  path: require("path"),
};

window.addEventListener("load", async () => {
  // GET APP INFO
  shared.info = await modules.ipc.invoke("app-info");

  // LISTEN TO IPC MESSAGES
  modules.ipc.on("work", (evt, data) => xml.update(data));
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
