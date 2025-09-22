
import about from "./about.mjs";
import keyboard from "./keyboard.mjs";

import overlay from "../overlay.mjs";
import popup from "../popup.mjs";
import shared from "../shared.mjs";

window.addEventListener("load", async () => {
  // RIGHT CLICK
  window.addEventListener("contextmenu", evt => popup.open(evt));

  // KEYBOARD EVENTS
  document.addEventListener("keydown", keyboard.shortcuts);

  // LISTEN TO IPC MESSAGES
  bridge.ipc.listen("close", () => bridge.ipc.invoke("close"));
  bridge.ipc.listen("copy-link", () => popup.copyLink());

  // GET APP INFO
  shared.info = await bridge.ipc.invoke("app-info");

  // PRINT MAIL ADDRESS
  const decoded = about.decodeMail("wvjkiovxidgbwvefekxfzutfpogspjep0eqspAceyhqf0eg");
  const mail = document.getElementById("mail");
  mail.href = "mailto:" + decoded;
  mail.textContent = decoded;

  // FILL IN APP INFOS
  document.getElementById("version").textContent = shared.info.version;
  for (const [ k, v ] of Object.entries(shared.info.process.versions)) {
    document.getElementById(`version-${k}`).textContent = v;
  }

  // INITIALIZE WINDOW
  shared.externalLinks();
  await shared.wait(250);
  document.body.classList.add("scrollable");
  overlay.hide("loading");
});

window.addEventListener("error", evt => shared.errorLog(evt));
window.addEventListener("unhandledrejection", evt => shared.errorLog(evt));
