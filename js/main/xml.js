"use strict";

const crypto = require("crypto");
const fsp = require("fs").promises;
const path = require("path");

// fill the current file into the file object
//   xmlFiles = object (contains data for all requested XML files)
//   dir = string (path to directory the file is in)
//   sub = string (subdirectory the file is in)
//   f = string (file name)
async function fillFileObject ({ xmlFiles, dir, sub, f }) {
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
		return false;
	}
	if (!/<WGD xmlns="http:\/\/www\.zdl\.org\/ns\/1\.0">/.test(xml)) {
		// no WGd-XML file
		return false;
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
	return true;
}

module.exports = {
	// get contents of xml files
	//   repoDir = string (path to repository)
	async getFiles (repoDir) {
		let xmlFiles = {};
		for (const sub of ["articles", "ignore"]) {
			const dir = path.join(repoDir, sub);
			const files = await fsp.readdir(dir);
			for (const f of files) {
				if (/^!/.test(f) || // test files
						!/\.xml$/.test(f)) { // no XML file
					continue;
				}
				await fillFileObject({ xmlFiles, dir, sub, f });
			}
		}
		return xmlFiles;
	},
	// get contents and data of a specific XML file
	//   repoDir = string (path to repository)
	//   sub = string (articles | ignore)
	//   f = string (XML file name)
	async getFile (repoDir, sub, f) {
		let xmlFiles = {};
		await fillFileObject({
			xmlFiles,
			dir: path.join(repoDir, sub),
			sub,
			f,
		});
		return xmlFiles;
	},
};
