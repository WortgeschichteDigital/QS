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

  // GET APP INFO
  shared.info = await modules.ipc.invoke("app-info");

  // PRINT MAIL ADDRESS
  const decoded = about.decodeMail("wvjkiovxidgbwvefekxfzutfpogspjep0eqspAceyhqf0eg");
  const mail = document.querySelector("#mail");
  mail.href = "mailto:" + decoded;
  mail.textContent = decoded;

  // FILL IN APP INFOS
  document.querySelector("#version").textContent = shared.info.version;
  [ "electron", "node", "chrome", "v8" ].forEach(i => {
    document.querySelector(`#version-${i}`).textContent = process.versions[i];
  });

  // INITIALIZE WINDOW
  shared.externalLinks();
  await shared.wait(250);
  document.body.classList.add("scrollable");
  overlay.hide("loading");
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
