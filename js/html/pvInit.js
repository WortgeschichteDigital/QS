"use strict";

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
  modules.ipc.on("update-icons", (evt, histData) => pv.updateIcons(histData));
  modules.ipc.on("init-done", () => overlay.hide("loading"));

  // GET APP INFO
  shared.info = await modules.ipc.invoke("app-info");

  // GET PROCESS DATA
  window.process = await modules.ipc.invoke("process-info");

  // INITIALIZE WINDOW
  shared.keyboardMacOS();
  tooltip.init();
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
