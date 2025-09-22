
import pv from "./pv.mjs";

import overlay from "../overlay.mjs";
import popup from "../popup.mjs";
import shared from "../shared.mjs";
import tooltip from "../tooltip.mjs";

window.addEventListener("load", async () => {
  // RIGHT CLICK
  window.addEventListener("contextmenu", evt => popup.open(evt));

  // WINDOW EVENTS
  let winEventsTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(winEventsTimeout);
    winEventsTimeout = setTimeout(() => {
      tooltip.off();
    }, 25);
  });
  window.addEventListener("scroll", () => {
    clearTimeout(winEventsTimeout);
    winEventsTimeout = setTimeout(() => {
      tooltip.off();
    }, 25);
  });

  // CLICK EVENTS: HEADER
  document.querySelectorAll("header a").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      pv.nav(this.id);
    });
  });

  // LISTEN TO IPC MESSAGES
  bridge.ipc.listen("close", () => bridge.ipc.invoke("close"));
  bridge.ipc.listen("copy-link", () => popup.copyLink());
  bridge.ipc.listen("init-done", () => overlay.hide("loading"));
  bridge.ipc.listen("update-icons", histData => pv.updateIcons(histData));

  // GET APP INFO
  shared.info = await bridge.ipc.invoke("app-info");

  // INITIALIZE WINDOW
  shared.keyboardMacOS();
  tooltip.init();
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
