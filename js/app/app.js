"use strict";

let app = {
	// app info
	//   documents = string (path to user documents dir)
	//   temp = string (path to temp dir)
	//   userData = string (path to config dir)
	//   winId = integer (window ID)
	info: {},
	// app is ready for interaction
	ready: false,
	// active view
	// (value is the same as the ID of the corresponding <section>)
	view: "xml",
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
			case "clusters":
				document.querySelector("#view-clusters").click();
				break;
			case "filters":
				document.querySelector("#fun-filters").click();
				break;
			case "hints":
				document.querySelector("#view-hints").click();
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
			case "xml":
				document.querySelector("#view-xml").click();
				break;
		}
	},
	// print placeholder message in case there's nothing to show
	// (which usually happens when the filters are to tight)
	nothingToShow () {
		let div = document.createElement("div");
		div.id = "nothing";
		let warn = document.createElement("p");
		div.appendChild(warn);
		warn.textContent = "Nichts gefunden!";
		let hint = document.createElement("p");
		div.appendChild(hint);
		hint.textContent = "Verwenden Sie weniger oder weniger strikte Filter.";
		return div;
	},
	// toggle sorting icons
	//  a = element (icon link)
	toggleSortingIcons (a) {
		if (a.id === "sorting-dir") {
			const img = a.querySelector("img");
			if (/ascending/.test( img.getAttribute("src") ) ) {
				img.src = "img/app/sort-descending.svg";
				a.dataset.tooltip = "<i>Sortierung:</i> absteigend";
			} else {
				img.src = "img/app/sort-ascending.svg";
				a.dataset.tooltip = "<i>Sortierung:</i> aufsteigend";
			}
			tooltip.noTimeout = true;
			a.dispatchEvent(new Event("mouseover"));
		} else if (/sorting-(alpha|time)/.test(a.id)) {
			if (!a.classList.contains("active")) {
				for (const i of ["alpha", "time"]) {
					document.querySelector(`#sorting-${i}`).classList.toggle("active");
				}
			} else {
				return;
			}
		} else {
			a.classList.toggle("active");
		}
		app.populateView();
	},
	// get current sorting data
	getSortingData () {
		return {
			ascending: /ascending/.test(document.querySelector("#sorting-dir img").getAttribute("src")) ? true : false,
			filter: document.querySelector("#sorting-filter").value.trim(),
			ignore: document.querySelector("#sorting-ignore.active") ? true : false,
			type: document.querySelector("#sorting-alpha.active") ? "alpha" : "time",
		};
	},
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
		const sorting = document.querySelector("#sorting");
		if (/xml|hints/.test(activeView)) {
			sorting.classList.remove("off");
		} else {
			sorting.classList.add("off");
		}
		filters.toggleCategories();
		app.populateView();
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
};
