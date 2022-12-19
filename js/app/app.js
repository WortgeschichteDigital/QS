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
	//   clear = node (the clear icon)
	clearTextField (clear) {
		const input = clear.previousSibling;
		input.value = "";
		input.focus();
		if (/sorting-filter|clusters-modulate-search/.test(input.id)) {
			input.dispatchEvent(new Event("input"));
		}
	},
	// execute a menu command
	async menuCommand (command) {
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
				await app.toggleView(document.querySelector("#view-search"));
				viewSearch.toggleAdvanced("on");
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
	//   textWarn = string | undefined
	//   textTip = string | undefined
	nothingToShow (textWarn = "", textTip = "") {
		let div = document.createElement("div");
		div.classList.add("nothing");
		let warn = document.createElement("p");
		div.appendChild(warn);
		warn.textContent = textWarn || "Nichts gefunden!";
		let hint = document.createElement("p");
		div.appendChild(hint);
		let tip = textTip || "";
		if (/hints|xml/.test(app.view) && !Object.keys(xml.files).length) {
			tip = "Tipp: Klicken Sie auf <i>Update</i>, um die XML-Dateidaten zu laden.";
		} else if (!tip && app.view === "search") {
			let dataA = viewSearch.getAdvancedData(),
				tips = [];
			if (document.querySelector("#fun-filters.active-filters")) {
				tips.push("verwenden Sie weniger Filter");
			}
			if (dataA["search-scope-0"].checked) {
				tips.push("erweitern Sie den Suchbereich");
			} else if (Object.values(dataA).filter(i => i).length > 1) {
				tips.push("schalten Sie erweiterte Suchoptionen aus");
			}
			tip = "Ändern Sie den Suchausdruck";
			if (tips.length) {
				tip = tips.join(" und ");
				tip = tip.substring(0, 1).toUpperCase() + tip.substring(1);
			}
			if (!Object.keys(xml.files).length) {
				tip = "Klicken Sie auf <i>Update</i>, um die XML-Dateidaten zu laden";
			}
			tip = `Tipp: ${tip}.`;
		} else if (!tip) {
			tip = "Tipp: Verwenden Sie weniger Filter.";
		}
		hint.innerHTML = tip;
		return div;
	},
	// make a heading for the list in XML and hints view
	//   file = string
	makeListHeading (file) {
		const icons = [
			{
				fun: "openPv",
				icon: "xml.svg",
				title: "Datei in der Vorschau öffnen",
			},
			{
				fun: "openLemmasPopup",
				icon: "lemmas.svg",
				title: "Lemmata des Artikels anzeigen",
			},
			{
				fun: "openEditor",
				icon: "open-file.svg",
				title: "Datei im Editor öffnen",
			},
		];
		let h1 = document.createElement("h1");
		h1.id = file;
		h1.textContent = file;
		// const icons
		for (const icon of icons) {
			let a = document.createElement("a");
			h1.appendChild(a);
			a.classList.add("icon");
			a.dataset.fun = icon.fun;
			a.dataset.file = file;
			a.href = "#";
			a.title = icon.title;
			a.addEventListener("click", function(evt) {
				evt.preventDefault();
				app[this.dataset.fun](this.dataset.file, this);
			});
			let img = document.createElement("img");
			a.appendChild(img);
			img.src = `img/app/${icon.icon}`;
			img.width = "30";
			img.height = "30";
			img.alt = "";
		}
		return h1;
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
	// open a popup that shows all article lemmas
	//   file = string (XML file name)
	//   caller = node
	openLemmasPopup (file, caller) {
		caller.dispatchEvent(new Event("mouseout"));
		let content = document.createElement("div"),
			h2 = document.createElement("h2");
		content.appendChild(h2);
		h2.textContent = file;
		const data = xml.data.files[file];
		if (data.fa) {
			let h3 = document.createElement("h3");
			content.appendChild(h3);
			h3.textContent = "Wortfeld";
			printLemmas(content, data.faLemmas);
		} else {
			for (const type of ["hl", "nl"]) {
				const lemmas = data[type + "Joined"];
				if (!lemmas.length) {
					continue;
				}
				let h3 = document.createElement("h3");
				content.appendChild(h3);
				if (lemmas.length === 1) {
					h3.textContent = type === "hl" ? "Hauptlemma" : "Nebenlemma";
				} else {
					h3.textContent = type === "hl" ? "Hauptlemmata" : "Nebenlemmata";
				}
				printLemmas(content, lemmas);
			}
		}
		viewHints.popupShow(caller, content, "lemmas");
		// print lemma list
		function printLemmas (content, lemmas) {
			let p = document.createElement("p");
			content.appendChild(p);
			for (const l of lemmas) {
				if (p.hasChildNodes()) {
					p.appendChild(document.createElement("br"));
				}
				p.appendChild(document.createTextNode(l));
			}
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
	// returns a hash that represents the current filter state of a view
	// (constructed on selected filters and sorting options)
	getFilterState () {
		const dataF = bars.getFiltersData();
		if (/xml|clusters/.test(app.view)) {
			for (const k of Object.keys(dataF)) {
				if (/^filters-(hints|marks)/.test(k)) {
					delete dataF[k];
				}
			}
		}
		if (app.view === "clusters") {
			delete dataF["select-status"];
		}
		const dataS = app.getSortingData(),
			str = JSON.stringify(dataF) + JSON.stringify(dataS);
		return shared.crypto.createHash("sha1").update(str).digest("hex");
	},
	// sorting: toggle sorting icons
	//  a = node (icon link)
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
	// sorting: get current sorting data
	getSortingData () {
		return {
			ascending: /ascending/.test(document.querySelector("#sorting-dir img").getAttribute("src")) ? true : false,
			filter: document.querySelector("#sorting-filter").value.trim(),
			ignore: document.querySelector("#sorting-ignore.active") ? true : false,
			type: document.querySelector("#sorting-alpha.active") ? "alpha" : "time",
		};
	},
	// sorting: apply sorting preferences
	//   dataS = object (sorting data)
	//   arr = array (to be sorted)
	applySorting (dataS, arr) {
		const sortingDir = dataS.ascending ? [-1, 1] : [1, -1];
		arr.sort((a, b) => {
			// folder "ignore" first
			if (dataS.ignore) {
				if (a.dir === "ignore" && b.dir === "articles") {
					return -1;
				} else if (a.dir === "articles" && b.dir === "ignore") {
					return 1;
				}
			}
			// alpha-numeric
			let x = a.file,
				y = b.file;
			if (dataS.type === "time" &&
					a.published !== b.published) {
				x = a.published;
				y = b.published;
			}
			const result = shared.sort(x, y);
			if (result !== 0) {
				if (result === -1) {
					return sortingDir[0];
				}
				return sortingDir[1];
			}
			return result;
		});
	},
	// view: saves scroll position of view
	viewScrollTop: {},
	// view: reset the scroll position of the current view
	//   type = string (switched | updated)
	resetViewScrollTop (type) {
		if (type === "switched" && app.viewScrollTop[app.view]) {
			window.scrollTo(0, app.viewScrollTop[app.view]);
		} else if (!type) {
			window.scrollTo(0, 0);
		}
	},
	// view: determine the next view after pressing the keyboard shortcut
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
	// view: toggle views
	//   button = node
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
		// close popup in hints view
		viewHints.popupClose({});
		// reset navigation index in hints view
		viewHints.navIdx = -1;
		// save scroll position
		app.viewScrollTop[app.view] = window.scrollY;
		// determine next view
		let nextView = button.id.replace("view-", "");
		// close results bar (if necessary)
		if (!/hints|search/.test(nextView) && document.querySelector("#results.visible")) {
			bars.toggle("results");
		}
		const sortingCont = document.querySelector("#sorting-filter-cont");
		if (nextView === "hints") {
			sortingCont.classList.add("hints-view");
		} else {
			sortingCont.classList.remove("hints-view");
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
	// view: populate the current view
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
				viewClusters.update(type);
				break;
			case "search":
				app.resetViewScrollTop(type);
				bars.resultsSearch();
				document.querySelector("#search-text").select();
				break;
		}
	},
};
