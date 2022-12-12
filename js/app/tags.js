"use strict";

let tags = {
	// tags data:
	//   [TAG] = object
	//     [ATTRIBUTE NAME | _all] = array (filled with XML file names)
	data: {},
	// collect tags and attributes
	collectData () {
		tags.data = {};
		for (const [k, v] of Object.entries(xml.files)) {
			const doc = new DOMParser().parseFromString(v, "text/xml");
			doc.querySelectorAll("Wortgeschichte_kompakt *").forEach(i => {
				const name = i.nodeName;
				if (!tags.data[name]) {
					tags.data[name] = {
						_all: [k],
					};
				} else if (!tags.data[name]._all.includes(k)) {
					tags.data[name]._all.push(k);
				}
				for (const a of i.attributes) {
					if (!tags.data[name][a.name]) {
						tags.data[name][a.name] = [k];
					} else if (!tags.data[name][a.name].includes(k)) {
						tags.data[name][a.name].push(k);
					}
				}
			});
		}
	},
	// show all tags used in each and every summary
	show () {
		if (!Object.keys(xml.files).length) {
			shared.error("XML-Dateidaten nicht geladen");
			return;
		}
		if (!Object.keys(tags.data).length) {
			// collect tags and attributes
			tags.collectData();
			// build tags list
			let tt = Object.keys(tags.data).sort(shared.sort),
				ttCont = document.querySelector("#tags-tags");
			shared.clear(ttCont);
			for (const i of tt) {
				let a = document.createElement("a");
				ttCont.appendChild(a);
				a.href = `#${i}`;
				a.textContent = `<${i}>`;
				a.addEventListener("click", function(evt) {
					evt.preventDefault();
					tags.listAttributes(this);
				});
			}
		}
		// remove .active
		document.querySelectorAll("#tags-tags .active").forEach(i => i.classList.remove("active"));
		// turn off further blocks
		["attributes", "nav", "label", "code"].forEach(i => document.querySelector(`#tags-${i}`).classList.add("off"));
		// show overlay
		overlay.show("tags");
	},
	// build attributes list
	//   ele = element (clicked tag)
	listAttributes (ele) {
		// toggle active mark
		document.querySelectorAll("#tags-tags a").forEach(i => {
			if (i === ele) {
				i.classList.add("active");
			} else {
				i.classList.remove("active");
			}
		});
		// build attributes list
		let tag = ele.getAttribute("href").substring(1),
			attr = Object.keys(tags.data[tag]).sort(shared.sort),
			attrCont = document.querySelector("#tags-attributes");
		shared.clear(attrCont);
		for (const i of attr) {
			let a = document.createElement("a");
			attrCont.appendChild(a);
			a.dataset.tag = tag;
			a.dataset.attribute = i;
			a.href = "#";
			if (i === "_all") {
				a.textContent = "alle";
			} else {
				a.textContent = `@${i}`;
			}
			a.addEventListener("click", function(evt) {
				evt.preventDefault();
				tags.listFiles(this);
			});
		}
		// show all blocks
		document.querySelectorAll("#tags .off").forEach(i => i.classList.remove("off"));
		// build files list and show code of first item
		attrCont.firstChild.click();
	},
	// build files list
	//   ele = element (clicked attribute)
	listFiles (ele) {
		// toggle active mark
		document.querySelectorAll("#tags-attributes a").forEach(i => {
			if (i === ele) {
				i.classList.add("active");
			} else {
				i.classList.remove("active");
			}
		});
		// build file list
		let files = tags.data[ele.dataset.tag][ele.dataset.attribute].sort(shared.sort),
			navCont = document.querySelector("#tags-nav span");
		shared.clear(navCont);
		for (let i = 0, len = files.length; i < len; i++) {
			let a = document.createElement("a");
			navCont.appendChild(a);
			a.href = "#" + files[i];
			a.textContent = i + 1;
			a.addEventListener("click", function(evt) {
				evt.preventDefault();
				tags.showSummary(this);
			});
		}
		// show code of first file in the row
		navCont.firstChild.click();
	},
	// resources/wortgeschichten-teaser-xml.xsl
	showSummaryXsl: "",
	// show summary code
	//   ele = element
	async showSummary (ele) {
		// toggle active mark
		document.querySelectorAll("#tags-nav span a").forEach(i => {
			if (i === ele) {
				i.classList.add("active");
			} else {
				i.classList.remove("active");
			}
		});
		let cont = document.querySelector("#tags-nav span"),
			left = -1;
		if (ele.offsetLeft - cont.scrollLeft > cont.offsetWidth * 0.8) {
			left = cont.scrollLeft + Math.round(cont.offsetWidth * 0.7);
		} else if (ele.offsetLeft - cont.scrollLeft < cont.offsetWidth * 0.1) {
			left = cont.scrollLeft - Math.round(cont.offsetWidth * 0.7);
		}
		if (left >= 0) {
			cont.scrollTo({
				top: 0,
				left,
				behavior: "smooth",
			});
		}
		// load XSL (if needed)
		const result = await app.loadXsl({
			obj: tags,
			key: "showSummaryXsl",
			xsl: "wortgeschichten-teaser-xml.xsl",
		});
		if (!result) {
			return;
		}
		// extract summary
		const file = ele.getAttribute("href").substring(1),
			doc = new DOMParser().parseFromString(xml.files[file], "text/xml"),
			xslt = new DOMParser().parseFromString(tags.showSummaryXsl, "application/xml"),
			processor = new XSLTProcessor();
		processor.importStylesheet(xslt);
		const processedDoc = processor.transformToDocument(doc);
		// prepare highlighting
		let regExp = [],
			attr = document.querySelector("#tags-attributes .active");
		regExp.push({
			high: new RegExp(`&lt;${attr.dataset.tag}(?= |&gt;)`, "g"),
			termN: 0,
		});
		if (attr.dataset.attribute !== "_all") {
			regExp.push({
				high: new RegExp(`${attr.dataset.attribute}=(<.+?>){2}&quot;.+?&quot;`, "g"),
				termN: 1,
			});
		}
		// print result
		document.querySelector("#tags-label").textContent = file;
		let code = processedDoc.querySelector("Wortgeschichte_kompakt").innerHTML.trim();
		code = code.replace(/ xmlns=".+?"/, "");
		code = code.replace(/^\s*\n/gm, "");
		code = code.replace(/^ {6}/gm, "");
		code = viewSearch.textMaskChars(code);
		code = viewSearch.textColorCode(code);
		code = viewSearch.textHighlight(code, regExp);
		document.querySelector("#tags-code").innerHTML = code.text;
	},
	// navigate through the results
	//   forward = boolean
	showSummaryNav (forward) {
		let files = document.querySelectorAll("#tags-nav span a"),
			active = -1;
		for (let i = 0, len = files.length; i < len; i++) {
			if (files[i].classList.contains("active")) {
				active = i;
				break;
			}
		}
		if (forward) {
			active++;
		} else {
			active--;
		}
		if (active === -1 || active === files.length) {
			return;
		}
		files[active].click();
	},
};
