"use strict";

window.addEventListener("load", async () => {
	// KEYBOARD EVENTS
	document.addEventListener("keydown", keyboard.shortcuts);

	// WINDOW EVENTS
	let winEventsTimeout = null;
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
	document.querySelectorAll("#view a").forEach(a => {
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			app.toggleView(this);
		});
	});
	document.querySelector("#fun-filters").addEventListener("click", evt => {
		evt.preventDefault();
		app.toggleFilters();
	});
	document.querySelector("#fun-update").addEventListener("click", evt => {
		evt.preventDefault();
		xml.update();
	});
	document.querySelectorAll("#fun-git a").forEach(a => {
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			git.command(this);
		});
	});

	// CLICK EVENTS: OVERLAYS
	document.querySelectorAll(".overlay-close").forEach(a => {
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			overlay.close(this);
		});
	});
	document.querySelector("#git-dir-open").addEventListener("click", evt => {
		evt.preventDefault();
		git.dirSelect();
	});
	document.querySelector("#git-okay").addEventListener("click", () => git.configFormCheck());
	document.querySelectorAll("#prefs li a").forEach(i => {
		i.addEventListener("click", function(evt) {
			evt.preventDefault();
			app.changePrefsSection(this);
		});
	});
	document.querySelector("#prefs-git-config").addEventListener("click", () => git.configFormShow());
	document.querySelectorAll("#dialog input").forEach(i => {
		i.addEventListener("click", function() {
			dialog.button(this);
		});
	});

	// LISTEN TO IPC MESSAGES
	app.ir.on("menu-filters", () => app.menuCommand("filters"));
	app.ir.on("menu-preferences", () => app.menuCommand("preferences"));
	app.ir.on("menu-search", () => app.menuCommand("search"));
	app.ir.on("menu-update", () => app.menuCommand("update"));

	// GET APP INFO
	app.info = await app.ir.invoke("app-info");

	// PRELOAD IMAGES
	let imagesPreload = [],
		images = await app.ir.invoke("list-of-images");
	for (const i of images) {
		let img = new Image();
		img.src = "img/app/" + i;
		imagesPreload.push(img);
	}

	// INITIALIZE APP
	await shared.wait(500);
	await git.configCheck();
	await git.branchCurrentPrint();
	shared.keyboardMacOS();
	tooltip.init();
	overlay.hide("loading");
	app.ready = true;
});
