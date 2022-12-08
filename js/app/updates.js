"use strict";

let updates = {
	// saves the timeout that is set after starting the app
	timeout: null,
	// check for updates
	//   auto = boolean (automatic check => no feedback in case of error)
	async check (auto) {
		clearTimeout(updates.timeout);
		// don't check while developing
		if (auto && !shared.info.packaged) {
			return;
		}
		// download RSS feed
		const data = await updates.fetchRSS();
		// error
		if (!data.ok) {
			if (!auto) {
				updates.error(data.err);
			}
			return;
		}
		// parse RSS feed
		const parser = new DOMParser(),
			rss = parser.parseFromString(data.text, "text/xml"),
			entries = rss.querySelectorAll("entry");
		if (!entries.length) {
			// no entries found, so probably the feed was not well-formed
			// (which happens sometimes)
			if (!auto) {
				updates.error({
					name: "Server-Fehler",
					message: "RSS-Feed nicht wohlgeformt",
				});
			}
			return;
		}
		// detect newest version
		let versionOnline;
		for (let i = 0, len = entries.length; i < len; i++) {
			const entry = entries[i],
				version = entry.querySelector("id").firstChild.nodeValue.match(/[0-9]+\.[0-9]+\.[0-9]+$/);
			if (!version) {
				continue;
			}
			versionOnline = version[0];
			break;
		}
		// display outcome
		if (updates.verToInt(versionOnline) > updates.verToInt(shared.info.version)) {
			dialog.open({
				type: "alert",
				text: `Es gibt ein <b>Update</b>!\n<span class="update">installiert:</span>v${shared.info.version}<br><span class="update">online:</span>v${versionOnline}`,
			});
		} else if (!auto) {
			dialog.open({
				type: "alert",
				text: "Die App is up-to-date.",
			});
		}
		// memorize last update check
		prefs.data.updateCheck = new Date().toISOString().split("T")[0];
	},
	// display error message
	//   err = object
	error (err) {
		dialog.open({
			type: "alert",
			text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${err.name}: ${err.message}`,
		});
	},
	// fetch RSS feed
	async fetchRSS () {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 1e4);
		let response;
		try {
			const url = "https://github.com/WortgeschichteDigital/QS/releases.atom";
			response = await fetch(url, {
				signal: controller.signal,
			});
		} catch (err) {
			return {
				ok: false,
				err,
				text: "",
			};
		}
		if (!response.ok) {
			return {
				ok: false,
				err: {
					name: "Server-Fehler",
					message: `HTTP-Status-Code ${response.status}`,
				},
				text: "",
			};
		}
		const text = await response.text();
		return {
			ok: true,
			err: {},
			text,
		};
	},
	// convert a version string into an integer
	//   version = string
	verToInt (version) {
		version = version.split("-")[0];
		version = version.replace(/[0-9]+/g, m => m.padStart(3, "0"));
		version = version.replace(/\./g, "");
		return parseInt(version, 10);
	},
};
