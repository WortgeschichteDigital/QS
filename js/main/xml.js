"use strict";

const crypto = require("crypto"),
	fsp = require("fs").promises,
	path = require("path");

module.exports = {
	// get contents of xml files
	//   repoDir = string (path to repository)
	async getFiles (repoDir) {
		let xmlFiles = {};
		for (const sub of ["articles", "ignore"]) {
			const dir = path.join(repoDir, sub),
				files = await fsp.readdir(dir);
			for (const f of files) {
				if (/^!/.test(f)) {
					continue;
				}
				// status 0 = known and unchanged
				// status 1 = known but changed
				//              (assume this if file is in "articles" and "ignore")
				// status 2 = new (assume this if file is in ignore only)
				let status = sub === "articles" ? 0 : 2;
				if (xmlFiles[f]) {
					status = 1; 
				}
				const xml = await new Promise(resolve => {
					fsp.readFile( path.join(dir, f) )
					 .then(buffer => resolve( buffer.toString() ) )
					 .catch(() => resolve(false) );
				});
				if (!xml) {
					// only in case an error occures
					continue;
				}
				const hash = crypto.createHash("sha1").update(xml).digest("hex");
				if (status === 1 && xmlFiles[f].hash === hash) {
					status = 0;
				}
				xmlFiles[f] = {
					dir: sub,
					hash,
					status,
					xml,
				};
			}
		}
		return xmlFiles;
	},
	// get contents of a specific xml file
	//   path = string
	async getFile (path) {
		return await new Promise(resolve => {
			fsp.readFile(path)
				.then(buffer => resolve( buffer.toString() ) )
				.catch(() => resolve(false) );
		});
	},
};
