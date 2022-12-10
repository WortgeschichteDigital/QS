"use strict";

let hints = {
	// glean hints data
	async glean () {
		// purge old hints
		for (const v of Object.values(xml.data.files)) {
			v.hints = [];
		}
		// get external file data
		await new Promise(resolve => {
			Promise.all([
				hints.fillDiasystems(),
				hints.fillLiterature(),
				hints.fillVariants(),
			]).then(() => resolve(true));
		});
		// glean hints data
		hints.parseData();
		hints.parseFiles();
		// clean-up and sorting
		for (const data of Object.values(xml.data.files)) {
			for (let i = data.hints.length - 1; i >= 0; i--) {
				const current = data.hints[i],
					matches = data.hints.filter(x => x.line === current.line && x.ident === current.ident);
				if (matches.length > 1) {
					data.hints.splice(i, 1);
				}
			}
			data.hints.sort((a, b) => {
				if (a.line === b.line &&
						a.type !== b.type) {
					let x = [a.type, b.type];
					x.sort();
					if (x[0] === a.type) {
						return -1;
					}
					return 1;
				}
				return a.line - b.line;
			});
		}
		// TEST TODO EX
		console.log(xml.data.files);
	},
	// SEMANTIC_TYPE: corresponding semantic types
	// ("Cluster" and "Kontext" are excluded)
	semCorrTypes: {
		Gegensatz: "Gegensatz",
		Hyperonym: "Hyponym",
		Hyponym: "Hyperonym",
		Synonym: "Synonym",
	},
	// hints that can be derived from already present file data
	// (no parsing of XML files needed)
	parseData () {
		for (const [file, data] of Object.entries(xml.data.files)) {
			for (const i of data.links) {
				// LINK_ERROR: target not found
				if (!i.lemma.file) {
					hints.add(data.hints, file, {
						line: i.line,
						linkCount: 0,
						scope: i.scope,
						textErr: [`<Verweisziel>${i.verweisziel}</Verweisziel>`],
						textHint: [{
							copy: false,
							text: "Ziel nicht gefunden",
						}],
						type: "link_error",
					});
				}
				// SEMANTIC_TYPE: propose to add semantic types
				else if (i.type.length) {
					// hint for the same article
					const typeJoined = i.type.sort().join(" ");
					for (const x of data.links) {
						if (i.lemma.file === x.lemma.file &&
								i.lemma.spelling === x.lemma.spelling &&
								hints.semCorrTypes[i.type[0]] &&
								typeJoined !== x.type.sort().join(" ")) {
							hints.add(data.hints, file, {
								line: x.line,
								linkCount: 0,
								scope: x.scope,
								textErr: [
									x.type.length ? `<Verweis Typ="${x.type.join(" ")}">` : "[keine Typisierung]",
									`<Verweisziel>${x.verweisziel}</Verweisziel>`,
								],
								textHint: [{
									copy: true,
									text: `Typ="${typeJoined}"`,
								}],
								type: "semantics_type",
							});
						}
					}
					// hint for a corresponding article
					const target = xml.data.files[i.lemma.file];
					if (target.hl.includes(i.lemma.spelling)) { // don't propose semantic types for sub lemmas
						let semCorr = new Set();
						for (const x of i.type) {
							if (hints.semCorrTypes[x]) {
								semCorr.add(hints.semCorrTypes[x]);
							}
						}
						if (semCorr.size) { // size can be 0 as types like "Cluster" have no corresponding type
							for (const x of target.links) {
								if (x.lemma.file === file &&
										data.hl.includes(x.lemma.spelling) &&
										!semCorrCorrect(data.hl, semCorr, x.type)) {
									hints.add(target.hints, i.lemma.file, {
										line: x.line,
										linkCount: 0,
										scope: x.scope,
										textErr: [
											x.type.length ? `<Verweis Typ="${x.type.join(" ")}">` : "[keine Typisierung]",
											`<Verweisziel>${x.verweisziel}</Verweisziel>`,
										],
										textHint: [{
											copy: true,
											text: `Typ="${[...semCorr].sort().join(" ")}"`,
										}],
										type: "semantics_type",
									});
								}
							}
						}
					}
				}
			}
			// ARTICLE_ID: hint erroneous article ID
			let hl = [];
			for (let i of data.hlJoined) {
				i = i.split("/")[0];
				i = i.replace(" (Wortfeld)", "");
				i = i.replace(/[\s’]/g, "_");
				hl.push(i);
			}
			const fa = data.fa ? "Wortfeldartikel_" : "",
				base = `WGd-${fa}${hl.join("-")}-`,
				reg = new RegExp(`^${base}([0-9])$`);
			if (!reg.test(data.id)) {
				let num = "1",
					numMatch = data.id.match(/[0-9]$/);
				if (numMatch) {
					num = numMatch[0];
				}
				hints.add(data.hints, file, {
					line: 3,
					linkCount: 0,
					scope: "Artikel",
					textErr: [data.id],
					textHint: [{
						copy: true,
						text: base + num,
					}],
					type: "article_id",
				});
			}
			// ARTICLE_FILE: hint erroneous file name
			const fileName = articleFileName(fa, hl);
			if (file !== fileName) {
				hints.add(data.hints, file, {
					line: 0,
					linkCount: 0,
					scope: "Artikel",
					textErr: [file],
					textHint: [{
						copy: true,
						text: fileName,
					}],
					type: "article_file",
				});
			}
		}
		// SEMANTIC_TYPE: check whether corresponding semantic types are correct or not
		//   hl = array (main lemmas of current article)
		//   semCorr = set (correlating semantics)
		//   type = array (semantic types in target article)
		function semCorrCorrect (hl, semCorr, type) {
			// in case an article has more than one lemma and the same number of semantic
			// types is required, we may assume that each of the article's main lemmas has
			// a specific lexical relation to the corresponding lemma; therefore one hit is enough;
			// example from "Großbürger/Kleinbürger": "Großbürger" is a synonym to "Bourgeois",
			// but "Kleinbürger" is a contrast to "Bourgeois", therefore in "Bourgois" a link to
			// "Großbürger" or "Kleinbürger" must only contain one of the possible lexical relations
			if (hl.length > 1 && hl.length === semCorr.size) {
				for (const i of type) {
					if (semCorr.has(i)) {
						return true;
					}
				}
			}
			// one hint is also enough in corresponding cases when the link target is a multi lemma article
			// and its links contain more than one semantic type; example: "Bourgeois" links to
			// "Großbürger" or "Kleinbürger" => the lexical relation may be synonym or contrast
			if (type.length > semCorr.size) {
				for (const i of semCorr) {
					if (type.includes(i)) {
						return true;
					}
				}
			}
			// otherwise the semantics should be equal
			if ([...semCorr].sort().join(" ") === type.sort().join(" ")) {
				return true;
			}
			// the semant´ics are not equal => print a proposal
			return false;
		}
		// ARTICLE_FILE: create correct file name
		//   hl = array
		//   fa = string
		function articleFileName (fa, hl) {
			const ascii = new Map([
				[/[\s’']/g, "_"],
				[/Ä/g, "Ae"],
				[/ä/g, "ae"],
				[/[ÈÉ]/g, "E"],
				[/[èé]/g, "e"],
				[/Ö/g, "Oe"],
				[/ö/g, "oe"],
				[/Ü/g, "Ue"],
				[/ü/g, "ue"],
				[/ß/g, "ss"],
			]);
			let name = fa + hl.join("-");
			for (const [k, v] of ascii) {
				name = name.replace(k, v);
			}
			return name += ".xml";
		}
	},
	// parse XML files
	parseFiles () {
		for (const [file, content] of Object.entries(xml.files)) {
			const doc = new DOMParser().parseFromString(content, "text/xml");
			if (doc.querySelector("parsererror")) { // XML not well-formed
				continue;
			}
			hints.checkDiasystems(file, doc);
			hints.checkLiterature(file, doc);
		}
	},
	// DIASYSTEMIC_VALUE
	//   file = string (XML file name)
	//   doc = document
	checkDiasystems (file, doc) {
		for (const lesarten of doc.querySelectorAll("Lesarten")) {
			for (const c of lesarten.childNodes) {
				if (c.nodeName !== "Lesart") {
					continue;
				}
				iterateNodes(c, c, doc, getDiaValues(c));
			}
		}
		function getDiaValues (lesart) {
			let diaValues = {};
			for (const d of lesart.querySelectorAll("Diasystematik")) {
				if (d.closest("Lesart") !== lesart) {
					continue;
				}
				for (const x of d.children) {
					const system = x.nodeName,
						value = x.textContent.trim();
					if (!diaValues[system]) {
						diaValues[system] = new Set();
					}
					diaValues[system].add(value);
				}
			}
			return diaValues;
		}
		function iterateNodes (nodes, lesart, doc, diaValues) {
			for (const n of nodes.childNodes) {
				if (n.nodeType === 1 &&
						n.nodeName === "Lesart") {
					iterateNodes(n, n, doc, getDiaValues(n));
				} else if (n.nodeType === 1 &&
						!/Abkuerzung|Diasystematik|Textreferenz/.test(n.nodeName)) {
					iterateNodes(n, lesart, doc, diaValues);
				} else if (n.nodeType === 3) {
					const text = n.nodeValue.trim();
					if (text) {
						for (const [k, v] of Object.entries(hints.diasystems)) {
							for (const x of v) {
								if (x.test(text) &&
										!diaValues?.[k]?.has(x.source)) {
									diaValues?.[k]?.add(x.source);
									hints.add(xml.data.files[file].hints, file, {
										line: xml.getLineNumber(lesart, doc, xml.files[file]),
										linkCount: 0,
										scope: "Bedeutungsgerüst",
										textErr: [],
										textHint: [{
											copy: false,
											text: k + " > " + x.source,
										}],
										type: "diasystemic_value",
									});
								}
							}
						}
					}
				}
			}
		}
	},
	// LITERATURE_ERROR
	//   file = string (XML file name)
	//   doc = document
	checkLiterature (file, doc) {
		for (const i of doc.querySelectorAll("Literaturtitel")) {
			const id = i.getAttribute("xml:id"),
				ziel = i.getAttribute("Ziel");
			if (!ziel.includes(id)) {
				hints.add(xml.data.files[file].hints, file, {
					line: xml.getLineNumber(i, doc, xml.files[file]),
					linkCount: 0,
					scope: "Literatur",
					textErr: [`<Literaturtitel xml:id="${id}"/>`],
					textHint: [{
						copy: false,
						text: "Tag formal fehlerhaft",
					}],
					type: "literature_error",
				});
			}
			if (!hints.literature.has(id)) {
				hints.add(xml.data.files[file].hints, file, {
					line: xml.getLineNumber(i, doc, xml.files[file]),
					linkCount: 0,
					scope: "Literatur",
					textErr: [`<Literaturtitel xml:id="${id}"/>`],
					textHint: [{
						copy: false,
						text: "Literaturtitel existiert nicht",
					}],
					type: "literature_error",
				});
			}
		}
	},
	// add a hint
	//   arr = array (target)
	//   file = string (XML file name)
	//   obj = object (hints object)
	add (arr, file, obj) {
		let ident = file + obj.type + obj.scope + obj.textErr.join("");
		for (const i of obj.textHint) {
			ident += i.text;
		}
		const hash = shared.crypto.createHash("sha1").update(ident).digest("hex");
		obj.ident = hash.substring(0, 10);
		arr.push(obj);
	},
	// available diasystemic values
	//   [DIASYSTEM] = array (filled with regular expressions)
	diasystems: {},
	async fillDiasystems () {
		// it's better to fill these values every time,
		// in case they were updated while the app was running
		hints.diasystems = {};
		// check whether Diasystematik.rnc exists or not
		const path = shared.path.join(git.config.dir, "share", "rnc", "Diasystematik.rnc"),
			exists = await shared.ipc.invoke("exists", path);
		if (!exists) {
			return false;
		}
		// read systems and values
		const file = await shared.fsp.readFile(path, { encoding: "utf8" }),
			systems = ["Gebrauchszeitraum", "Regiolekt", "Register", "Sachgebiet", "Soziolekt"];
		for (const s of systems) {
			hints.diasystems[s] = [];
			const reg = new RegExp(`${s} = element ${s} \{(.+?)\}`, "s"),
				values = file.match(reg)[0];
			for (const v of values.matchAll(/'(.+?)'/g)) {
				hints.diasystems[s].push(new RegExp(v[1]));
			}
		}
		return true;
	},
	// available literatur titles (IDs)
	literature: new Set(),
	async fillLiterature () {
		// it's better to fill these values every time,
		// in case they were updated while the app was running
		hints.literature = new Set();
		// check whether Literaturliste.xml exists or not
		const path = shared.path.join(git.config.dir, "share", "Literaturliste.xml"),
			exists = await shared.ipc.invoke("exists", path);
		if (!exists) {
			return false;
		}
		// read IDs
		const file = await shared.fsp.readFile(path, { encoding: "utf8" });
		for (const i of file.matchAll(/<Fundstelle xml:id="(.+?)">/g)) {
			hints.literature.add(i[1]);
		}
		return true;
	},
	// spelling variants for lemmas
	//   [WORD] = array (filled with variants)
	variants: {},
	//   [LEMMA] = object
	//     xml   = set (XML file names)
	//     reg   = RegExp
	lemmaVariants: {},
	async fillVariants () {
		// load known variants from cache
		const path = shared.path.join(shared.info.userData, "variants.json");
		if (!Object.keys(hints.variants).length) {
			const exists = await shared.ipc.invoke("exists", path);
			if (exists) {
				const file = await shared.fsp.readFile(path, { encoding: "utf8" });
				hints.variants = JSON.parse(file);
			}
		}
		// it's better to fill these values every time,
		// in case they were updated while the app was running
		hints.lemmaVariants = {};
		// collect words and populate lemma list
		const artBestimmt = ["der", "die", "das", "des", "dem", "den"],
			artUnbestimmt = ["ein", "eine", "eines", "einer", "einem", "einen"],
			noLookup = ["an", "auf", "aus", "bei", "bis", "durch", "für", "gegen", "hinter", "in", "mit", "nach", "neben", "oder", "über", "um", "und", "unter", "von", "vor", "zu", "zwischen"];
		let words = [];
		for (const [file, data] of Object.entries(xml.data.files)) {
			for (let lemma of data.hl.concat(data.nl)) {
				lemma = lemma.replace(" (Wortfeld)", "");
				if (!hints.lemmaVariants[lemma]) {
					hints.lemmaVariants[lemma] = {
						xml: new Set(),
						reg: null,
					};
				}
				hints.lemmaVariants[lemma].xml.add(file);
				for (const word of lemma.split(" ")) {
					if (!hints.variants[word] &&
							!artBestimmt.includes(word) &&
							!artUnbestimmt.includes(word) &&
							!noLookup.includes(word) &&
							!words.includes(word)) {
						words.push(word);
					}
				}
			}
		}
		// download missing variants (chunks of 50 words)
		let save = false;
		for (let i = 0, len = words.length; i < len; i += 50) {
			let lookup = [];
			for (let j = i, len = i + 50; j < len; j++) {
				if (!words[j]) {
					break;
				}
				// no variants for words with apostrophe or single letters
				if (/’/.test(words[j]) ||
						words[j].length === 1) {
					hints.variants[words[j]] = [words[j]];
					save = true;
					continue;
				}
				// other words
				lookup.push(words[j]);
			}
			if (!lookup.length) {
				break;
			}
			// download words
			const data = await shared.fetch(`https://www.deutschestextarchiv.de/demo/cab/query?a=expand.eqlemma&fmt=json&clean=1&pretty=1&raw=1&q=${encodeURIComponent(lookup.join(" "))}`);
			if (!data.ok) {
				continue;
			}
			let json;
			try {
				json = JSON.parse(data.text);
			} catch {
				continue;
			}
			for (const t of json.body[0].tokens) {
				let word = t.text,
					variants = [];
				variants.push(word);
				const wordIsLower = /^[a-zäöü]/.test(word);
				for (const v of t.eqlemma) {
					if (!v.hi) {
						continue;
					}
					const variant = v.hi.trim(),
						variantIsLower = /^[a-zäöü]/.test(variant);
					if (wordIsLower === variantIsLower &&
							!/['-.:,;]/.test(variant) &&
							!variants.includes(variant)) {
						variants.push(variant);
					}
				}
				hints.variants[word] = variants;
				save = true;
			}
		}
		// make RegExp for lemma list
		for (const [lemma, data] of Object.entries(hints.lemmaVariants)) {
			let vari = [];
			for (const word of lemma.split(" ")) {
				if (artBestimmt.includes(word)) {
					vari.push(`(?:${ artBestimmt.join("|") })`);
				} else if (artUnbestimmt.includes(word)) {
					vari.push(`(?:${ artUnbestimmt.join("|") })`);
				} else if (noLookup.includes(word)) {
					vari.push(`${ word }`);
				} else {
					vari.push(`(?:${ hints.variants[word].join("|") })`);
				}
			}
			data.reg = new RegExp(vari.join(" "));
		}
		// save amended variants to cache file
		if (save) {
			try {
				await shared.fsp.writeFile(path, JSON.stringify(hints.variants));
			} catch {}
		}
	},
};
