"use strict";

let viewSearch = {
	// as the search can be pretty expensive, let's have a worker
	worker: null,
	// regular expressions for the current search
	data: {
		regExp: [],
		regExpTags: [], // expression for highlighting printed tags (< or > turn to &lt; and &gt; respectively)
		results: [],
		running: false, // start of a new search is blocked
		searching: false, // determines whether the worker has finished or not
		stripTags: false,
	},
	// start search
	async start () {
		if (viewSearch.data.running) {
			return;
		}
		viewSearch.data.running = true;
		await xml.updateWait();
		window.scrollTo(0, 0);
		// split up search term
		let searchText = document.querySelector("#search-text"),
			text = searchText.value.trim();
		if (!text) {
			await shared.wait(25);
			await dialog.open({
				type: "alert",
				text: "Sie haben keinen Suchtext eingegeben.",
			});
			finishUp();
			return;
		}
		let search = [];
		viewSearch.data.stripTags = !/[<>]/.test(text);
		const matchesRegExp = text.matchAll(/\/(.+?)\/(i)?/g);
		for (const i of matchesRegExp) {
			search.push({
				isInsensitive: i[2] ? true : false,
				isRegExp: true,
				text: i[1].replace(/\((?!\?)/g, () => "(?:"),
			});
			text = text.replace(i[0], "");
		}
		text = text.trim();
		const matchesPhrase = text.matchAll(/"(.+?)"/g);
		for (const i of matchesPhrase) {
			search.push({
				isInsensitive: !/[A-ZÄÖÜ]/.test(i[1]),
				isRegExp: false,
				text: i[1],
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
			});
		}
		// create regular expressions
		viewSearch.data.regExp.length = 0;
		viewSearch.data.regExpTags.length = 0;
		for (const i of search) {
			const text = i.isRegExp ? i.text : shared.escapeRegExp(i.text);
			const flags = i.isInsensitive ? "gi" : "g";
			let reg, regTags;
			try {
				reg = new RegExp(text, flags);
				if (!viewSearch.data.stripTags && !i.isRegExp) {
					regTags = new RegExp(text.replace(/</g, "&lt;").replace(/>/g, "&gt;"), flags);
				} else {
					regTags = reg;
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
			viewSearch.data.regExp.push(reg);
			viewSearch.data.regExpTags.push(regTags);
		}
		// search XML files
		viewSearch.data.results.length = 0;
		await viewSearch.searchXml();
		// print results
		viewSearch.printResults();
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
		const res = document.querySelector("#search-results");
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
		const dataF = filters.getData();
		dataF["select-status"] = parseInt(dataF["select-status"], 10);
		const dataS = viewSearch.getScopeData();
		const scopes = [
			[],
			["Wortgeschichte_kompakt", "Wortgeschichte(?!_)"],
			["Belegreihe"],
			["Lesarten"],
			["Verweise"],
		];
		let scope = [];
		if (!dataS[0]) {
			for (let i = 1, len = dataS.length; i < len; i++) {
				if (!dataS[i]) {
					continue;
				}
				scopes[i].forEach(s => scope.push(s));
			}
		}
		// post data to worker
		viewSearch.worker.postMessage({
			filters: dataF,
			regExp: viewSearch.data.regExp,
			scope,
			stripTags: viewSearch.data.stripTags,
			xmlData: xml.data.files,
			xmlFiles: xml.files,
		});
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
	// print results
	printResults () {
		const res = document.querySelector("#search-results");
		shared.clear(res);
		// no results
		if (!viewSearch.data.results.length) {
			res.appendChild(app.nothingToShow());
			return;
		}
		// too much results
		else if (viewSearch.data.results.length > 9999) {
			const div = app.nothingToShow("Zu viele Treffer!", "Tipp: Schränken Sie Ihre Suche weiter ein.");
			res.appendChild(div);
			return;
		}
		// print results
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
		let lastFile = "",
			xmlFiles = [];
		for (const i of viewSearch.data.results) {
			// heading
			if (i.file !== lastFile) {
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
				xmlFiles.push(i.file);
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
			let ele;
			if (viewSearch.data.stripTags) {
				ele = document.createElement("p");
				text = viewSearch.textHighlight(text, viewSearch.data.regExp);
			} else {
				ele = document.createElement("code");
				text = viewSearch.textColorCode(text);
				text = viewSearch.textHighlight(text, viewSearch.data.regExpTags);
			}
			text = viewSearch.textWbr(text);
			ele.innerHTML = text;
			div.appendChild(ele);
		}
		tooltip.init(res);
		// build side bar TODO
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
		text = text.replace(/&lt;!--.+?--&gt;/g, m => `<span class="xml-comment">${m}</span>`);
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
	//   reg = array (with expressions)
	textHighlight (text, reg) {
		for (let i = 0, len = reg.length; i < len; i++) {
			const r = reg[i],
				color = i % 6 + 1;
			text = text.replace(r, m => `<mark class="color${color}">${m}</mark>`);
		}
		return text;
		// TODO <mark> innerhalb von Tags erkennen
	},
	// insert <wbr> at certain positions
	//   text = string
	textWbr (text) {
		text = text.replace(/[%_]/g, m => `<wbr>${m}`);
		text = text.replace(/&amp;/g, "&amp;<wbr>");
		text = text.replace(/(?<!&amp;|<)\//g, "/<wbr>");
		return text;
	},
	// read the checkboxes that determine the search scope
	getScopeData () {
		let scope = [];
		document.querySelectorAll("#search-scope input").forEach((i, n) => scope[n] = i.checked);
		return scope;
	},
	// toggle checkboxes
	//   cb = element (changed checkbox)
	toggleCheckboxes (cb) {
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
	}
};
