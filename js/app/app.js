"use strict";

let app = {
	// app is ready for interaction
	ready: false,
	// app is about to switch the view
	switching: false,
	// active view
	// (value is the same as the ID of the corresponding <section>)
	view: "xml",
	// clear a text field
	//   clear = element (the clear icon)
	clearTextField (clear) {
		const input = clear.previousSibling;
		input.value = "";
		input.focus();
		if (input.id === "sorting-filter") {
			input.dispatchEvent(new Event("input"));
		}
	},
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
			case "app-updates":
				updates.check(false);
				break;
			case "clusters":
				document.querySelector("#view-clusters").click();
				break;
			case "error-log":
				error.showLog();
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
				viewSearch.toggleAdvanced("on");
				document.querySelector("#view-search").click();
				break;
			case "teaser-tags":
				tags.show();
				break;
			case "update":
				xml.update();
				break;
			case "xml":
				document.querySelector("#view-xml").click();
				break;
		}
	},
	// load XSL to variable
	//   obj = object
	//   key = string
	//   xsl = string
	async loadXsl ({ obj, key, xsl }) {
		if (obj[key]) {
			return true;
		}
		let resources = process.resourcesPath;
		if (/node_modules/.test(resources)) {
			// app is not packaged => process.resourcesPath is the path to the Electron resources
			resources = resources.replace(/node_modules.+/, "") + "resources";
		}
		try {
			const path = shared.path.join(resources, xsl);
			obj[key] = await shared.fsp.readFile(path, { encoding: "utf8" });
			return true;
		} catch (err) {
			shared.error(`${err.name}: ${err.message} (${shared.reduceErrorStack(err.stack)})`);
			return false;
		}
	},
	// print placeholder message in case there's nothing to show
	// (which usually happens when the filters are to tight)
	nothingToShow (textWarn = "", textTipp = "") {
		let div = document.createElement("div");
		div.classList.add("nothing");
		let warn = document.createElement("p");
		div.appendChild(warn);
		warn.textContent = textWarn || "Nichts gefunden!";
		let hint = document.createElement("p");
		div.appendChild(hint);
		let tipp = textTipp || "";
		if (!tipp && app.view === "search") {
			let dataA = viewSearch.getAdvancedData(),
				tipps = [];
			if (document.querySelector("#fun-filters.active-filters")) {
				tipps.push("verwenden Sie weniger Filter");
			}
			if (dataA["search-scope-0"].checked) {
				tipps.push("erweitern Sie den Suchbereich");
			} else if (Object.values(dataA).filter(i => i).length > 1) {
				tipps.push("schalten Sie erweiterte Suchoptionen aus");
			}
			tipp = "Ändern Sie den Suchausdruck";
			if (tipps.length) {
				tipp = tipps.join(" und ");
				tipp = tipp.substring(0, 1).toUpperCase() + tipp.substring(1);
			}
			if (!Object.keys(xml.files).length) {
				tipp = "Klicken Sie auf <i>Update</i>, um die XML-Dateidaten zu laden";
			}
			tipp = `Tipp: ${tipp}.`;
		} else if (app.view === "xml" && !Object.keys(xml.files).length) {
			tipp = "Tipp: Klicken Sie auf <i>Update</i>, um die XML-Dateidaten zu laden.";
		} else if (!tipp) {
			tipp = "Tipp: Verwenden Sie weniger Filter.";
		}
		hint.innerHTML = tipp;
		return div;
	},
	// open preview
	//   file = string (XML file name)
	openPv (file) {
		const data = xml.data.files[file];
		if (!data) {
			shared.error(`Datei „${file}“ nicht mehr gefunden`);
			return;
		}
		shared.ipc.invoke("pv", {
			dir: data.dir,
			file,
			git: git.config.dir,
		});
	},
	// open file in editor
	//   file = string (XML file name)
	async openEditor (file) {
		const data = xml.data.files[file];
		if (!data) {
			shared.error(`Datei „${file}“ nicht mehr gefunden`);
			return;
		}
		const path = shared.path.join(git.config.dir, data.dir, file),
			result = await shared.shell.openPath(path);
		if (result) {
			shared.error(result);
		}
	},
	// print a rotating icon
	pleaseWait () {
		let div = document.createElement("div");
		div.classList.add("wait");
		let img = document.createElement("img");
		div.appendChild(img);
		img.src = "img/app/loading.svg";
		img.width = "96";
		img.height = "96";
		img.alt = "";
		img.classList.add("rotate");
		return div;
	},
	// scroll pagewise
	//   down = boolean
	scroll (down) {
		const topBars = document.querySelector("#bar").getBoundingClientRect().bottom,
			scroll = Math.round((window.innerHeight - topBars) * 0.85);
		let top = window.scrollY;
		if (down) {
			top += scroll;
		} else {
			top -= scroll;
		}
		window.scrollTo({
			top,
			left: 0,
			behavior: "smooth",
		});
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
	// saves scroll position of view
	viewScrollTop: {},
	// reset the scroll position of the current view
	//   type = string (switched | updated)
	resetViewScrollTop (type) {
		if (type && app.viewScrollTop[app.view]) {
			window.scrollTo(0, app.viewScrollTop[app.view]);
		} else {
			window.scrollTo(0, 0);
		}
	},
	// determine the next view after pressing the keyboard shortcut
	//   toRight = boolean
	toggleViewShortcut (toRight) {
		let views = document.querySelectorAll("#view a"),
			idx = -1;
		for (let i = 0, len = views.length; i < len; i++)  {
		 if (views[i].classList.contains("active")) {
			idx = i;
			break;
		 }
		}
		if (toRight) {
			idx++;
		} else {
			idx--;
		}
		if (idx < 0 || idx === views.length) {
			return;
		}
		views[idx].click();
	},
	// toggle view
	//   button = element
	async toggleView (button) {
		// view is already active
		if (button.classList.contains("active")) {
			if (app.view === "search") {
				document.querySelector("#search-text").select();
			}
			return;
		}
		// block switching until the current switch was finished
		if (app.switching) {
			return;
		}
		app.switching = true;
		// save scroll position
		app.viewScrollTop[app.view] = window.scrollY;
		// determine next view
		let nextView = button.id.replace("view-", "");
		// close results bar (if necessary)
		if (!/hints|search/.test(nextView) && document.querySelector("#results.visible")) {
			bars.toggle("results");
		}
		// determine next bar content
		let activeBarContent = "";
		for (const i of document.querySelectorAll("#bar > div")) {
			if (!i.classList.contains("off")) {
				activeBarContent = i.id;
				break;
			}
		}
		let nextBarContent = "";
		switch (nextView) {
			case "xml":
				nextBarContent = "sorting";
				break;
			case "hints":
				nextBarContent = "sorting";
				break;
			case "clusters":
				nextBarContent = "clusters-nav";
				break;
			case "search":
				nextBarContent = "search-form";
				break;
		}
		// left or right
		const views = ["xml", "hints", "clusters", "search"];
		let direction = [1, -1];
		if (views.indexOf(nextView) > views.indexOf(app.view)) {
			direction = [-1, 1];
		}
		// reduce advanced options if necessary
		await viewSearch.toggleAdvanced("off");
		// slide active bar content and <section>
		await new Promise(resolve => {
			const bc = document.getElementById(activeBarContent),
				sect = document.getElementById(app.view);
			sect.addEventListener("transitionend", () => {
				for (const i of [bc, sect]) {
					i.classList.add("off");
					i.classList.remove("trans-linear");
				}
				resolve(true);
			}, { once: true });
			for (const i of [bc, sect]) {
				i.classList.add("trans-linear");
				i.style.left = "0px";
				void i.offsetWidth;
				i.style.left = direction[0] * window.innerWidth + "px";
			}
		});
		await shared.wait(25);
		// switch to next bar content and <section>
		const bc = document.getElementById(nextBarContent),
			sect = document.getElementById(nextView);
		for (const i of [bc, sect]) {
			i.style.left = direction[1] * window.innerWidth + "px";
			i.classList.remove("off");
			void i.offsetWidth;
			i.style.left = "0px";
		}
		// switch buttons
		document.querySelectorAll("#view a").forEach(b => {
			if (b === button) {
				b.classList.add("active");
			} else {
				b.classList.remove("active");
			}
		});
		// finish up
		app.view = nextView;
		bars.toggleFiltersCat();
		bars.filtersActive();
		app.populateView("switched");
		app.switching = false;
	},
	// popuplate the current view
	//   type = string | undefined
	populateView (type = "") {
		switch (app.view) {
			case "xml":
				viewXml.populate(type);
				break;
			case "hints":
				viewHints.populate(type);
				break;
			case "clusters":
				viewClusters.populate();
				break;
			case "search":
				if (type === "switched") {
					app.resetViewScrollTop(type);
				}
				if (type !== "updated") {
					viewSearch.toggleAdvanced("on");
					document.querySelector("#search-text").select();
				}
				break;
		}
	},
};
