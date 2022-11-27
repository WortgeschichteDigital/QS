"use strict";

let viewXml = {
	// populate the view
	populate () {
		// glean data
		let data = [];
		for (const [file, values] of Object.entries(xml.data.files)) {
			data.push({
				dir: values.dir,
				file,
				published: values.published,
				search: values.dir + "/" + file,
				status: values.status,
			});
		}
		// filter data TODO quick filter + filter bar
		// sort data
		// TODO sort direction + sort by time
		data.sort((a, b) => shared.sort(a.file, b.file));
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
				event: "teaser",
				icon: "preview.svg",
				title: "Teaser anzeigen",
			},
			{
				event: "open",
				icon: "open-file.svg",
				title: "Datei im Editor öffnen",
			},
		];
		let tab = document.createElement("table");
		for (const i of data) {
			let tr = document.createElement("tr");
			tab.appendChild(tr);
			tr.dataset.dir = i.dir;
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
			pv.dataset.event = "pv";
			pv.href = "#";
			pv.title = "Datei in der Vorschau öffnen";
			let pvDir = document.createElement("span");
			pv.appendChild(pvDir);
			pvDir.textContent = i.dir + "/";
			pv.appendChild(document.createTextNode(i.file));
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
			i.addEventListener("click", function(evt) {
				evt.preventDefault();
				viewXml[this.dataset.event](this);
			});
		});
		// insert table
		const xmlTab = document.querySelector("#xml-tab");
		xmlTab.replaceChild(tab, xmlTab.firstChild);
	},
	// open file in preview window
	//   a = element (clicked link)
	pv (a) {
		// TODO
	},
	// resources/wortgeschichten-teaser.xsl
	teaserXSL: "",
	// show teaser
	//   a = element (clicked link)
	async teaser (a) {
		// do I need to load the XSL?
		if (!viewXml.teaserXSL) {
			let resources = process.resourcesPath;
			if (/node_modules/.test(resources)) {
				// app is not packaged => process.resourcesPath is the path to the Electron resources
				resources = resources.replace(/node_modules.+/, "") + "resources";
			}
			try {
				const path = app.path.join(resources, "wortgeschichten-teaser.xsl");
				viewXml.teaserXSL = await app.fsp.readFile(path, { encoding: "utf8" });
			} catch (err) {
				open.dialog({
					type: "alert",
					text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${err.message}`,
				});
				return;
			}
		}
		// extract summary (Kurz gefasst)
		const tr = a.closest("tr"),
			doc = new DOMParser().parseFromString(xml.files[tr.dataset.file], "text/xml"),
			xslt = new DOMParser().parseFromString(viewXml.teaserXSL, "application/xml"),
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
	async open (a) {
		const tr = a.closest("tr"),
			path = app.path.join(git.config.dir, tr.dataset.dir, tr.dataset.file),
			result = await app.shell.openPath(path);
		if (result) {
			dialog.open({
				type: "alert",
				text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${result}`,
			});
		}
	},
};
