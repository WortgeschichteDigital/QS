"use strict";

window.addEventListener("load", async () => {
  // RIGHT CLICK
  window.addEventListener("contextmenu", evt => popup.open(evt));

  // GET APP INFO
  shared.info = await shared.ipc.invoke("app-info");

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
