"use strict";

let viewHints = {
	// hint types
	types: {
		article_file: "Dateiname korrigieren",
		article_id: "Artikel-ID korrigieren",
		comment: "XML-Kommentar",
		diasystemic_value: "Diasystematik ergänzen",
		ez_link: "Objektsprache mit Artikel verlinken",
		ez_stichwort: "Stichwort falsch ausgezeichnet",
		link_duplicate: "Duplikat entfernen",
		link_error: "Artikel-Link korrigieren",
		literature_error: "Literatur-Tag korrigieren",
		literature_missing: "Literaturtitel ergänzen",
		semantic_type: "Semantik ergänzen",
		sprache_superfluous: "Sprach-Attribut entfernen",
		tr_error: "Textreferenz korrigieren",
		tr_link: "Textreferenz mit Artikel verlinken",
		tr_superfluous: "Textreferenz entfernen",
		www_error: "Externen Link korrigieren",
		www_link: "Externen Link mit Artikel verlinken",
	},
	// intersection observer for hints
	// (the last hint is observed if there are more to display)
	observer: new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (!entry.isIntersecting) {
				return;
			}
			viewHints.print();
		});
	}),
	// current hints data
	data: {
		hints: [],
		files: new Set(),
		filesPrinted: new Set(),
		filesPrintedBefore: new Set(),
	},
	// last content state of this view
	contentState: {
		filterState: "", // hash
		xmlDate: "", // date of last XML update
	},
	// timeout that prevents printing the hints in a too rapid succession
	printTimeout: null,
	// populate the view
	//   type = string (switched | updated)
	async populate (type) {
		clearTimeout(viewHints.printTimeout);
		await xml.updateWait();
		if (app.view !== "hints") {
			return;
		}
		// get current content state
		// (restore scroll position in case the state is unchanged)
		const filterState = app.getFilterState();
		if (filterState === viewHints.contentState.filterState &&
				xml.data.date === viewHints.contentState.xmlDate) {
			app.resetViewScrollTop(type);
			return;
		}
		const scrollY = window.scrollY;
		// clear hints area
		const cont = document.querySelector("#hints");
		shared.clear(cont);
		// collect relevant hints
		viewHints.collect();
		// no hints to be displayed
		const data = viewHints.data;
		if (!data.hints.length) {
			cont.appendChild(app.nothingToShow());
			return;
		}
		// sort hints
		app.applySorting(app.getSortingData(), data.hints);
		// prepare file lists
		data.files.clear();
		data.filesPrintedBefore = new Set([...data.filesPrinted]);
		data.filesPrinted.clear();
		data.hints.forEach(i => data.files.add(i.file));
		// print first chunk of hints and reset scroll position
		viewHints.printTimeout = setTimeout(() => {
			viewHints.print();
			if (filterState === viewHints.contentState.filterState) {
				// restore scroll position only in case the filter state is identical
				while (data.filesPrinted.size < data.filesPrintedBefore.size &&
						data.filesPrinted.size < data.files.size) {
					viewHints.print();
				}
				if (type === "updated") {
					window.scrollTo(0, scrollY);
				} else {
					app.resetViewScrollTop(type);
				}
			}
			viewHints.contentState.filterState = filterState;
			viewHints.contentState.xmlDate = xml.data.date;
		}, 500);
	},
	// collect hints
	collect () {
		// collect filter data
		const dataF = bars.getFiltersData();
		dataF["select-status"] = parseInt(dataF["select-status"], 10);
		const dataS = app.getSortingData(),
			regPath = new RegExp(shared.escapeRegExp(dataS.filter), "i");
		let hintTypes = [];
		for (const [k, v] of Object.entries(dataF)) {
			if (!/^filters-hints/.test(k) || !v) {
				continue;
			}
			switch (k.replace(/^filters-hints-/, "")) {
				case "links_error":
					hintTypes = hintTypes.concat([
						"link_duplicate",
						"link_error",
						"tr_error",
						"tr_superfluous",
						"www_error",
					]);
					break;
				case "links_suggestion":
					hintTypes = hintTypes.concat([
						"ez_link",
						"tr_link",
						"www_link",
					]);
					break;
				case "tagging_error":
					hintTypes = hintTypes.concat([
						"ez_stichwort",
						"literature_error",
						"sprache_superfluous",
					]);
					break;
				case "tagging_diasystems":
					hintTypes = hintTypes.concat([
						"diasystemic_value",
					]);
					break;
				case "tagging_semantics":
					hintTypes = hintTypes.concat([
						"semantic_type",
					]);
					break;
				case "general":
					hintTypes = hintTypes.concat([
						"article_file",
						"article_id",
						"literature_missing",
					]);
					break;
				case "comment":
					hintTypes = hintTypes.concat([
						"comment",
					]);
					break;
			}
		}
		// collect hints
		viewHints.data.hints = [];
		for (const [file, data] of Object.entries(xml.data.files)) {
			// filter XML files
			if (dataF["select-authors"] && !data.authors.includes(dataF["select-authors"]) ||
					dataF["select-domains"] && !data.domains.includes(dataF["select-domains"]) ||
					dataF["select-status"] && data.status !== dataF["select-status"] ||
					!regPath.test(data.dir + "/" + file)) {
				continue;
			}
			for (const hint of data.hints) {
				// filter hint types and special filters
				if (!hintTypes.includes(hint.type) ||
						hint.linkCount && dataF["filters-hints-links_suggestion_filter"] ||
						hint.type === "comment" && dataF["filters-hints-comment_filter"] && !commentAuthorText(hint.textHint[0])) {
					continue;
				}
				// filter by mark
				const mark = prefs.data?.marks?.[hint.ident];
				if (!mark && !dataF["filters-marks-unchecked"] ||
						mark === 1 && !dataF["filters-marks-checked_okay"] ||
						mark === 2 && !dataF["filters-marks-checked_error"]) {
					continue;
				}
				// push hint
				viewHints.data.hints.push({
					dir: data.dir,
					file,
					hint,
					published: data.published,
				});
			}
		}
		// reduce comment text
		function commentAuthorText(text) {
			text = text.match(/<!--(.+?)-->/s)[1];
			text = text.replace(/<.+?>/g, "").trim();
			return text;
		}
	},
	// print hints
	print () {
		let cont = document.querySelector("#hints");
		// remove last hint from intersection observer entries
		if (cont.lastChild) {
			viewHints.observer.unobserve(cont.lastChild);
		}
		// prepare printing
		let printed = viewHints.data.filesPrinted,
			start = 0;
		for (let i = 0, len = viewHints.data.hints.length; i < len; i++) {
			if (!printed.has(viewHints.data.hints[i].file)) {
				start = i;
				break;
			}
		}
		let lastFile = "";
		// print next 50 hints
		const asideIcons = [
			{
				file: viewHints.markIcons,
				fun: "toggleMark",
				title: "Markierung ändern",
			},
			{
				file: ["context.svg"],
				fun: "showContext",
				title: "Kontext anzeigen",
			},
		];
		for (let f = start, len = viewHints.data.hints.length; f < len; f++) {
			const i = viewHints.data.hints[f];
			// HEADING
			if (i.file !== lastFile) {
				if (f - start + 1 >= 50) {
					break;
				}
				printed.add(i.file);
				// create heading
				cont.appendChild(app.makeListHeading(i.file));
				// update variables
				lastFile = i.file;
			}
			// BLOCK
			let div = document.createElement("div");
			cont.appendChild(div);
			div.classList.add("hint-item");
			div.dataset.file = i.file;
			div.dataset.ident = i.hint.ident;
			div.dataset.line = i.hint.line;
			// ASIDE
			// (line, mark, context)
			let aside = document.createElement("div");
			div.appendChild(aside);
			aside.classList.add("aside");
			let line = document.createElement("div");
			aside.appendChild(line);
			line.classList.add("line");
			line.innerHTML = `Zeile <b>${i.hint.line}</b>`;
			let icons = document.createElement("div");
			aside.appendChild(icons);
			icons.classList.add("icons");
			for (const icon of asideIcons) {
				let a = document.createElement("a");
				icons.appendChild(a);
				a.classList.add("icon");
				a.dataset.fun = icon.fun;
				a.href = "#";
				a.title = icon.title;
				let imgN = 0;
				if (icon.fun === "toggleMark") {
					imgN = prefs.data?.marks?.[i.hint.ident] || 0;
				}
				let img = document.createElement("img");
				a.appendChild(img);
				img.src = `img/app/${icon.file[imgN]}`;
				img.width = "36";
				img.height = "36";
				img.alt = "";
				a.addEventListener("click", function(evt) {
					evt.preventDefault();
					const hint = this.closest("[data-file]").dataset;
					viewHints[this.dataset.fun]({
						ele: this,
						file: hint.file,
						ident: hint.ident,
						line: parseInt(hint.line),
					});
				});
			}
			// HINT
			let hint = document.createElement("div");
			div.appendChild(hint);
			hint.classList.add("hint");
			// error message
			let h2 = document.createElement("h2");
			hint.appendChild(h2);
			let a = document.createElement("a");
			h2.appendChild(a);
			a.dataset.type = i.hint.type;
			a.href = "#";
			a.textContent = viewHints.types[i.hint.type];
			a.title = "Erläuterung im Handbuch öffnen";
			a.addEventListener("click", function(evt) {
				evt.preventDefault();
				shared.ipc.invoke("help", {
					id: this.dataset.type,
					section: "hints",
				});
			});
			// erroneous text
			if (i.hint.textErr.length) {
				let textE = document.createElement("div");
				hint.appendChild(textE);
				textE.classList.add("text-erroneous");
				viewHints.fillText(textE, i.hint.textErr);
			}
			// correct text
			if (i.hint.textHint.length) {
				let textH = document.createElement("div");
				hint.appendChild(textH);
				viewHints.fillText(textH, i.hint.textHint);
				if (i.hint.textErr.length) {
					textH.classList.add("text-correct");
				} else {
					textH.classList.add("text-hint");
				}
			}
			// link count
			if (i.hint.linkCount) {
				let count = document.createElement("div");
				hint.appendChild(count);
				count.classList.add("repeated");
				count.textContent = `Schon ${i.hint.linkCount}\u00A0⨉ verlinkt!`;
			}
			// scope
			let scope = document.createElement("div");
			hint.appendChild(scope);
			scope.classList.add("scope");
			scope.textContent = i.hint.scope;
		}
		// initialize tooltips
		tooltip.init(cont);
		// let's have some doomscrolling
		if (printed.size !== viewHints.data.files.size) {
			viewHints.observer.observe(cont.lastChild);
		}
	},
	// fill in hint texts
	//   cont = node
	//   text = array
	fillText (cont, text) {
		for (const i of text) {
			let p = document.createElement("p");
			cont.appendChild(p);
			if (typeof i === "string") {
				p.innerHTML = prepareText(i);
			} else {
				let context = "";
				if (i.type === "context") {
					context = "<i>Kontext:</i> ";
					p.classList.add("context");
				} else if (i.type === "copy") {
					p.title = "Klick zum Kopieren";
					p.addEventListener("click", function() {
						// TODO copy text
						// TODO copy feedback
					});
				} else if (i.type === "hint_text") {
					p.classList.add("hint-text");
				}
				p.innerHTML = context + prepareText(i.text);
				if (i.type === "comment_link") {
					let a = document.createElement("a");
					p.appendChild(a);
					a.classList.add("comment-link");
					a.href = "#";
					a.textContent = "Auskommentieren?";
					a.addEventListener("click", function(evt) {
						evt.preventDefault();
						// TODO show hint
					});
				}
			}
		}
		// prepare text (replace special tokens, highlight)
		function prepareText (text) {
			text = viewSearch.textMaskChars(text);
			if (/&lt;/.test(text) &&
					/&gt;/.test(text)) {
				text = viewSearch.textColorCode(text);
			}
			text = text.replace(/\n/g, "<br>");
			return text;
		}
	},
	// mark icons
	markIcons: ["mark-unchecked-small.svg", "button-yes.svg", "button-no.svg"],
	// toggle the mark of a hint
	//   ele = node (clicked link)
	//   ident = string (identification hash)
	toggleMark ({ ele, ident }) {
		if (!prefs.data.marks) {
			prefs.data.marks = {};
		}
		let state = prefs.data.marks?.[ident] || 0;
		if (state === 2) {
			state = 0;
		} else {
			state++;
		}
		if (state) {
			prefs.data.marks[ident] = state;
		} else {
			delete prefs.data.marks[ident];
		}
		ele.firstChild.src = `img/app/${viewHints.markIcons[state]}`;
	},
	// erase marks for hints that no longer exist
	cleanMarks () {
		if (!prefs.data.marks) {
			return;
		}
		let idents = new Set();
		for (const data of Object.values(xml.data.files)) {
			for (const hint of data.hints) {
				idents.add(hint.ident);
			}
		}
		for (const ident of Object.keys(prefs.data.marks)) {
			if (!idents.has(ident)) {
				delete prefs.data.marks[ident];
			}
		}
	},
	// show extended XML context of a hint
	//   ele = node (clicked link)
	//   file = string (XML file name)
	//   ident = string (identification hash)
	//   line = number
	showContext ({ ele, file, ident, line }) {
		// TODO
	},
};
