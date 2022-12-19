"use strict";

let viewClusters = {
	// last content state of this view
	contentState: {
		filterState: "", // hash
		xmlDate: "", // date of last XML update
	},
	// clusters data
	// structure cluster objects:
	//   [DOMAIN]    = array (each slot contains an object with the keys "z", "s", "u")
	//     [CIRCLE]  = object
	//       file   = string (XML file name)
	//       points = integer
	data: {
		active: "repo",
		idx: [], // indices of clusters to show in the sections "compare" and "check"
		repo: {}, // clusters as they appear in the file Artikel.json (lemmas in written form)
		preview: {}, // newly calculated clusters (lemmas in written form)
	},
	// currently active filters
	filters: {},
	// saves the sections' scroll position
	scrollPos: {},
	// update the view
	//   type = string (switched | updated)
	async update (type) {
		// get current content state
		// (restore scroll position in case the state is unchanged)
		const filterState = app.getFilterState();
		if (filterState === viewClusters.contentState.filterState &&
				xml.data.date === viewClusters.contentState.xmlDate) {
			app.resetViewScrollTop(type);
			viewClusters.focusSearchField();
			return;
		}
		viewClusters.contentState.filterState = filterState;
		viewClusters.contentState.xmlDate = xml.data.date;
		if (filterState === viewClusters.contentState.filterState) {
			app.resetViewScrollTop(type);
		} else {
			window.scrollTo(0, 0);
		}
		// load Artikel.json from repository
		if (!Object.keys(viewClusters.data.repo).length) {
			await viewClusters.loadArtikelJSON();
		}
		// update domain
		viewClusters.filters = bars.getFiltersData();
		const domain = document.querySelector("#clusters-nav-domain");
		domain.textContent = viewClusters.filters["select-domains"] || "kein Themenfeld";
		if (viewClusters.filters["select-domains"]) {
			domain.classList.remove("no-domain");
		} else {
			domain.classList.add("no-domain");
		}
		// collect indices of relevant clusters,
		// check filters,
		// update the section views
		const result = viewClusters.checkFilters();
		if (result.ok) {
			// okay => build view
			clustersCheck.build();
			clustersComp.build();
		} else {
			// not okay => print message
			for (const i of ["compare", "check"]) {
				let sect = document.querySelector(`#clusters-${i}`);
				shared.clear(sect);
				sect.appendChild(result.message.cloneNode(true));
			}
		}
		clustersMod.update();
		// focus search field in modulation section
		viewClusters.focusSearchField();
	},
	// focus search field in modulation section
	focusSearchField () {
		if (!document.querySelector("#clusters-modulate.off")) {
			document.querySelector("#clusters-modulate-search").select();
		}
	},
	// switch cluster sections
	//   icon = node
	switchSection (icon) {
		// no need to switch the section
		if (icon.classList.contains("active")) {
			return;
		}
		// switch section
		let oldSection = "",
			newSection = icon.id.replace(/.+-/, ""),
			id = "clusters-" + newSection,
			scrollY = window.scrollY; // current scroll position
		document.querySelectorAll("#clusters > div").forEach(i => {
			if (!i.classList.contains("off")) {
				oldSection = i.id.replace(/.+-/, "");
				viewClusters.scrollPos[oldSection] = scrollY;
			}
			if (i.id === id) {
				i.classList.remove("off");
			} else {
				i.classList.add("off");
			}
		});
		// switch active icon
		document.querySelector(".clusters-view.active").classList.remove("active");
		icon.classList.add("active");
		// reset scroll position
		if (typeof viewClusters.scrollPos[newSection] !== "undefined") {
			window.scrollTo(0, viewClusters.scrollPos[newSection]);
		} else {
			window.scrollTo(0, 0);
		}
		// update add images in comparison section
		if (newSection === "compare" &&
				oldSection === "modulate") {
			clustersComp.adaptToModulate();
		}
		// focus search field in modulation section
		viewClusters.focusSearchField();
	},
	// collect indices of relevant clusters and check filters:
	// - Is a domain selected?
	// - Are there any clusters for this domain?
	// - Are there any clusters for the selected author?
	checkFilters () {
		let data = viewClusters.data,
			filters = viewClusters.filters,
			error = "";
		data.idx.length = 0;
		if (!filters["select-domains"]) {
			error = "Für diese Funktion müssen Sie ein Themenfeld einstellen.";
		} else if (!data[data.active][filters["select-domains"]]?.length) {
			error = `Zum Themenfeld <i>${filters["select-domains"]}</i> gibt es noch keine Cluster.`;
		} else if (filters["select-authors"]) {
			let clusterFound = false;
			for (let i = 0, len = data[data.active][filters["select-domains"]].length; i < len; i++) {
				const cluster = data[data.active][filters["select-domains"]][i];
				for (const values of Object.values(cluster.z)) {
					if (xml.data.files[values.file].authors.includes(filters["select-authors"])) {
						clusterFound = true;
						data.idx.push(i);
						break;
					}
				}
			}
			if (!clusterFound) {
				error = `Keine Cluster von <i>${filters["select-authors"]}</i> gefunden.`;
			}
		} else {
			for (let i = 0, len = data[data.active][filters["select-domains"]].length; i < len; i++) {
				data.idx.push(i);
			}
		}
		if (error) {
			return {
				ok: false,
				message: app.nothingToShow("Filter anpassen!", error),
			};
		}
		return {
			ok: true,
		};
	},
	// load the file Artikel.json from the repo
	async loadArtikelJSON () {
		// load file
		let path = shared.path.join(git.config.dir, "resources", "Artikel.json"),
			content;
		try {
			content = await shared.fsp.readFile(path, { encoding: "utf8" });
		} catch (err) {
			shared.error(`${err.name}: ${err.message} (${shared.reduceErrorStack(err.stack)})`);
			return;
		}
		// parse data
		let data;
		try {
			data = JSON.parse(content);
		} catch (err) {
			shared.error(`${err.name}: ${err.message} (${shared.reduceErrorStack(err.stack)})`);
			return;
		}
		// extract clusters
		let dr = viewClusters.data.repo,
			fileCache = {};
		for (const [domain, clusters] of Object.entries(data.clusters)) {
			dr[domain] = [];
			for (const cluster of clusters) {
				let cl = {
					z: {},
					s: {},
					u: {},
				};
				dr[domain].push(cl);
				for (const circle of ["z", "s", "u"]) {
					for (const [lemma, points] of Object.entries(cluster[circle])) {
						let spelling = data.values.le[lemma.substring(1)];
						if (/^(Lebensformen|sozialräumliche Segregation)$/.test(spelling)) {
							// TODO eraser later (temporary fix for old lemma values)
							spelling += " (Wortfeld)";
						}
						if (fileCache[spelling]) {
							cl[circle][spelling] = {
								file: fileCache[spelling],
								points,
							};
						} else {
							for (const [file, values] of Object.entries(xml.data.files)) {
								if (values.hlJoined.includes(spelling) ||
										values.nlJoined.includes(spelling)) {
									cl[circle][spelling] = {
										file,
										points,
									};
									fileCache[spelling] = file;
									break;
								}
							}
						}
					}
				}
			}
		}
	},
	// build a cluster block
	//   idx = number
	//   checkModulate = true | undefined
	//   markLemma = string | undefined
	buildCluster ({ idx, checkModulate = false, markLemma = "", }) {
		const data = viewClusters.data,
			cluster = data[data.active][viewClusters.filters["select-domains"]][idx];
		let cont = document.createElement("div");
		cont.classList.add("cluster");
		// Are there any dominant lemmas?
		let weights = [];
		for (const i of Object.values(cluster.z)) {
			weights.push(i.points);
		}
		let dominanceThreshold = Math.ceil(weights[0] / 10);
		if (dominanceThreshold < 3) {
			dominanceThreshold = 3;
		}
		let dominanceArtExist = false;
		for (let j = 1, len = weights.length; j < len; j++) {
			if (weights[j] <= weights[0] - dominanceThreshold &&
					weights[0] - weights[j] >= 3) {
				dominanceArtExist = true;
				break;
			}
		}
		// periphery
		let periphery;
		if (Object.keys(cluster.u).length) {
			periphery = document.createElement("div");
			cont.appendChild(periphery);
			periphery.classList.add("cluster-periphery", "cluster-circle");
		}
		// fringe
		let fringe;
		if (Object.keys(cluster.s).length) {
			fringe = document.createElement("div");
			if (periphery) {
				periphery.appendChild(fringe);
			} else {
				cont.appendChild(fringe);
			}
			fringe.classList.add("cluster-fringe", "cluster-circle");
		}
		// center
		let center = document.createElement("div");
		if (fringe) {
			fringe.appendChild(center);
		} else if (periphery) {
			periphery.appendChild(center);
		} else {
			cont.appendChild(center);
		}
		center.classList.add("cluster-center", "cluster-circle");
		// fill in lemmas
		const circles = [
			{
				key: "z",
				cont: center,
			},
			{
				key: "s",
				cont: fringe,
			},
			{
				key: "u",
				cont: periphery,
			},
		];
		for (const circle of circles) {
			let dominant = document.createElement("div");
			dominant.classList.add("cluster-dominant");
			let recessive = document.createElement("div");
			recessive.classList.add("cluster-recessive");
			for (let [lemma, values] of Object.entries(cluster[circle.key])) {
				let cont = recessive;
				if (circle.key === "z" &&
							dominanceArtExist &&
							values.points > weights[0] - dominanceThreshold ||
						circle.key === "s" &&
							values.points > 1e3) {
					cont = dominant;
				}
				let span = document.createElement("span");
				cont.appendChild(span);
				span.dataset.lemma = lemma;
				if (checkModulate &&
						clustersMod.data.center[lemma]) {
					span.classList.add("in-modulation");
				}
				if (lemma === markLemma) {
					span.classList.add("marked");
				}
				if (xml.data.files[values.file].fa) {
					span.classList.add("fa");
					span.title = "Wortfeldartikel";
				} else if (xml.data.files[values.file].nlJoined.includes(lemma)) {
					span.title = "Nebenlemma";
				}
				lemma = shared.hClear(lemma);
				if (lemma.length > 30 &&
						/\//.test(lemma)) {
					span.classList.add("wrap");
					lemma = lemma.replace(/\//g, "/<wbr>");
				}
				span.innerHTML = lemma;
			}
			if (dominant && dominant.hasChildNodes()) {
				circle.cont.appendChild(dominant);
			}
			if (recessive && recessive.hasChildNodes()) {
				circle.cont.appendChild(recessive);
			}
		}
		return cont;
	},
	// switch to or from clusters preview respectively
	previewSwitchMode () {
		// TODO change viewClusters.data.active from "repo" to "preview" and vice versa
	},
};
