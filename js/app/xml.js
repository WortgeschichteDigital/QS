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
	//       dir            = ""  articles | ignore
	//       domains        = []  topic domains of this article
	//       first          = {}  dates of first lemma quotation
	//         [LEMMA]      = 1   lemma as in "hl" and "nl", integers:
	//                              4 digits = year
	//                              2 digits = century
	//                              0        = unknown (no quotation for this lemma)
	//       hash           = ""  SHA1 hash, derived from file content ("xml")
	//       hints          = []  all hints regarding this file
	//         context      = ""  text context of "from"
	//         from         = ""  text that triggered this hint, see "to"
	//         linkCount    = 1   link count, > 0 means: 'there are already links to the proposed destination';
	//                              the analysis is limited to the current block (i.e. <Wortgeschichte> etc.)
	//         line         = 1   line number
	//         scope        = ""  Artikel | Bedeutungsgerüst | Verweise | Wortgeschichte | Kurz gefasst
	//         to           = []  proposition into which "from" should be changed TODO no array!
	//         type         = ""  hint type TODO documentation!
	//       id             = ""  //Artikel/@xml:id
	//       hl             = []  //Artikel/Lemma[@Typ = "Hauptlemma"]/Schreibung;
	//                              field articles have the string " (Wortfeld)" attached to them
	//       hlSlash        = []  same as "hl", but Schreibung is imploded with a slash as separator
	//       links          = []  //Verweis
	//         inVerweise   = |   //Verweis is within //Verweise
	//         lemma        = {}  lemma the link points to
	//           file       = ""  FILENAME.xml
	//           spelling   = ""  spelling of the lemma as in "hl" or "nl"
	//         line         = 1   line number
	//         points       = 1   cluster points for this link
	//         type         = []  semantic types attached to this link
	//         verweisziel  = ""  original content of //Verweis/Verweisziel
	//       name           = ""  imploded file name with all lemmas and the attached " (Wortfeld)" if applicable
	//       status         = 1   file status
	//                              0 = file is known and unchanged
	//                              1 = file is known, but changed
	//                              2 = file is new, which either means the file is located in "ignore"
	//                                  and there is no file in "articles" or the file is untracked by Git
	//       published      = ""  date the article was published (YYYY-MM-DD),
	//                              derived fromt the first occurence of //Revision/Datum
	//       nl             = []  //Artikel/Lemma[@Typ = "Nebenlemma"]/Schreibung
	//       nlSlash        = []  same as "nl", but Schreibung is imploded with a slash as separator
	//       nlTargets      = {}  each slot in "nl" is a key in "nlTargets"
	//         [NEBENLEMMA] = ""  //Artikel/Lemma[@Typ = "Nebenlemma"]/Textreferenz/@Ziel
	//       targets        = []  //Wortgeschichte//*/@xml:id
	//       wfa            = |   article is field article
	//       xml            = ""  complete file content
	data: {
		branch: "",
		date: "",
		files: {},
	},
	// extract basic file data
	//   updated = array (names of update files)
	async fillData (updated) {
		// TODO
	},
	// glean hints
	async hints () {
		// TODO Problem: in alten Dateien, die nicht aufgefrischt wurden, könnten sich Hinweise verstecken, die neue Dateien betreffen => alle hints neu machen
	},
	// load cache file
	async loadCache () {
		const branch = await git.branchCurrent();
		// TODO
	},
	// write cache file
	async writeCache () {
		// TODO
		// remove XML file content temporarily
	},
	// execute update operation
	async update () {
		const update = document.querySelector("#fun-update");
		if (update.classList.contains("active")) {
			return;
		}
		// animate button
		update.classList.add("active");
		const img = update.firstChild;
		img.src = "img/app/view-refresh.svg";
		img.classList.add("rotate");
		// get XML files
		let updated = [];
		const files = await app.ir.invoke("xml-files", git.config.dir);
		for (const [k, v] of Object.entries(files)) {
			if (xml.data.files?.[k]?.hash !== v.hash) {
				updated.push(k);
				xml.data.files[k] = {};
				for (const [key, val] of Object.entries(v)) {
					xml.data.files[k][key] = val;
				}
			}
		}
		// detect current branch
		let branchChanged = false, // branch is changed => write out file data
			removedFiles = false; // some files were removed => update all hints
		const branch = await git.branchCurrent();
		if (xml.data.branch !== branch) {
			branchChanged = true;
			xml.data.branch = branch;
		}
		// remove files that don't exist anymore
		for (const file of Object.keys(xml.data.files)) {
			if (!files[file]) {
				removedFiles = true;
				delete xml.data.files[file];
			}
		}
		// detect changed files
		const changed = await git.commandExec("git ls-files --modified");
		if (changed === false) {
			reset();
			return;
		}
		for (let file of changed.split("\n")) {
			if (!/^articles\//.test(file)) {
				continue;
			}
			file = file.split("/")[1].trim();
			xml.data.files[file].status = 1;
		}
		// detect untracked files
		const untracked = await git.commandExec("git ls-files --others --exclude-standard");
		if (untracked === false) {
			reset();
			return;
		}
		for (let file of untracked.split("\n")) {
			if (!/^articles\//.test(file)) {
				continue;
			}
			file = file.split("/")[1].trim();
			xml.data.files[file].status = 2;
		}
		// analyze new files
		if (updated.length) {
			await xml.fillData(updated);
		}
		// glean hints
		if (update.length || removedFiles) {
			await xml.hints();
		}
		// save cache file and finish up
		if (updated.length || branchChanged || removedFiles) {
			xml.data.date = new Date().toISOString();
			await xml.writeCache();
		}
		// update current view TODO
		// reset button
		reset();
		function reset () {
			update.classList.remove("active");
			img.src = "img/app/view-refresh-white.svg";
			img.classList.remove("rotate");
		}
	},
};
