"use strict";

window.addEventListener("load", async () => {
  // GET APP INFO
  shared.info = await shared.ipc.invoke("app-info");

  // LISTEN TO IPC MESSAGES
  shared.ipc.on("work", (evt, data) => xml.update(data));
});

window.addEventListener("error", evt => shared.onError(evt));
window.addEventListener("unhandledrejection", evt => shared.onError(evt));
