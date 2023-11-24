"use strict";

const modules = {
  clipboard: require("electron").clipboard,
  ipc: require("electron").ipcRenderer,
  shell: require("electron").shell,
};

window.addEventListener("load", async () => {
  // RIGHT CLICK
  window.addEventListener("contextmenu", evt => popup.open(evt));

  // KEYBOARD EVENTS
  document.addEventListener("keydown", keyboard.shortcuts);

  // CLICK EVENTS
  document.querySelectorAll("nav a").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      help.switchSection(this.getAttribute("href").substring(1));
    });
  });
  help.initInternalLinks();

  // SEARCH BAR
  document.querySelector("#search-bar").addEventListener("keydown", evt => {
    const m = shared.detectKeyboardModifiers(evt);
    if (!m && evt.key === "Enter" && /search-field|search-global/.test(document.activeElement.id)) {
      help.search(true);
    } else if (!m && evt.key === "Escape") {
      help.searchToggle(false);
    }
  });
  document.querySelectorAll("#search-up, #search-down").forEach(i => {
    i.addEventListener("click", function (evt) {
      evt.preventDefault();
      help.search(this.id === "search-down");
    });
  });
  document.querySelector("#search-close").addEventListener("click", evt => {
    evt.preventDefault();
    help.searchToggle(false);
  });

  // LISTEN TO IPC MESSAGES
  modules.ipc.on("menu-search", () => help.searchToggle(true));
  modules.ipc.on("show", (evt, data) => help.show(data));

  // GET APP INFO
  shared.info = await modules.ipc.invoke("app-info");

  // INITIALIZE WINDOW
  shared.externalLinks();
  help.init();
  tooltip.init();
  await shared.wait(250);
  document.body.classList.add("scrollable");
  overlay.hide("loading");
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
