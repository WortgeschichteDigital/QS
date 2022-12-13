"use strict";

window.addEventListener("load", async () => {
	// RIGHT CLICK
	window.addEventListener("contextmenu", evt => popup.open(evt));

	// KEYBOARD EVENTS
	document.addEventListener("keydown", keyboard.shortcuts);

	// CLICK EVENTS
	document.querySelectorAll("nav a").forEach(i => {
		i.addEventListener("click", function(evt) {
			evt.preventDefault();
			help.nav(this.getAttribute("href").substring(1));
		});
	});

	// LISTEN TO IPC MESSAGES
	shared.ipc.on("show", (evt, data) => help.show(data));

	// GET APP INFO
	shared.info = await shared.ipc.invoke("app-info");

	// INITIALIZE WINDOW
	shared.externalLinks();
	help.init();
	await shared.wait(250);
	document.body.classList.add("scrollable");
	overlay.hide("loading");
});

window.addEventListener("error", evt => shared.onError(evt));
window.addEventListener("unhandledrejection", evt => shared.onError(evt));
