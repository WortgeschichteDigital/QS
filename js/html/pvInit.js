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

  // WEBVIEW EVENTS
  const wv = document.querySelector("webview");
  wv.addEventListener("did-finish-load", () => pv.updateIcons());
  wv.addEventListener("did-fail-load", function () {
    if (/www\.zdl\.org\/wb\/wortgeschichten\/pv/.test(this.getURL())) {
      pv.xml();
    } else {
      pv.updateIcons();
    }
  });

  // CLICK EVENTS: HEADER
  document.querySelectorAll("header a").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      pv.nav(this.id);
    });
  });

  // LISTEN TO IPC MESSAGES
  shared.ipc.on("menu-nav-back", () => pv.nav("back"));
  shared.ipc.on("menu-nav-forward", () => pv.nav("forward"));
  shared.ipc.on("menu-nav-xml", () => pv.nav("xml"));
  shared.ipc.on("menu-new", () => pv.nav("new"));
  shared.ipc.on("menu-update", () => pv.nav("update"));
  shared.ipc.on("update", (evt, args) => {
    pv.data = args;
    document.title = `QS / ${pv.data.file}`;
    pv.xml();
  });

  // GET APP INFO
  shared.info = await shared.ipc.invoke("app-info");

  // INITIALIZE WINDOW
  shared.keyboardMacOS();
  tooltip.init();
  await shared.wait(250);
  overlay.hide("loading");
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
