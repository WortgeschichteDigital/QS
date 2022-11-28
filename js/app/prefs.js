"use strict";

let prefs = {
	// preferences data as received from main
	data: {},
	// initialize preferences
	async init () {
		prefs.data = await app.ir.invoke("prefs");
		for (const [k, v] of Object.entries(prefs.data)) {
			// option not within the preferences overlay
			if (k === "filters") {
				prefs.initFilters();
				continue;
			}
			// option within the preferences overlay
			const ele = document.querySelector(`#prefs-${k}`);
			if (!ele) {
				delete prefs.data[k];
				continue;
			}
			if (ele.type === "text") {
				ele.value = v;
			}
		}
		// read Zeitstrahl data if file path present
		if (prefs.data.zeitstrahl) {
			await prefs.zeitstrahlRead(prefs.data.zeitstrahl);
		}
	},
	// initialize filter options
	initFilters () {
		for (const [k, v] of Object.entries(prefs.data.filters)) {
			if (k === "barVisible" && v) {
				document.querySelector("#fun-filters").click();
			}
		}
	},
	// save preferences data
	save () {
		// fill in filter data
		prefs.data.filters = {
			barVisible: document.querySelector("#fun-filters").classList.contains("active"),
		};
		// save preferences
		app.ir.invoke("prefs-save", prefs.data);
	},
	// change section
	//   a = element (toc item)
	changeSection (a) {
		if (a.classList.contains("active")) {
			return;
		}
		const toc = document.querySelectorAll("li a");
		for (const i of toc) {
			if (i === a) {
				i.classList.add("active");
			} else {
				i.classList.remove("active");
			}
		}
		const sections = document.querySelectorAll(".prefs-section"),
			show = "prefs-" + a.getAttribute("href").substring(1);
		for (const i of sections) {
			if (i.id === show) {
				i.classList.remove("off");
			} else {
				i.classList.add("off");
			}
		}
	},
	// choose data.json for Zeitstrahl
	async zeitstrahlOpen () {
		const options = {
			title: "Zeitstrahldatei auswählen",
			defaultPath: app.info.documents,
			filters: [
				{
					name: "JSON",
					extensions: ["json"],
				},
			],
			properties: [
				"openFile",
			],
		};
		const result = await app.ir.invoke("file-dialog", true, options);
		if (result.canceld || !result?.filePaths?.length) {
			return;
		}
		const path = result.filePaths[0],
			read = await prefs.zeitstrahlRead(path, false);
		if (!read) {
			return;
		}
		document.querySelector("#prefs-zeitstrahl").value = path;
		prefs.data.zeitstrahl = path;
		prefs.save();
	},
	// read Zeistrahl data from data file
	//   path = string
	//   passive = false | undefined
	async zeitstrahlRead (path, passive = true) {
		let content;
		try {
			content = await app.fsp.readFile(path, { encoding: "utf8" });
		} catch {
			return false;
		}
		let zsData;
		try {
			zsData = JSON.parse(content);
		} catch (err) {
			if (!passive) {
				dialog.open({
					type: "alert",
					text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${err.message}`,
				});
			}
			return false;
		}
		if (!zsData.fields || !zsData.lemmas) {
			if (!passive) {
				dialog.open({
					type: "alert",
					text: 'Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>Die Datei enthält keine Zeitstrahldaten.',
				});
			}
			return false;
		}
		xml.zeitstrahl = zsData;
		if (!passive) {
			xml.resetCache();
		}
		return true;
	},
	zeitstrahlRemove () {
		if (!prefs.data.zeitstrahl) {
			return;
		}
		document.querySelector("#prefs-zeitstrahl").value = "";
		delete prefs.data.zeitstrahl;
		prefs.save();
		xml.zeitstrahl = {};
		xml.resetCache();
	},
};
