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
  wv.addEventListener("did-finish-load", () => {
    pv.wvInit = true;
    pv.updateIcons();
  });
  wv.addEventListener("did-fail-load", function () {
    const url = new URL(this.getURL());
    if (url.host === "www.zdl.org" && url.pathname === "/wb/wortgeschichten/pv") {
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
  modules.ipc.on("menu-nav-back", () => pv.nav("back"));
  modules.ipc.on("menu-nav-forward", () => pv.nav("forward"));
  modules.ipc.on("menu-nav-xml", () => pv.nav("xml"));
  modules.ipc.on("menu-new", () => pv.nav("new"));
  modules.ipc.on("menu-update", () => pv.nav("update"));
  modules.ipc.on("update", async (evt, args) => {
    pv.data = args;
    document.title = `QS / ${pv.data.file}`;
    if (!pv.wvInit) {
      await new Promise(resolve => {
        const interval = setInterval(() => {
          if (pv.wvInit) {
            clearInterval(interval);
            resolve(true);
          }
        }, 50);
      });
    }
    pv.xml();
  });

  // GET APP INFO
  shared.info = await modules.ipc.invoke("app-info");

  // GET PROCESS DATA
  window.process = await modules.process();

  // INITIALIZE WINDOW
  shared.keyboardMacOS();
  tooltip.init();
  await shared.wait(250);
  overlay.hide("loading");
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
