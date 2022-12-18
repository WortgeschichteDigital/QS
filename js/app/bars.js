"use strict";

let bars = {
	// toggle a bar
	//   bar = string
	toggle (bar) {
		if (bar === "filters") {
			document.querySelector("#fun-filters").classList.toggle("active");
		}
		document.getElementById(bar).classList.toggle("visible");
	},
	// filters: data object
	filtersData: {
		authors: [],
		domains: [],
		status: [
			{
				icon: "status-unchanged.svg",
				text: "Datei unverändert",
				value: "0",
			},
			{
				icon: "status-changed.svg",
				text: "Datei geändert",
				value: "1",
			},
			{
				icon: "status-untracked.svg",
				text: "Datei neu",
				value: "2",
			},
		],
	},
	// filters: return filter data
	getFiltersData () {
		let data = {};
		document.querySelectorAll(".select-filter").forEach(i => {
			data[i.id] = i.dataset.value;
		});
		document.querySelectorAll("#filters input").forEach(i => {
			data[i.id] = i.checked;
		});
		return data;
	},
	// filters: update filter values
	filtersUpdate () {
		const cats = {
			authors: new Set(),
			domains: new Set(),
		};
		for (const i of Object.values(xml.data.files)) {
			i.authors.forEach(i => cats.authors.add(i));
			i.domains.forEach(i => cats.domains.add(i));
		}
		for (const [cat, set] of Object.entries(cats)) {
			bars.filtersData[cat] = [];
			for (const i of set) {
				bars.filtersData[cat].push({
					icon: "",
					text: i,
					value: i,
				});
			}
		}
		bars.filtersData.authors.sort((a, b) => shared.sort(a.value, b.value));
		bars.filtersData.domains.sort((a, b) => shared.sort(a.value, b.value));
	},
	// filters: visualize that filters are active
	filtersActive () {
		let data = bars.getFiltersData(),
			active = false;
		for (const [k, v] of Object.entries(data)) {
			const ele = document.getElementById(k);
			if (ele.closest(".off")) {
				continue;
			}
			const name = ele.nodeName,
				offDefault = /(comment_filter|links_suggestion_filter)$/.test(ele.id);
			if (name === "INPUT" &&
						(!offDefault && !v || offDefault && v) ||
					name !== "INPUT" && v) {
				active = true;
				break;
			}
		}
		const button = document.querySelector("#fun-filters");
		if (active) {
			button.classList.add("active-filters");
		} else {
			button.classList.remove("active-filters");
		}
	},
	// filters: reset all filters in the filter bar
	filtersReset () {
		const statusOff = document.querySelector("#filters-status.off");
		document.querySelectorAll(".select-filter").forEach(i => {
			if (i.id === "select-status" && statusOff) {
				return;
			}
			if (i.dataset.value) {
				i.dataset.value = "";
				bars.fillSelect(i);
			}
		});
		if (!document.querySelector("#filters-hints.off")) {
			document.querySelectorAll("#filters input").forEach(i => {
				i.checked = i.defaultChecked;
			});
		}
		bars.filtersActive();
		if (/xml|hints|clusters/.test(app.view)) {
			app.populateView();
		}
	},
	// filters: show or hide filter categories appropriate to the current view
	toggleFiltersCat () {
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
	// filters: bulk toggle for all hint filters
	//   id = string
	toggleFiltersHints (id) {
		const checked = /-all$/.test(id);
		document.querySelectorAll('#filters-hints input[id^="filters-hints"]').forEach(i => {
			i.checked = checked;
		});
		bars.filtersActive();
		app.populateView();
	},
	// results: fill and show results bar (hints)
	resultsHints () {
		const data = viewHints.data;
		// no results
		if (!data.hints.length) {
			bars.resultsNone();
			return;
		}
		// hide queries block
		document.querySelector("#results-queries").classList.add("off");
		// fill summary
		let summary = document.querySelector("#results-summary");
		summary.classList.remove("nothing");
		summary.innerHTML = `<b>${data.hints.length}</b> Hinweise in <b>${data.files.size}</b> Dateien`;
		// fill in XML files
		bars.resultsXml(data.hints);
		// show bar
		bars.resultsShow();
		// scroll top
		document.querySelector("#results div").scrollTop = 0;
	},
	// results: fill and show results bar (search)
	resultsSearch () {
		const data = viewSearch.data;
		// no results
		if (!data.results.length) {
			bars.resultsNone();
			return;
		}
		// fill summary
		let summary = document.querySelector("#results-summary");
		summary.classList.remove("nothing");
		summary.innerHTML = `<b>${data.results.length}</b> Treffer in <b>${data.resultsFiles.size}</b> Dateien`;
		// fill in search queries
		let queries = document.querySelector("#results-queries");
		queries.classList.remove("off");
		shared.clear(queries);
		for (let i = 0, len = data.regExp.length; i < len; i++) {
			let a = document.createElement("a");
			queries.appendChild(a);
			a.href = "#" + i;
			let mark = document.createElement("mark");
			a.appendChild(mark);
			mark.textContent = data.regExp.find(item => item.termN === i).textOri;
			mark.classList.add(`color${i % 6 + 1}`);
			a.addEventListener("click", function(evt) {
				evt.preventDefault();
				bars.resultsSearchNextQuery(this);
			});
		}
		// fill in XML files
		bars.resultsXml(data.results);
		// reset navigation
		bars.resultsSearchNextQueryData.query = "";
		// show bar
		bars.resultsShow();
		// scroll top
		document.querySelector("#results div").scrollTop = 0;
	},
	// results: show bar
	resultsShow () {
		if (window.innerWidth >= 1250 &&
				!document.querySelector("#results.visible")) {
			bars.toggle("results");
		}
	},
	// results: no search results
	resultsNone () {
		const blocks = document.querySelectorAll("#results > div > *");
		blocks[0].classList.add("nothing");
		blocks[0].textContent = "Nichts gefunden!";
		blocks[1].classList.add("off");
		blocks[2].classList.add("off");
		if (document.querySelector("#results.visible")) {
			bars.toggle("results");
		}
	},
	// results: build list of XML files
	//   data = array
	resultsXml (data) {
		let files = document.querySelector("#results-files");
		files.classList.remove("off");
		shared.clear(files);
		let lastFile = "";
		for (const i of data) {
			if (i.file === lastFile) {
				continue;
			}
			lastFile = i.file;
			let a = document.createElement("a");
			files.appendChild(a);
			a.href = "#" + i.file;
			a.textContent = i.file;
			a.addEventListener("click", function(evt) {
				evt.preventDefault();
				bars.resultsSearchNextFile(this);
			});
		}
	},
	// results: navigational data for queries
	resultsSearchNextQueryData: {
		query: "",
		idx: -1,
	},
	// results: navigate to next query of type
	//   a = node (clicked query)
	async resultsSearchNextQuery (a) {
		if (viewSearch.data.running) {
			return;
		}
		// detect next match
		const data = bars.resultsSearchNextQueryData,
			query = a.getAttribute("href").substring(1);
		let matches = bars.resultsSearchNextQueryMatches(query);
		if (data.query !== query) {
			data.query = query;
			data.idx = 0;
		} else {
			data.idx++;
			if (data.idx === matches.length) {
				let idx = 0;
				while (viewSearch.data.resultsFiles.size !== viewSearch.data.resultsFilesPrinted.size) {
					// reload more results
					viewSearch.printMoreResults();
					matches = bars.resultsSearchNextQueryMatches(query);
					if (data.idx < matches.length) {
						idx = data.idx;
						break;
					}
				}
				data.idx = idx;
			}
		}
		// scroll to next match
		const topBarsHeight = document.querySelector("#bar").getBoundingClientRect().bottom,
			headingHeight = document.querySelector("#search h1").offsetHeight,
			nextMatch = matches[data.idx];
		window.scrollTo({
			top: nextMatch.getBoundingClientRect().top + window.scrollY - topBarsHeight - headingHeight,
			left: 0,
			behavior: "smooth",
		});
		// highlight the result
		shared.highlightBlock(nextMatch);
	},
	// results: search matches for the given query
	//   query = string (zero-based number of the query)
	resultsSearchNextQueryMatches (query) {
		let reg = new RegExp(`(^|,)${query}(,|$)`),
			matches = [];
		document.querySelectorAll(".search-result").forEach(i => {
			if (reg.test(i.dataset.matched)) {
				matches.push(i);
			}
		});
		return matches;
	},
	// results: navigate to next file
	//   a = node (clicked file)
	resultsSearchNextFile (a) {
		if (app.view === "search" && viewSearch.data.running) {
			return;
		}
		// find heading
		let id = a.getAttribute("href").substring(1),
			h1 = document.getElementById(id);
		while (!h1) {
			// reload more results
			if (app.view === "hints") {
				viewHints.print();
			} else if (app.view === "search") {
				viewSearch.printMoreResults();
			}
			h1 = document.getElementById(id);
		}
		// scroll to heading
		const topBarsHeight = document.querySelector("#bar").getBoundingClientRect().bottom,
			headingHeight = document.querySelector(`#${app.view} h1`).offsetHeight,
			firstResult = h1.nextSibling.getBoundingClientRect().top;
		window.scrollTo({
			top: firstResult + window.scrollY - topBarsHeight - headingHeight,
			left: 0,
			behavior: "smooth",
		});
	},
	// select: fill the given select according to its value
	//   select = node
	fillSelect (select) {
		// no value
		const value = select.dataset.value;
		if (!value) {
			select.textContent = "alle";
			return;
		}
		// search data
		const cat = select.id.replace("select-", ""),
			data = bars.filtersData[cat].find(i => i.value === value);
		// filter doesn't exist anymore
		if (!data) {
			select.dataset.value = "";
			select.textContent = "alle";
			return;
		}
		// fill in filter
		let icon = "";
		if (data.icon) {
			icon = `<img src="img/app/${data.icon}" width="24" height="24" alt="">`;
		}
		select.innerHTML = icon + data.text;
	},
	// select: build select popup
	//   a = node (clicked select filter)
	selectPopup (a) {
		// create popup
		let div = document.createElement("div");
		a.parentNode.appendChild(div);
		div.classList.add("select-popup", "hide");
		// fill popup
		const alle = [{
			icon: "",
			text: "<i>alle</i>",
			value: "",
		}];
		const cat = a.id.replace("select-", ""),
			hasIcons = bars.filtersData[cat].some(i => i.icon);
		for (const i of alle.concat(bars.filtersData[cat])) {
			let item = document.createElement("a");
			div.appendChild(item);
			item.dataset.value = i.value;
			item.href = "#";
			let icon = "";
			if (i.icon) {
				icon = `<img src="img/app/${i.icon}" width="24" height="24" alt="">`;
			} else if (hasIcons) {
				icon = `<img src="img/app/placeholder.svg" width="24" height="24" alt="">`;
			}
			item.innerHTML = icon + i.text;
			item.addEventListener("click", function(evt) {
				evt.preventDefault();
				const select = this.closest(".select-cont").firstChild;
				select.dataset.value = i.value;
				bars.fillSelect(select);
				bars.closeSelectPopup(this, false);
				select.focus();
				bars.filtersActive();
				if (/xml|hints|clusters/.test(app.view)) {
					app.populateView();
				}
			});
		}
		// show popup
		void div.offsetWidth;
		div.classList.remove("hide");
	},
	// select: close a select popup
	//   ele = node (caller: select filter or item in select popup)
	//   timeout = boolean
	closeSelectPopup (ele, timeout) {
		const wait = timeout ? 200 : 0;
		setTimeout(() => {
			const dd = ele.closest(".select-cont").querySelector(".select-popup");
			if (dd) {
				dd.addEventListener("transitionend", function() {
					if (this.parentNode) {
						this.parentNode.removeChild(this);
					}
				}, { once: true });
				dd.classList.add("hide");
			}
		}, wait);
	},
};
