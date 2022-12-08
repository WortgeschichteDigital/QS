"use strict";

let viewSearch = {
	// intersection observer for search results
	observer: new IntersectionObserver(entries => {
		entries.forEach(entry => {
			if (!entry.isIntersecting) {
				return;
			}
			viewSearch.printMoreResults();
		});
	}),
	// as the search can be pretty expensive, let's have a worker
	worker: null,
	// regular expressions for the current search
	data: {
		// regExp is filled with objects:
		//   high = regular expression for highlighting the results
		//   search = regular expression for searching the text
		//   termN = zero-based term number (in the order as they appear in the results bar)
		//   text = search text (used for sorting the expressions by length)
		//   textOri = search term as it was typed
		regExp: [],
		results: [],
		resultsFiles: new Set(),
		resultsFilesPrinted: new Set(),
		running: false, // starting of a new search is blocked
		searching: false, // determines whether the worker has finished or not
		stripTags: false,
	},
	// start search
	async start () {
		const searchText = document.querySelector("#search-text");
		if (viewSearch.data.running) {
			await dialog.open({
				type: "alert",
				text: "Die vorherige Suche läuft noch.",
			});
			searchText.select();
			return;
		}
		viewSearch.data.running = true;
		await xml.updateWait();
		// split up search term
		let textOri = searchText.value.trim(),
			text = textOri;
		if (!text) {
			await shared.wait(25);
			await dialog.open({
				type: "alert",
				text: "Sie haben keinen Suchtext eingegeben.",
			});
			finishUp();
			return;
		}
		if (document.querySelector("#search-always-xml").checked) {
			viewSearch.data.stripTags = false;
		} else {
			viewSearch.data.stripTags = !/[<>]/.test(text);
		}
		let search = [];
		const matchesRegExp = text.matchAll(/\/(.+?)\/(i)?/g);
		for (const i of matchesRegExp) {
			search.push({
				isInsensitive: i[2] ? true : false,
				isRegExp: true,
				text: i[1].replace(/\((?!\?)/g, () => "(?:"),
				textOri: i[0],
				textOriIdx: -1,
			});
			text = text.replace(i[0], "");
		}
		text = text.trim();
		const matchesPhrase = text.matchAll(/'(.+?)'|"(.+?)"/g);
		for (const i of matchesPhrase) {
			search.push({
				isInsensitive: !/[A-ZÄÖÜ]/.test(i[1] || i[2]),
				isRegExp: false,
				text: i[1] || i[2],
				textOri: i[0],
				textOriIdx: -1,
			});
			text = text.replace(i[0], "");
		}
		text = text.trim();
		for (let i of text.split(" ")) {
			i = i.trim();
			if (!i) {
				continue;
			}
			search.push({
				isInsensitive: !/[A-ZÄÖÜ]/.test(i),
				isRegExp: false,
				text: i,
				textOri: i,
				textOriIdx: -1,
			});
		}
		// sort search terms by position in the search expression
		for (const i of search) {
			const reg = new RegExp(shared.escapeRegExp(i.textOri), "g"),
				match = reg.exec(textOri);
			i.textOriIdx = match.index;
		}
		search.sort((a, b) => a.textOriIdx - b.textOriIdx);
		// create regular expressions
		viewSearch.data.regExp.length = 0;
		for (let i = 0, len = search.length; i < len; i++) {
			const item = search[i],
				text = item.isRegExp ? item.text : shared.escapeRegExp(item.text),
				flags = item.isInsensitive ? "gi" : "g";
			let reg, regHigh;
			try {
				reg = new RegExp(addVariants(text), flags);
				if (!viewSearch.data.stripTags && !item.isRegExp) {
					let textHigh = "";
					for (let i = 0, len = text.length; i < len; i++) {
						if (i > 0 && i < len - 1) {
							textHigh += "(<[^>]+>)*";
						}
						textHigh += text[i];
					}
					textHigh = maskSpecialTokens(textHigh);
					regHigh = new RegExp(addVariants(textHigh), flags);
				} else {
					regHigh = reg;
				}
			} catch (err) {
				await shared.wait(25);
				await dialog.open({
					type: "alert",
					text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${shared.errorString(err.message)}`,
				});
				searchText.select();
				return;
			}
			viewSearch.data.regExp.push({
				high: regHigh,
				search: reg,
				termN: i,
				text: item.text,
				textOri: item.textOri,
			});
		}
		viewSearch.data.regExp.sort((a, b) => b.text.length - a.text.length);
		function addVariants (text) {
			const variants = new Map([
				[/&(?!([gl]t|quot);)/g, "&amp;"], // no variant
				[/s/g, "[sſ]"],
				[/ß/g, "(ß|ss)"],
				[/ä/g, "(ä|aͤ)"], // use round brackets!
				[/ö/g, "(ö|oͤ)"],
				[/ü/g, "(ü|uͤ)"],
			]);
			for (const [k, v] of variants) {
				text = text.replace(k, v);
			}
			return text;
		}
		function maskSpecialTokens (text) {
			const variants = new Map([
				[/"/g, "&quot;"],
				[/(?<!\()</g, "&lt;"],
				[/>(?![\])])/g, "&gt;"],
			]);
			for (const [k, v] of variants) {
				text = text.replace(k, v);
			}
			return text;
		}
		// search XML files
		window.scrollTo(0, 0);
		await viewSearch.toggleAdvanced("off");
		await viewSearch.searchXml();
		viewSearch.data.results.forEach(i => viewSearch.data.resultsFiles.add(i.file));
		viewSearch.data.resultsFilesPrinted.clear();
		// print results
		viewSearch.printResults();
		// handle results bar
		bars.resultsSearch();
		// refocus search field
		finishUp();
		function finishUp () {
			searchText.select();
			viewSearch.data.running = false;
		}
	},
	// perform search in XML files
	searchXml () {
		viewSearch.data.searching = true;
		// please hold the line
		const res = document.querySelector("#search");
		shared.clear(res);
		res.appendChild(app.pleaseWait());
		// load worker
		if (!viewSearch.worker) {
			viewSearch.worker = new Worker("js/app/workerSearch.js");
			viewSearch.worker.addEventListener("message", evt => {
				viewSearch.data.results = evt.data;
				viewSearch.data.searching = false;
			});
		}
		// get filters and determine search scope
		const dataF = bars.getFiltersData();
		dataF["select-status"] = parseInt(dataF["select-status"], 10);
		const dataA = viewSearch.getAdvancedData();
		const scopes = {
			"search-scope-1": ["Wortgeschichte_kompakt", "Wortgeschichte(?!_)"],
			"search-scope-2": ["Belegreihe"],
			"search-scope-3": ["Lesarten"],
			"search-scope-4": ["Verweise"],
		};
		let scope = [];
		for (const [id, checked] of Object.entries(dataA)) {
			if (!scopes[id] || !checked) {
				continue;
			}
			scopes[id].forEach(s => scope.push(s));
		}
		// post data to worker
		const narrowSearch = document.querySelector("#search-narrow");
		let regExp = [];
		for (const i of viewSearch.data.regExp) {
			regExp.push(i.search);
		}
		viewSearch.worker.postMessage({
			filters: dataF,
			narrowSearch: narrowSearch.checked ? viewSearch.data.resultsFiles : new Set(),
			regExp,
			sameLine: document.querySelector("#search-same-line").checked,
			scope,
			stripTags: viewSearch.data.stripTags,
			xmlData: xml.data.files,
			xmlFiles: xml.files,
		});
		narrowSearch.checked = false;
		viewSearch.toggleAdvancedIcon();
		// reset results objects
		viewSearch.data.results.length = 0;
		viewSearch.data.resultsFiles.clear();
		// wait until the worker has finished
		return new Promise(resolve => {
			const interval = setInterval(() => {
				if (!viewSearch.data.searching) {
					clearInterval(interval);
					resolve(true);
				}
			}, 250);
		});
	},
	// prepare printing of results
	printResults () {
		const res = document.querySelector("#search");
		shared.clear(res);
		// no results
		if (!viewSearch.data.results.length) {
			res.appendChild(app.nothingToShow());
			return;
		}
		// too much results
		else if (viewSearch.data.results.length > 5e3) {
			viewSearch.data.results.length = 0;
			const div = app.nothingToShow("Zu viele Treffer!", "Tipp: Schränken Sie Ihre Suche weiter ein.");
			res.appendChild(div);
			return;
		}
		// print results
		viewSearch.printMoreResults();
	},
	// print the next chunk of results
	printMoreResults () {
		let res = document.querySelector("#search");
		// remove last result from intersection observer entries
		if (res.lastChild) {
			viewSearch.observer.unobserve(res.lastChild);
		}
		// prepare printing
		const icons = [
			{
				fun: "openPv",
				icon: "xml.svg",
				title: "Datei in der Vorschau öffnen",
			},
			{
				fun: "openEditor",
				icon: "open-file.svg",
				title: "Datei im Editor öffnen",
			},
		];
		let printed = viewSearch.data.resultsFilesPrinted,
			start = 0;
		for (let i = 0, len = viewSearch.data.results.length; i < len; i++) {
			if (!printed.has(viewSearch.data.results[i].file)) {
				start = i;
				break;
			}
		}
		let lastFile = "",
			n = 0;
		// print next 50 results
		for (let f = start, len = viewSearch.data.results.length; f < len; f++) {
			const i = viewSearch.data.results[f];
			n++;
			// heading
			if (i.file !== lastFile) {
				if (n >= 50) {
					break;
				}
				printed.add(i.file);
				// create heading
				let h1 = document.createElement("h1");
				res.appendChild(h1);
				h1.id = i.file;
				h1.textContent = i.file;
				// const icons
				for (const icon of icons) {
					let a = document.createElement("a");
					h1.appendChild(a);
					a.classList.add("icon");
					a.dataset.fun = icon.fun;
					a.dataset.file = i.file;
					a.href = "#";
					a.title = icon.title;
					a.addEventListener("click", function(evt) {
						evt.preventDefault();
						app[this.dataset.fun](this.dataset.file);
					});
					let img = document.createElement("img");
					a.appendChild(img);
					img.src = `img/app/${icon.icon}`;
					img.width = "30";
					img.height = "30";
					img.alt = "";
				}
				// update variables
				lastFile = i.file;
			}
			// result item
			let div = document.createElement("div");
			res.appendChild(div);
			div.classList.add("search-result");
			let line = document.createElement("span");
			div.appendChild(line);
			line.innerHTML = `Zeile <b>${i.line}</b>`;
			// print text
			let text = "";
			if (i.textBefore) {
				text = i.textBefore + " ";
			}
			text += i.text;
			if (i.textAfter) {
				text += " " + i.textAfter;
			}
			text = viewSearch.textMaskChars(text);
			let ele, highlight;
			if (viewSearch.data.stripTags) {
				ele = document.createElement("p");
				highlight = viewSearch.textHighlight(text);
			} else {
				ele = document.createElement("code");
				text = viewSearch.textColorCode(text);
				highlight = viewSearch.textHighlight(text);
			}
			div.dataset.matched = highlight.matched.join(",");
			text = highlight.text;
			text = viewSearch.textWbr(text);
			ele.innerHTML = text;
			div.appendChild(ele);
		}
		// initialize tooltips
		tooltip.init(res);
		// let's have some doomscrolling
		if (printed.size !== viewSearch.data.resultsFiles.size) {
			viewSearch.observer.observe(res.lastChild);
		}
	},
	// mask special characters
	//   text = string
	textMaskChars (text) {
		const chars = new Map([
			[/&(?!amp;)/g, "&amp;"],
			[/</g, "&lt;"],
			[/>/g, "&gt;"],
			[/"/g, "&quot;"],
			[/'/g, "&apos;"],
		]);
		for (const [k, v] of chars) {
			text = text.replace(k, v);
		}
		return text;
	},
	// color-code XML
	//   text = string
	textColorCode (text) {
		// complete comments
		// (as comments are often cut in half they should be completed
		// at the beginning or at the end respectively)
		const open = /&lt;!--/.exec(text)?.index ?? -1,
			close = /--&gt;/.exec(text)?.index ?? -1;
		if (open >= 0 && close.length === -1 ||
				open >= 0 && close >= 0 && open > close) {
			text += " --&gt;";
		}
		if (open === -1 && close >= 0 ||
				open >= 0 && close >= 0 && close < open) {
			text = "&lt;!-- " + text;
		}
		// comments
		// (comments may be incomplete)
		text = text.replace(/&lt;!--.+?--&gt;/gs, m => `<span class="xml-comment">${m}</span>`);
		text = text.replace(/&lt;.+?&gt;/g, m => `<span class="xml-tag">${m}</span>`);
		text = text.replace(/<span class="xml-tag">(.+?)<\/span>/g, (m, p1) => {
			p1 = p1.replace(/ (.+?=)(&quot;.+?&quot;)/g, (m, p1, p2) => {
				return ` <span class="xml-attr-key">${p1}</span><span class="xml-attr-val">${p2}</span>`;
			});
			return `<span class="xml-tag">${p1}</span>`;
		});
		return text;
	},
	// highlight search results
	//   text = string
	//   regExp = array
	textHighlight (text, regExp = viewSearch.data.regExp) {
		let matched = new Set();
		for (let i = 0, len = regExp.length; i < len; i++) {
			const item = regExp[i],
				reg = viewSearch.data.stripTags ? item.search || item.high : item.high,
				termN = item.termN,
				color = termN % 6 + 1;
			text = text.replace(reg, m => {
				matched.add(termN);
				// highlighing across tag boundaries
				if (/[<>]/.test(m)) {
					let n = 0;
					m = m.replace(/<.+?>/g, m => {
						// if (/^<\//.test(m)) {
						// 	return `</mark>${m}`;
						// }
						n++;
						return `</mark>${m}<mark class="color${color} ${n}">`;
					});
					m = `<mark class="color${color} 0">${m}</mark>`;
					m = m.replace(/(<\/.+?>)(<\/.+?>)/g, (m, p1, p2) => {
						if (p2 === "</mark>") {
							return p1;
						}
						return m;
					});
					for (let i = 0; i <= n; i++) {
						const reg = new RegExp(` ${i}"`);
						if (i === 0) {
							m = m.replace(reg, ' no-end"');
						} else if (i === n) {
							m = m.replace(reg, ' no-start"');
						} else {
							m = m.replace(reg, ' no-start no-end"');
						}
					}
					return m;
				}
				// no tag boundaries
				return `<mark class="color${color}">${m}</mark>`;
			});
		}
		const clean = new RegExp(`(<[^>]*?)<mark class="color[0-9]">(.+?)<\/mark>`, "g");
		while (clean.test(text)) {
			text = text.replace(clean, (m, p1, p2) => p1 + p2);
		}
		return {
			matched: [...matched].sort((a, b) => a - b),
			text,
		};
	},
	// insert <wbr> at certain positions
	//   text = string
	textWbr (text) {
		text = text.replace(/[%_]/g, m => `<wbr>${m}`);
		text = text.replace(/&amp;/g, "&amp;<wbr>");
		text = text.replace(/(?<!&amp;|<)\//g, "/<wbr>");
		return text;
	},
	// read the checkboxes within advanced options
	getAdvancedData () {
		let advanced = {};
		document.querySelectorAll("#search-advanced input").forEach(i => advanced[i.id] = i.checked);
		return advanced;
	},
	// toggle advanced search options
	//   force = on | off | undefined
	toggleAdvanced (force = "") {
		return new Promise(async resolve => {
			const a = document.querySelector("#search-advanced"),
				maxHeight = a.offsetTop + a.offsetHeight + 10; // 10px padding-top #search-form
			const bar = document.querySelector("#bar"),
				barHeight = bar.offsetHeight;
			if ((!force || force === "on") && barHeight < maxHeight) {
				// toggle on
				bar.style.height = "60px";
				void bar.offsetHeight;
				bar.style.height = maxHeight + "px";
				await new Promise(end => bar.addEventListener("transitionend", () => end(true), { once: true }));
			} else if ((!force || force === "off") && barHeight === maxHeight) {
				// toggle off
				bar.style.height = maxHeight + "px";
				void bar.offsetHeight;
				bar.style.height = "60px";
				await new Promise(end => bar.addEventListener("transitionend", () => end(true), { once: true }));
			}
			resolve(true);
		});
	},
	// toggle color of advanced icon
	toggleAdvancedIcon () {
		const dataA = viewSearch.getAdvancedData(),
			checked = Object.values(dataA).filter(i => i).length,
			icon = document.querySelector("#search-advanced-toggle img");
		if (!dataA["search-scope-0"] || checked > 1) {
			icon.src = "img/app/preferences-red.svg";
		} else {
			icon.src = "img/app/preferences.svg";
		}
	},
	// toggle checkboxes
	//   cb = element (changed checkbox)
	toggleScope (cb) {
		const scope0 = document.querySelector("#search-scope-0");
		if (cb.checked && cb.value !== "0") {
			scope0.checked = false;
		} else if (cb.checked && cb.value === "0") {
			const boxes = document.querySelectorAll("#search-scope input");
			for (let i = 1, len = boxes.length; i < len; i++) {
				boxes[i].checked = false;
			}
		}
		if (!document.querySelector("#search-scope input:checked")) {
			scope0.checked = true;
		}
		viewSearch.toggleAdvancedIcon();
	},
};
