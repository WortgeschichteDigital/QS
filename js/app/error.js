"use strict";

let error = {
	// log file location
	log: "",
	// show error log
	async showLog () {
		if (!error.log) {
			error.log = shared.path.join(shared.info.userData, "error.log");
		}
		const pre = document.querySelector("#error pre");
		shared.clear(pre);
		const exists = await shared.ipc.invoke("exists", error.log);
		if (!exists) {
			pre.textContent = "Das Fehlerlog ist leer.";
		} else {
			const log = await shared.fsp.readFile(error.log, { encoding: "utf8" });
			pre.textContent = log;
		}
		overlay.show("error");
		pre.scrollTop = pre.scrollHeight;
	},
	// open log file in external program
	async openLog () {
		const exists = await shared.ipc.invoke("exists", error.log);
		if (!exists) {
			error.noLog();
			return;
		}
		const result = await shared.shell.openPath(error.log);
		if (result) {
			shared.error(result);
		}
	},
	// delete log file
	async deleteLog () {
		let exists = await shared.ipc.invoke("exists", error.log);
		if (!exists) {
			error.noLog();
			return;
		}
		let result = await dialog.open({
			type: "confirm",
			text: "Soll das Fehlerlog wirklich gelöscht werden?",
		});
		if (!result) {
			return;
		}
		exists = await shared.ipc.invoke("exists", error.log);
		if (!exists) {
			error.noLog();
			return;
		}
		result = await shared.fsp.unlink(error.log);
		if (result) {
			shared.error(result);
		} else {
			document.querySelector("#error pre").textContent = "Das Fehlerlog ist leer.";
		}
	},
	// message that no log is present (yet)
	noLog () {
		dialog.open({
			type: "alert",
			text: "Das Fehlerlog existiert (noch) nicht.",
		});
	},
};
