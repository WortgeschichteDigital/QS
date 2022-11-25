"use strict";

let app = {
	// app is ready for interaction
	ready: false,
	// app info
	//   documents = path to user documents
	//   temp = path to temp dir
	//   userData = path to config dir
	info: {},
	// inter process communication
	ir: require("electron").ipcRenderer,
	// Node.js modules
	exec: require("child_process").exec,
	fsp: require("fs").promises,
	path: require("path"),
	// toggle main view
	//   button = element
	toggleView (button) {
		if (button.classList.contains("active")) {
			return;
		}
		let activeView = "";
		for (const b of document.querySelectorAll("#view a")) {
			if (b === button) {
				b.classList.add("active");
				activeView = b.id.replace("view-", "");
			} else {
				b.classList.remove("active");
			}
		}
		for (const v of document.querySelectorAll("section")) {
			if (v.id === activeView) {
				v.style.left = window.innerWidth + "px";
				v.classList.remove("off");
				void v.offsetWidth;
				v.style.left = "0px";
			} else {
				v.classList.add("off");
			}
		}
	},
	// toggle filter bar
	toggleFilters () {
		document.querySelector("#fun-filters").classList.toggle("active");
		document.querySelector("#filters").classList.toggle("visible");
	},
};
