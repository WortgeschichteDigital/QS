"use strict";

window.addEventListener("load", async () => {
	// KEYBOARD EVENTS
	document.addEventListener("keydown", keyboard.shortcuts);
	let sortingFilterTimeout = null;
	document.querySelector("#sorting-filter").addEventListener("input", evt => {
		clearTimeout(sortingFilterTimeout);
		sortingFilterTimeout = setTimeout(() => app.populateView(), 250);
	});

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

	// CLICK EVENTS
	document.querySelectorAll("#sorting a").forEach(i => {
		i.addEventListener("click", function(evt) {
			evt.preventDefault();
			app.toggleSortingIcons(this);
		});
	});
	document.querySelectorAll(".select-filter").forEach(i => {
		i.addEventListener("click", function(evt) {
			evt.preventDefault();
			if (this.parentNode.querySelector(".select-popup")) {
				filters.closeselectPopup(this, false);
			} else {
				filters.selectPopup(this);
			}
		});
		i.addEventListener("blur", function() {
			const activeSelect = this.closest(".select-cont:focus-within");
			if (!activeSelect) {
				filters.closeselectPopup(this, true);
			}
		});
	});
	document.querySelector("#filters-reset").addEventListener("click", evt => {
		evt.preventDefault();
		filters.reset();
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
		filters.toggleBar();
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
	document.querySelectorAll(".overlay").forEach(i => {
		i.addEventListener("click", function() {
			this.querySelector(".overlay-close")?.click();
		});
	});
	document.querySelectorAll(".overlay > div").forEach(i => {
		i.addEventListener("click", evt => evt.stopPropagation());
	});
	document.querySelectorAll(".overlay-close").forEach(i => {
		i.addEventListener("click", function(evt) {
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
			prefs.changeSection(this);
		});
	});
	document.querySelector("#prefs-cache-leeren").addEventListener("click", () => xml.resetCache(true));
	document.querySelector("#prefs-zeitstrahl-open").addEventListener("click", evt => {
		evt.preventDefault();
		prefs.zeitstrahlOpen();
	});
	document.querySelector("#prefs-zeitstrahl-remove").addEventListener("click", evt => {
		evt.preventDefault();
		prefs.zeitstrahlRemove();
	});
	document.querySelector("#prefs-git-config").addEventListener("click", () => prefs.gitConfig());
	document.querySelectorAll("#dialog input").forEach(i => {
		i.addEventListener("click", function() {
			dialog.response = this.dataset.response === "true" ? true : false;
		});
	});

	// LISTEN TO IPC MESSAGES
	app.ir.on("menu-clusters", () => app.menuCommand("clusters"));
	app.ir.on("menu-filters", () => app.menuCommand("filters"));
	app.ir.on("menu-hints", () => app.menuCommand("hints"));
	app.ir.on("menu-preferences", () => app.menuCommand("preferences"));
	app.ir.on("menu-search", () => app.menuCommand("search"));
	app.ir.on("menu-update", () => app.menuCommand("update"));
	app.ir.on("menu-xml", () => app.menuCommand("xml"));
	app.ir.on("save-prefs", () => prefs.save());

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
	shared.keyboardMacOS();
	tooltip.init();
	await prefs.init();
	await git.configCheck();
	await xml.update();
	document.querySelectorAll(".select-filter").forEach(i => filters.fillSelect(i));
	filters.active();
	document.body.classList.add("scrollable");
	overlay.hide("loading");
	app.ready = true;
});
