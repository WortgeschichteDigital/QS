"use strict";

let viewXml = {
	// populate the view
	//   type = string ("switched": view switched | "updated": XML files updated)
	async populate (type) {
		await xml.updateWait();
		if (app.view !== "xml") {
			return;
		}
		app.resetViewScrollTop(type);
		// glean data
		let data = [];
		for (const [file, values] of Object.entries(xml.data.files)) {
			data.push({
				authors: values.authors,
				dir: values.dir,
				domains: values.domains,
				file,
				path: values.dir + "/" + file,
				published: values.published,
				status: "" + values.status,
			});
		}
		// filter data
		const dataF = bars.getFiltersData(),
			dataS = app.getSortingData(), // ascending = boolean, ignore = boolean, type = alpha | time
			regPath = new RegExp(shared.escapeRegExp(dataS.filter), "i");
		for (let i = data.length - 1; i >= 0; i--) {
			if (dataF["select-authors"] && !data[i].authors.includes(dataF["select-authors"]) ||
					dataF["select-domains"] && !data[i].domains.includes(dataF["select-domains"]) ||
					dataF["select-status"] && data[i].status !== dataF["select-status"] ||
					!regPath.test(data[i].path)) {
				data.splice(i, 1);
			}
		}
		// sort data
		const sortingDir = dataS.ascending ? [-1, 1] : [1, -1];
		data.sort((a, b) => {
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
		// make table
		const statusIcons = [
			{
				icon: "status-unchanged.svg",
				title: "Datei unverändert",
			},
			{
				icon: "status-changed.svg",
				title: "Datei geändert",
			},
			{
				icon: "status-untracked.svg",
				title: "Datei neu",
			},
		];
		const teaserOpen = [
			{
				event: "Teaser",
				icon: "preview.svg",
				title: "Teaser anzeigen",
			},
			{
				event: "Open",
				icon: "open-file.svg",
				title: "Datei im Editor öffnen",
			},
		];
		let tab = document.createElement("table");
		for (const i of data) {
			let tr = document.createElement("tr");
			tab.appendChild(tr);
			tr.dataset.file = i.file;
			tr.dataset.status = i.status;
			// status
			let status = document.createElement("td");
			tr.appendChild(status);
			let statusImg = document.createElement("img");
			status.appendChild(statusImg);
			statusImg.src = `img/app/${statusIcons[i.status].icon}`;
			statusImg.width = "30";
			statusImg.height = "30";
			statusImg.alt = "";
			statusImg.title = statusIcons[i.status].title;
			// file
			let file = document.createElement("td");
			tr.appendChild(file);
			let pv = document.createElement("a");
			file.appendChild(pv);
			pv.dataset.event = "Pv";
			pv.href = "#";
			pv.title = "Datei in der Vorschau öffnen";
			let pvDir = document.createElement("span");
			pv.appendChild(pvDir);
			pvDir.textContent = i.dir + "/";
			pv.appendChild(document.createTextNode(i.file));
			// time
			if (dataS.type === "time") {
				let td = document.createElement("td");
				tr.appendChild(td);
				td.classList.add("time");
				const published = i.published.split("-");
				td.textContent = `${published[2]}.\u00A0${published[1]}.\u00A0${published[0]}`;
			}
			// teaser & open
			for (let j = 0; j < 2; j++) {
				let td = document.createElement("td");
				tr.appendChild(td);
				let a = document.createElement("a");
				td.appendChild(a);
				a.classList.add("icon");
				a.dataset.event = teaserOpen[j].event;
				a.href = "#";
				a.title = teaserOpen[j].title;
				let img = document.createElement("img");
				a.appendChild(img);
				img.src = `img/app/${teaserOpen[j].icon}`;
				img.width = "30";
				img.height = "30";
				img.alt = "";
			}
		}
		// add tooltips
		tooltip.init(tab);
		// append events
		tab.querySelectorAll("tr a").forEach(i => {
			i.addEventListener("click", async function(evt) {
				evt.preventDefault();
				await xml.updateWait();
				if (app.view !== "xml") {
					return;
				}
				viewXml["fun" + this.dataset.event](this);
			});
		});
		// print placeholder in case no XML file made it through
		if (!data.length) {
			tab = app.nothingToShow();
		}
		// insert table
		const xmlSec = document.querySelector("#xml");
		xmlSec.replaceChild(tab, xmlSec.firstChild);
	},
	// open file in preview window
	//   a = element (clicked link)
	funPv (a) {
		const tr = a.closest("tr");
		app.openPv(tr.dataset.file);
	},
	// resources/wortgeschichten-teaser.xsl
	funTeaserXsl: "",
	// show teaser
	//   a = element (clicked link)
	async funTeaser (a) {
		// load XSL (if needed)
		const result = await app.loadXsl({
			obj: viewXml,
			key: "funTeaserXsl",
			xsl: "wortgeschichten-teaser.xsl",
		});
		if (!result) {
			return;
		}
		// extract summary (Kurz gefasst)
		const tr = a.closest("tr"),
			file = xml.files[tr.dataset.file];
		if (!file) {
			shared.error(`Dateidaten für „${tr.dataset.file}“ nicht gefunden`);
			return;
		}
		const doc = new DOMParser().parseFromString(file, "text/xml"),
			xslt = new DOMParser().parseFromString(viewXml.funTeaserXsl, "application/xml"),
			processor = new XSLTProcessor();
		processor.importStylesheet(xslt);
		const processedDoc = processor.transformToDocument(doc);
		// collect tags
		let tags = [];
		doc.querySelectorAll("Wortgeschichte_kompakt *").forEach(i => {
			const name = i.nodeName;
			if (!tags.includes(name)) {
				tags.push(name);
			}
		});
		tags.sort(shared.sort);
		// display summary (Kurz gefasst)
		document.querySelector("#summary h1 span").textContent = tr.dataset.file;
		document.querySelector("#summary p").innerHTML = processedDoc.querySelector("p").innerHTML;
		let code = document.querySelector("#summary code");
		shared.clear(code);
		for (const i of tags) {
			if (code.hasChildNodes()) {
				code.appendChild(document.createTextNode(" "));
			}
			code.appendChild(document.createTextNode(`<${i}>`));
		}
		overlay.show("summary");
	},
	// open file in default editor
	//   a = element (clicked link)
	async funOpen (a) {
		const tr = a.closest("tr");
		app.openEditor(tr.dataset.file);
	},
};
