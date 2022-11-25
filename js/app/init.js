"use strict";

window.addEventListener("load", async () => {
	// KEYBOARD EVENTS
	document.addEventListener("keydown", keyboard.shortcuts);

	// CLICK EVENTS: HEADER
	for (const a of document.querySelectorAll("#view a")) {
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			app.toggleView(this);
		});
	}
	document.querySelector("#fun-filters").addEventListener("click", evt => {
		evt.preventDefault();
		app.toggleFilters();
	});
	for (const a of document.querySelectorAll("#fun-git a")) {
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			git.command(this);
		});
	}

	// CLICK EVENTS: OVERLAYS
	for (const a of document.querySelectorAll(".overlay-close")) {
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			overlay.close(this);
		});
	}
	document.querySelector("#git-dir-open").addEventListener("click", (evt) => {
		evt.preventDefault();
		git.dirSelect();
	});
	document.querySelector("#git-okay").addEventListener("click", () => git.configFormCheck());
	document.querySelectorAll("#dialog input").forEach(i => {
		i.addEventListener("click", function() {
			dialog.button(this);
		});
	});

	// LISTEN TO IPC MESSAGES
	app.ir.on("menu-preferences", () => shared.menuCommand("preferences"));

	// GET APP INFO
	app.info = await app.ir.invoke("app-info");

	// INITIALIZE APP
	await shared.wait(500);
	await git.configCheck();
	await git.branchCurrentPrint();
	overlay.hide("loading");
	app.ready = true;
});
