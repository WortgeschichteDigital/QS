"use strict";

let pv = {
	// app info
	//   appPath = string (path to app root folder)
	//   documents = string (path to user documents dir)
	//   temp = string (path to temp dir)
	//   userData = string (path to config dir)
	//   winId = integer (window ID)
	info: {},
	// Electron modules
	ir: require("electron").ipcRenderer,
	// Node.js modules
	path: require("path"),
	// received XML data
	//   dir = string (articles | ignore)
	//   file = string (XML file name)
	//   git = string (path to git directory)
	//   xml = string (XML file content)
	data: {},
	// show XML preview on zdl.org
	xml () {
		const wv = document.querySelector("webview");
		wv.loadURL("https://www.zdl.org/wb/wortgeschichten/pv", {
			postData: [{
				type: "rawData",
				bytes: Buffer.from(`xml=${encodeURIComponent(pv.data.xml)}`),
			}],
			extraHeaders: "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
		})
			.then(() => loadingDone())
			.catch(err => {
				wv.stop();
				wv.loadURL("file://" + pv.path.join(pv.info.appPath, "win", "pv-error.html"))
					.then(() => {
						loadingDone();
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
						loadingDone();
					});
			});
		function loadingDone () {
			document.querySelector("#update img").classList.remove("rotate");
			wv.clearHistory();
			pv.updateIcons();
		}
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
		pv.ir.invoke("pv", {
			dir: pv.data.dir,
			file: pv.data.file,
			git: pv.data.git,
			winId: pv.info.winId,
		});
	},
	// open the same article in another window
	newWin () {
		pv.ir.invoke("pv-new", {
			dir: pv.data.dir,
			file: pv.data.file,
			git: pv.data.git,
			winId: pv.info.winId,
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
