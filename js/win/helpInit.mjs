
import help from "./help.mjs";
import keyboard from "./keyboard.mjs";

import overlay from "../overlay.mjs";
import popup from "../popup.mjs";
import shared from "../shared.mjs";
import tooltip from "../tooltip.mjs";

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
  document.getElementById("search-bar").addEventListener("keydown", evt => {
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
  document.getElementById("search-close").addEventListener("click", evt => {
    evt.preventDefault();
    help.searchToggle(false);
  });

  // LISTEN TO IPC MESSAGES
  bridge.ipc.listen("close", () => bridge.ipc.invoke("close"));
  bridge.ipc.listen("copy-link", () => popup.copyLink());
  bridge.ipc.listen("menu-search", () => help.searchToggle(true));
  bridge.ipc.listen("show", data => help.show(data));

  // GET APP INFO
  shared.info = await bridge.ipc.invoke("app-info");

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
