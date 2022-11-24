"use strict";

const { BrowserWindow, dialog } = require("electron"),
	fsp = require("fs").promises,
	path = require("path");

let svg = [];

module.exports = {
	// make a file list of all SVG files in folder /img/app/
	async svg () {
		if (svg.length) {
			return svg;
		}
		const paths = await fsp.readdir(path.join(__dirname, "..", "..", "img", "app"));
		for (const i of paths) {
			const stat = await fsp.lstat(path.join(__dirname, "..", "..", "img", "app", i));
			if (stat.isDirectory()) {
				continue;
			}
			svg.push(i);
		}
		return svg;
	},
	// check whether a file exists or not
	//   file = string (path to file)
	exists (file) {
		return new Promise(resolve => {
			fsp.access(file)
				.then(() => resolve(true))
				.catch(() => resolve(false));
		});
	},
	// show file dialog
	//   open = boolean (true: showOpenDialog(), false: showSaveDailog())
	//   id = integer (window ID)
	//   options = object
	fileDialog ({open, id, options}) {
		return new Promise(resolve => {
			const bw = BrowserWindow.fromId(id);
			if (open) {
				dialog.showOpenDialog(bw, options)
					.then(result => resolve(result))
					.catch(err => resolve(err));
			} else {
				dialog.showSaveDialog(bw, options)
					.then(result => resolve(result))
					.catch(err => resolve(err));
			}
		});
	},
};
