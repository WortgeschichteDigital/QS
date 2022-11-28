"use strict";

let pv = {
	// Electron modules
	ir: require("electron").ipcRenderer,
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
			.then(() => {
				document.querySelector("#update img").classList.remove("rotate");
				wv.clearHistory();
				pv.updateIcons();
			});
	},
	// request an updated XML file
	update () {
		document.querySelector("#update img").classList.add("rotate");
		pv.ir.invoke("pv", {
			dir: pv.data.dir,
			file: pv.data.file,
			git: pv.data.git,
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
			case "xml":
				pv.xml();
				break;
			case "update":
				pv.update();
				break;
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
};
