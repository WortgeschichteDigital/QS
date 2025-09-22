
import xml from "./workerXml.mjs";

import shared from "../shared.mjs";

window.addEventListener("load", async () => {
  // LISTEN TO IPC MESSAGES
  bridge.ipc.listen("work", data => xml.update(data));

  // GET APP INFO
  shared.info = await bridge.ipc.invoke("app-info");
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
