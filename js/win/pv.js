"use strict";

let pv = {
	// received XML data
	//   dir = string (articles | ignore)
	//   file = string (XML file name)
	//   git = string (path to git directory)
	//   xml = string (XML file content)
	data: {},
	// show XML preview on zdl.org
	xml () {
		if (!pv.data.xml) {
			pv.xmlNotFound();
			return;
		}
		const wv = document.querySelector("webview");
		wv.loadURL("https://www.zdl.org/wb/wortgeschichten/pv", {
			postData: [{
				type: "rawData",
				bytes: Buffer.from(`xml=${encodeURIComponent(pv.data.xml)}`),
			}],
			extraHeaders: "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
		})
			.then(() => pv.loadingDone(wv))
			.catch(err => {
				wv.stop();
				wv.loadURL("file://" + shared.path.join(shared.info.appPath, "win", "pvError.html"))
					.then(() => {
						pv.loadingDone(wv);
						wv.executeJavaScript(`
							let label = document.createElement("p");
							label.classList.add("label");
							label.textContent = "Fehlermeldung";
							document.body.appendChild(label);
							let err = document.createElement("p");
							err.innerHTML = "${shared.errorString(err.message)}";
							document.body.appendChild(err);
						`);
					})
					.catch(() => {
						wv.stop();
						pv.loadingDone(wv);
					});
			});
	},
	// show error document if XML file was not found (anymore)
	xmlNotFound () {
		const wv = document.querySelector("webview");
		wv.loadURL("file://" + shared.path.join(shared.info.appPath, "win", "pvError.html"))
			.then(() => {
				pv.loadingDone(wv);
				wv.executeJavaScript(`
					let label = document.createElement("p");
					label.classList.add("label");
					label.textContent = "Fehlermeldung";
					document.body.appendChild(label);
					let err = document.createElement("p");
					err.innerHTML = "Die Daten aus der Datei „${pv.data.file}“ konnten nicht geladen werden.";
					document.body.appendChild(err);
				`);
			})
			.catch(() => {
				wv.stop();
				pv.loadingDone(wv);
			});
	},
	// finish up the loading procedure
	//   wv = element (<webview>)
	loadingDone (wv) {
		document.querySelector("#update img").classList.remove("rotate");
		wv.clearHistory();
		pv.updateIcons();
	},
	// update the navigation icons
	updateIcons () {
		const wv = document.querySelector("webview");
		for (const i of ["back", "forward"]) {
			const icon = document.querySelector(`#${i} img`);
			if (i === "back" && wv.canGoBack() ||
					i === "forward" && wv.canGoForward()) {
				icon.src = `../img/app/nav-${i}-white.svg`;
			} else {
				icon.src = `../img/app/nav-${i}-grey.svg`;
			}
		}
	},
	// request an updated XML file
	updateXml () {
		document.querySelector("#update img").classList.add("rotate");
		shared.ipc.invoke("pv", {
			dir: pv.data.dir,
			file: pv.data.file,
			git: pv.data.git,
			winId: shared.info.winId,
		});
	},
	// open the same article in another window
	newWin () {
		shared.ipc.invoke("pv-new", {
			dir: pv.data.dir,
			file: pv.data.file,
			git: pv.data.git,
			winId: shared.info.winId,
		});
	},
	// navigation
	//   action = string
	nav (action) {
		const wv = document.querySelector("webview");
		switch (action) {
			case "back":
				wv.goBack();
				break;
			case "forward":
				wv.goForward();
				break;
			case "new":
				pv.newWin();
				break;
			case "update":
				pv.updateXml();
				break;
			case "xml":
				pv.xml();
				break;
		}
	},
};
