"use strict";

let app = {
	// app info
	//   documents = path to user documents dir
	//   temp = path to temp dir
	//   userData = path to config dir
	info: {},
	// app is ready for interaction
	ready: false,
	// Electron modules
	ir: require("electron").ipcRenderer,
	shell: require("electron").shell,
	// Node.js modules
	exec: require("child_process").exec,
	fsp: require("fs").promises,
	path: require("path"),
	// execute a menu command
	menuCommand (command) {
		if (overlay.top() === "git") {
			dialog.open({
				type: "alert",
				text: "Sie müssen erst die Git-Konfiguration abschließen.",
			});
			return;
		}
		if (!app.ready) {
			dialog.open({
				type: "alert",
				text: "Die App ist noch nicht bereit.",
			});
			return;
		}
		switch (command) {
			case "filters":
				document.querySelector("#fun-filters").click();
				break;
			case "preferences":
				overlay.show("prefs");
				break;
			case "search":
				document.querySelector("#view-search").click();
				break;
			case "update":
				xml.update();
				break;
		}
	},
	// active view
	// (value is the same as the ID of the corresponding <section>)
	view: "xml",
	// toggle view
	//   button = element
	toggleView (button) {
		if (button.classList.contains("active")) {
			return;
		}
		let activeView = "";
		for (const b of document.querySelectorAll("#view a")) {
			if (b === button) {
				b.classList.add("active");
				activeView = b.id.replace("view-", "");
			} else {
				b.classList.remove("active");
			}
		}
		for (const v of document.querySelectorAll("section")) {
			if (v.id === activeView) {
				v.style.left = window.innerWidth + "px";
				v.classList.remove("off");
				void v.offsetWidth;
				v.style.left = "0px";
			} else {
				v.classList.add("off");
			}
		}
		app.view = activeView;
		app.prepareFilters();
	},
	// popuplate the current view
	populateView () {
		switch (app.view) {
			case "xml":
				viewXml.populate();
				break;
			case "hints":
				viewHints.populate();
				break;
			case "clusters":
				viewClusters.populate();
				break;
			case "search":
				viewSearch.populate();
				break;
		}
	},
	// toggle filter bar
	toggleFilters () {
		document.querySelector("#fun-filters").classList.toggle("active");
		document.querySelector("#filters").classList.toggle("visible");
	},
	// show or hide filters appropriate to the current view
	prepareFilters () {
		const status = document.querySelector("#filters-status"),
			hints = document.querySelector("#filters-hints");
		if (app.view === "xml") {
			status.classList.remove("off");
			hints.classList.add("off");
		} else if (app.view === "hints") {
			status.classList.remove("off");
			hints.classList.remove("off");
		} else if (app.view === "search") {
			status.classList.remove("off");
			hints.classList.add("off");
		} else {
			status.classList.add("off");
			hints.classList.add("off");
		}
	},
	// change section in preferences overlay
	//   a = element (toc item)
	changePrefsSection (a) {
		if (a.classList.contains("active")) {
			return;
		}
		const toc = document.querySelectorAll("li a");
		for (const i of toc) {
			if (i === a) {
				i.classList.add("active");
			} else {
				i.classList.remove("active");
			}
		}
		const sections = document.querySelectorAll(".prefs-section"),
			show = "prefs-" + a.getAttribute("href").substring(1);
		for (const i of sections) {
			if (i.id === show) {
				i.classList.remove("off");
			} else {
				i.classList.add("off");
			}
		}
	},
};
