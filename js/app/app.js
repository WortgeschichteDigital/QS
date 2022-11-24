"use strict";

let app = {
	// inter process communication with the main process
	ir: require("electron").ipcRenderer,
	// Node.js modules
	path: require("path"),
};
