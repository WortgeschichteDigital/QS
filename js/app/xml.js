"use strict";

let xml = {
	// XML file data
	//   branch             = ""  master | preprint
	//   date               = ""  date of analysis, full ISO date: YYYY-MM-DDTHH:MM:SS.MMMM
	//   files              = {}
	//     [FILENAME.xml]   = {}
	//       authors        = []  article authors
	//       diasys         = []  diasystemic information
	//         category     = ""
	//         value        = ""
	//         lemma        = ""  "hl" this value pertains to
	//       dir            = ""  articles | ignore
	//       domains        = []  topic domains of this article
	//       fa             = |   article is field article
	//       first          = {}  dates of first lemma quotation
	//         [LEMMA]      = 1   lemma as in "hl" and "nl", integers:
	//                              4 digits = year
	//                              2 digits = century
	//                              0        = unknown (no quotation for this lemma)
	//       hash           = ""  SHA1 hash, derived from file content ("xml")
	//       hints          = []  all hints regarding this file
	//         ident        = ""  identifier hash (10 hex digits, not in every case unique)
	//         line         = 1   line number
	//         linkCount    = 1   link count, > 0 means: 'there are already links to the proposed destination';
	//                              the analysis is limited to the current block (i.e. <Wortgeschichte> etc.)
	//         scope        = ""  Artikel | Bedeutungsgerüst | Kurz gefasst | Literatur | Verweise | Wortgeschichte
	//         textErr      = []  text that triggered the hint (second slot might give helpful context info)
	//         textHint     = []  proposal into which "textErr" should be changed
	//           copy       = |   enable simple copy for this text
	//           text       = ""  text of proposal
	//         type         = ""  hint type; available types
	//                              article_id        = correct article ID
	//                              article_file      = correct file name
	//                              diasystemic_value = add diasystemic value
	//                              link_error        = correct internal link
	//                              literature_error  = correct literature title
	//                              semantic_type     = add semantic type
	//       hl             = []  //Artikel/Lemma[@Typ = "Hauptlemma"]/Schreibung;
	//                              field articles have the string " (Wortfeld)" attached to them
	//       hlJoined       = []  same as "hl", but Schreibung is joined with a slash as separator
	//       id             = ""  //Artikel/@xml:id
	//       links          = []  //Verweis
	//         lemma        = {}  lemma the link points to
	//           file       = ""  FILENAME.xml
	//           spelling   = ""  spelling of the lemma as in "hl" or "nl"
	//         line         = 1   line number
	//         points       = 1   cluster points for this link
	//         scope        = ""  Kurz gefasst | Verweise | Wortgeschichte
	//         type         = []  semantic types attached to this link
	//         verweisziel  = ""  original content of //Verweis/Verweisziel
	//       name           = ""  article name with all lemmas and the attached " (Wortfeld)" if applicable
	//       published      = ""  date the article was published (YYYY-MM-DD),
	//                              derived fromt the first occurence of //Revision/Datum
	//       nl             = []  //Artikel/Lemma[@Typ = "Nebenlemma"]/Schreibung
	//       nlJoined       = []  same as "nl", but Schreibung is joined with a slash as separator
	//       nlTargets      = {}  each slot in "nl" is a key in "nlTargets"
	//         [NEBENLEMMA] = ""  //Artikel/Lemma[@Typ = "Nebenlemma"]/Textreferenz/@Ziel
	//       status         = 1   file status
	//                              0 = file is known and unchanged
	//                              1 = file is known, but changed
	//                              2 = file is new, which either means the file is located in "ignore"
	//                                  and there is no file in "articles" or the file is untracked by Git
	//       targets        = []  //Wortgeschichte//*/@xml:id
	data: {
		branch: "",
		date: "",
		files: {},
	},
	// XML file content
	//   [FILENAME.xml] = string (complete XML file)
	files: {},
	// contents of data.json with Zeitstrahl data (see preferences "Externe Daten"); important keys:
	//   zeitstrahl.lemmas
	//     [LEMMA|XML-ID] = {}
	//       spelling     = ""  spelling of the lemma
	//       xml          = ""  xml file name
	//       year         = 1   date of first lemma quotation
	//                            4 digits = year
	//                            2 digits = century
	//                            0        = unknown (no quotation for this lemma)
	zeitstrahl: {},
	// fill file data
	//   updated = array (names of files to be updated)
	async fillData (updated) {
		const errors = [];
		for (const file of updated) {
			const doc = new DOMParser().parseFromString(xml.files[file], "text/xml");
			// XML not well-formed
			if (doc.querySelector("parsererror")) {
				errors.push({
					file,
					err: "XML not well-formed",
				});
				continue;
			}
			// parse file
			// (assume that authors try to parse invalid XML files;
			// therefore, let's wrap it all in a try block)
			let d = xml.data.files[file];
			try {
				// authors
				d.authors = [];
				doc.querySelectorAll("Revision Autor").forEach(i => {
					const text = i.textContent;
					if (!d.authors.includes(text)) {
						d.authors.push(text);
					}
				});
				// field
				d.fa = doc.querySelector('Artikel[Typ="Wortfeldartikel"]') ? true : false;
				// main lemmas
				d.hl = [];
				d.hlJoined = [];
				doc.querySelectorAll('Artikel > Lemma[Typ="Hauptlemma"]').forEach(i => {
					let schreibungen = [];
					i.querySelectorAll("Schreibung").forEach(s => {
						schreibungen.push(s.textContent);
					});
					if (d.fa) {
						schreibungen[0] = schreibungen[0] + " (Wortfeld)";
					}
					d.hl = d.hl.concat(schreibungen);
					d.hlJoined.push(schreibungen.join("/"));
				});
				// sub lemmas
				d.nl = [];
				d.nlJoined = [];
				d.nlTargets = {};
				doc.querySelectorAll('Artikel > Lemma[Typ="Nebenlemma"]').forEach(i => {
					let schreibungen = [];
					i.querySelectorAll("Schreibung").forEach(s => {
						schreibungen.push(s.textContent);
					});
					d.nl = d.nl.concat(schreibungen);
					d.nlJoined.push(schreibungen.join("/"));
					// ascertain target
					const target = i.querySelector("Textreferenz").getAttribute("Ziel");
					for (const s of schreibungen) {
						d.nlTargets[s] = target;
					}
				});
				// diasystemic information
				d.diasys = [];
				let lemma = d.hl[0];
				doc.querySelectorAll("Lesarten").forEach(l => {
					const schreibung = l.querySelectorAll("Lemma Schreibung")?.textContent;
					if (schreibung) {
						lemma = schreibung;
					}
					l.querySelectorAll("Diasystematik > *").forEach(i => {
						d.diasys.push({
							category: i.nodeName,
							value: i.textContent,
							lemma,
						});
					});
				});
				// topic domains
				d.domains = [];
				doc.querySelectorAll("Artikel > Diasystematik Themenfeld").forEach(i => {
					d.domains.push(i.textContent);
				});
				// first lemma quotation
				d.first = {};
				for (const lemma of d.hl.concat(d.nl)) {
					let year = 0;
					if (xml.zeitstrahl.lemmas) {
						for (const v of Object.values(xml.zeitstrahl.lemmas)) {
							if (v.xml === file && v.spelling === lemma) {
								year = v.year;
								break;
							}
						}
					}
					d.first[lemma] = year;
				}
				// create array for hints
				// (filled in hints.glean())
				d.hints = [];
				// file ID
				d.id = doc.querySelector("Artikel").getAttribute("xml:id");
				// collect all links
				d.links = [];
				doc.querySelectorAll("Verweis").forEach(i => {
					const verweisziel = i.querySelector("Verweisziel").textContent,
						scopePoints = xml.getScopePoints(i, d.fa);
					d.links.push({
						lemma: {},
						line: xml.getLineNumber(i, doc, xml.files[file]),
						points: scopePoints.points,
						scope: scopePoints.scope,
						type: i?.getAttribute("Typ")?.split(" ") || [],
						verweisziel,
					});
				});
				// article name
				d.name = d.hlJoined.join(", ");
				if (d.nlJoined.length) {
					d.name += ` (${d.nlJoined.join(", ")})`;
				}
				// publication date
				const published = doc.querySelector("Revision Datum").textContent.split(".");
				d.published = published[2] + "-" + published[1] + "-" + published[0];
				// all possibile targets within the article
				d.targets = [];
				doc.querySelectorAll("Wortgeschichte *").forEach(i => {
					const id = i.getAttribute("xml:id");
					if (id) {
						d.targets.push(id);
					}
				});
			} catch (err) {
				errors.push({
					file,
					err: err.message,
				});
			}
		}
		// fill "lemma" in all links
		for (const values of Object.values(xml.data.files)) {
			if (!values.links) {
				// in case an XML file could not be read due to a "not well-formed" error
				continue;
			}
			for (const link of values.links) {
				const lemma = xml.getLemma(link.verweisziel);
				link.lemma = lemma;
			}
		}
		// display errors if any
		if (errors.length) {
			let errorList = [];
			for (const i of errors) {
				delete xml.data.files[i.file];
				delete xml.files[i.file];
				errorList.push(`• <i>${i.file}:</i> ${shared.errorString(i.err.replace(/\n/g, " "))}`);
			}
			dialog.open({
				type: "alert",
				text: `${errors.length === 1 ? "Es ist ein" : "Es sind"} <b class="warn">Fehler</b> aufgetreten!\n${errorList.join("<br>")}`,
			});
		}
	},
	// determine scope and cluster points of the given link
	//   link = element
	//   fa = boolean (article is a field article)
	getScopePoints (link, fa) {
		if (link.closest("Anmerkung") ||
				link.closest("Abschnitt") &&
				link.closest("Abschnitt").getAttribute("Relevanz") === "niedrig") {
			// footnote or learn more (Mehr erfahren)
			return {
				points: 1,
				scope: "Wortgeschichte",
			};
		} else if (link.closest("Wortgeschichte")) {
			// continuous text (base value)
			return {
				points: 2,
				scope: "Wortgeschichte",
			};
		} else if (link.closest("Wortgeschichte_kompakt")) {
			// summary (Kurz gefasst)
			return {
				points: 3,
				scope: "Kurz gefasst",
			};
		} else if (link.closest("Verweise")) {
			if (fa) {
				// field article
				return {
					points: 10,
					scope: "Verweise",
				};
			}
			// structured reference list
			return {
				points: 3,
				scope: "Verweise",
			};
		}
		// this should never happen
		return {
			points: 0,
			scope: "",
		};
	},
	// get the actual lemma a <Verweisziel> points to
	//   vz = string (contents of <Verweisziel>)
	//   data = object (article data)
	getLemma (vz) {
		let lemma = vz.split("#")[0],
			hash = vz.split("#")[1] || "";
		if (/^Wortfeld-/.test(lemma)) {
			lemma = lemma.replace(/^Wortfeld-/, "");
			lemma += " (Wortfeld)";
		}
		for (const [file, values] of Object.entries(xml.data.files)) {
			if (values.nl.includes(lemma)) {
				// erroneous usage of sub lemma as link target
				return {
					file,
					spelling: lemma,
				};
			} else if (values.hl.includes(lemma)) {
				if (hash) {
					// the link might point to a sub lemma
					for (const [nl, target] of Object.entries(values.nlTargets)) {
						if (target === hash) {
							lemma = nl;
							break;
						}
					}
				}
				return {
					file,
					spelling: lemma,
				};
			}
		}
		// this can happen when the user wrote an unresolvable <Verweisziel>
		return {
			file: "",
			spelling: "",
		};
	},
	// get line number of current element
	//   ele = element
	//   doc = document (parsed XML file)
	//   file = string (unparsed XML file)
	getLineNumber (ele, doc, file) {
		// erase comments but retain the line breaks
		// (tags of the searched type can be located within a comment
		// which would produce bogus line counts)
		file = file.replace(/<!--.+?-->/gs, m => {
			const n = m.match(/\n/g);
			if (n) {
				return "\n".repeat(n.length);
			}
			return "";
		});
		// search line number
		let tag = ele.nodeName,
			nodes = doc.getElementsByTagName(tag),
			hitIdx = 0;
		for (let i = 0, len = nodes.length; i < len; i++) {
			if (nodes[i] === ele) {
				hitIdx = i;
				break;
			}
		}
		let reg = new RegExp(`<${tag}(?=[ >])`, "g"),
			offset = 0;
		for (let i = 0; i <= hitIdx; i++) {
			offset = reg.exec(file).index;
		}
		return file.substring(0, offset).split("\n").length;
	},
	// load cache file
	async loadCache () {
		let json;
		try {
			const path = shared.path.join(shared.info.userData, `xml-cache-${xml.data.branch}.json`);
			json = JSON.parse(await shared.fsp.readFile(path, { encoding: "utf8" }));
		} catch {
			// the cache file might not exist yet
			return;
		}
		xml.data = json;
	},
	// write cache file
	async writeCache () {
		const path = shared.path.join(shared.info.userData, `xml-cache-${xml.data.branch}.json`);
		try {
			await shared.fsp.writeFile(path, JSON.stringify(xml.data));
		} catch (err) {
			shared.error(`${err.name}: ${err.message}`);
		}
	},
	// remove cache files and rebuild xml data
	//   active = true | undefined (clear was initiated by user)
	async resetCache (active = false) {
		await xml.updateWait();
		xml.updating = true;
		// remove cache files
		for (const branch of ["master", "preprint"]) {
			const path = shared.path.join(shared.info.userData, `xml-cache-${branch}.json`),
				exists = await shared.ipc.invoke("exists", path);
			if (!exists) {
				continue;
			}
			try {
				await shared.fsp.unlink(path);
			} catch {}
		}
		// reset variables
		xml.data.files = {};
		xml.files = {};
		// start update operation
		await xml.update();
		if (active) {
			dialog.open({
				type: "alert",
				text: "Der Cache wurde geleert und für den aktuellen Branch neu aufgebaut.",
			});
		}
	},
	// execute update operation
	//   xmlFiles = object | undefined (filled in case a file is requested by a preview window)
	async update (xmlFiles = null) {
		xml.updating = true;
		const update = document.querySelector("#fun-update");
		if (update.classList.contains("active")) {
			return;
		}
		// animate button
		update.classList.add("active");
		const img = update.firstChild;
		img.src = "img/app/view-refresh.svg";
		img.classList.add("rotate");
		// detect current branch & update header if necessary
		const branch = await git.branchCurrentPrint();
		if (xml.data.branch !== branch) {
			xml.data.branch = branch;
			await xml.loadCache();
		}
		// get XML files
		let files = xmlFiles || await shared.ipc.invoke("xml-files", git.config.dir),
			updated = [];
		for (const [k, v] of Object.entries(files)) {
			// save file content
			xml.files[k] = v.xml;
			// update file data?
			if (xml.data.files?.[k]?.hash !== v.hash) {
				updated.push(k);
				xml.data.files[k] = {};
				for (const [key, val] of Object.entries(v)) {
					if (key === "xml") {
						continue;
					}
					xml.data.files[k][key] = val;
				}
			}
		}
		// remove files that don't exist anymore from data objects
		let removedFiles = false; // some files were removed => update all hints
		if (!xmlFiles) { // don't remove any file in case only some files were received
			for (const file of Object.keys(xml.data.files)) {
				if (!files[file]) {
					removedFiles = true;
					delete xml.data.files[file];
					if (xml.files[file]) {
						delete xml.files[file];
					}
				}
			}
		}
		// detect changed and untracked files
		let changed = await git.commandExec("git ls-files --modified");
		if (changed === false) {
			reset();
			return;
		}
		changed = changed.split("\n");
		let untracked = await git.commandExec("git ls-files --others --exclude-standard");
		if (untracked === false) {
			reset();
			return;
		}
		untracked = untracked.split("\n");
		for (let file of changed.concat(untracked)) {
			if (!/^articles\//.test(file)) {
				continue;
			}
			const name = file.split("/")[1].trim();
			if (xml.data.files[name]) {
				// deleted files appear as changed
				xml.data.files[name].status = changed.includes(file) ? 1 : 2;
			}
		}
		// analyze new files
		if (updated.length) {
			await xml.fillData(updated);
		}
		// glean hints & save data to cache file
		await hints.glean(); // TEST TODO EX
		if (updated.length || removedFiles) {
			// await hints.glean(); TODO ON
			xml.data.date = new Date().toISOString();
			await xml.writeCache();
		}
		// update list of possible filter values
		bars.filtersUpdate();
		// update current view
		app.populateView();
		// reset button
		reset();
		function reset () {
			update.classList.remove("active");
			img.src = "img/app/view-refresh-white.svg";
			img.classList.remove("rotate");
			xml.updating = false;
		}
	},
	// update procedure is running
	updating: false,
	// assisting function to stall operations while the update procdure is still running
	async updateWait () {
		if (!xml.updating) {
			return;
		}
		await new Promise(resolve => {
			const interval = setInterval(() => {
				if (!xml.updating) {
					clearInterval(interval);
					resolve(true);
				}
			}, 25);
		});
	},
};
