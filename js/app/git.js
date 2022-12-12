"use strict";

let git = {
	// URI to remote repository
	remote: "git.zdl.org/zdl/wortgeschichten.git",
	// Git config
	config: {},
	// password for Git repository
	// (only valid for current app session)
	configPass: "",
	// check Git config
	async configCheck () {
		// get config data
		git.config = await shared.ipc.invoke("git-config");
		// check config
		const dirOkay = await git.dirCheck(git.config.dir);
		if (!dirOkay[0] || !git.config.user) {
			// open config form
			git.configFormShow();
			// show message if the directory wasn't found anymore
			if (git.config.dir && !dirOkay[0]) {
				await git.dirError(dirOkay[1]);
			}
			// wait until the configuration is okay
			const gitWin = document.querySelector("#git");
			await new Promise(resolve => {
				const checkConfig = setInterval(() => {
					if (gitWin.classList.contains("hide")) {
						clearInterval(checkConfig);
						resolve(true);
					}
				}, 25);
			});
			// close config form
			await shared.wait(500);
		} else {
			git.fillPrefs();
		}
	},
	// show config overlay
	configFormShow () {
		// show window
		overlay.show("git");
		// fill in
		const dir = document.querySelector("#git-dir");
		dir.value = git.config.dir;
		const user = document.querySelector("#git-user");
		user.value = git.config.user;
		user.select();
	},
	// check inputs in config overlay
	async configFormCheck () {
		const user = document.querySelector("#git-user").value.trim(),
			dir = document.querySelector("#git-dir").value.trim();
		if (!user || !dir) {
			let text = "Sie müssen noch …\n",
				missing = [];
			if (!user) {
				missing.push("• den Benutzernamen angeben");
			}
			if (!dir) {
				missing.push("• den Pfad zum Repository auswählen");
			}
			text += missing.join("<br>");
			await dialog.open({
				type: "alert",
				text,
			});
			if (!user) {
				document.querySelector("#git-user").select();
			} else if (!dir) {
				document.querySelector("#git-dir-open").focus();
			}
			return;
		} else if (/\s/.test(user)) {
			await dialog.open({
				type: "alert",
				text: "Der Benutzername darf keine Leerzeichen enthalten.",
			});
			document.querySelector("#git-user").select();
			return;
		}
		// check directory
		const dirOkay = await git.dirCheck(dir);
		if (!dirOkay[0]) {
			git.config.dir = "";
			git.dirError(dirOkay[1]);
			return;
		}
		// close all preview windows if dir is about to be changed
		if (git.config.dir !== dir) {
			shared.ipc.invoke("pv-close-all");
		}
		// save config data in prefs file
		git.config.user = user;
		git.config.dir = dir;
		shared.ipc.invoke("git-save", git.config);
		// fill in preferences
		git.fillPrefs();
		// close window
		overlay.hide("git");
	},
	// select repository directory
	async dirSelect () {
		const options = {
			title: "Repository auswählen",
			defaultPath: shared.info.documents,
			properties: [
				"openDirectory",
			],
		};
		const result = await shared.ipc.invoke("file-dialog", true, options);
		if (result.canceld || !result?.filePaths?.length) {
			return;
		}
		document.querySelector("#git-dir").value = result.filePaths[0];
		document.querySelector("#git-okay").focus();
	},
	// check directory with presumed Git repository
	//   dir = string
	async dirCheck (dir) {
		if (!dir) {
			return [false, "empty"];
		}
		const structure = {
			".git": false,
			articles: false,
			ignore: false,
		};
		try {
			const files = await shared.fsp.readdir(dir);
			for (const f of files) {
				structure[f] = true;
			}
		} catch {
			return [false, "not found"];
		}
		if (Object.values(structure).some(i => !i)) {
			let missing = [];
			for (const [k, v] of Object.entries(structure)) {
				if (!v) {
					missing.push(k);
				}
			}
			return [false, missing.join(" ")];
		}
		return [true, ""];
	},
	// display appropriate error message
	//   error = string (empty | not found | missing folders, separated by spaces)
	async dirError (error) {
		let text = "";
		if (error === "empty") {
			text = "Sie haben noch keinen Repository-Pfad ausgewählt.";
		} else if (error === "not found") {
			text = "Das ausgewählte Repository existiert nicht mehr.";
		} else {
			const missing = error.split(" ");
			if (missing.includes(".git")) {
				text = "Der ausgewählte Ordner enthält kein Git-Repository.";
			} else {
				let notFound = [];
				for (const i of missing) {
					notFound.push("• " + i);
				}
				text = `Folgende Unterordner im Repository wurden nicht gefunden:\n${notFound.join("<br>")}`;
			}
		}
		await dialog.open({
			type: "alert",
			text,
		});
		document.querySelector("#git-dir-open").focus();
	},
	// return current branch
	async branchCurrent () {
		return await git.commandExec("git branch --show-current");
	},
	// print current branch
	async branchCurrentPrint () {
		const branchCurrent = await git.branchCurrent();
		document.querySelector("#fun-git-branch").textContent = branchCurrent || "???";
		return branchCurrent;
	},
	// check whether the current branch is clean or not
	//   feedback = false | undefined
	async branchClean (feedback = true) {
		const notClean = await git.commandExec("git diff --stat");
		if (notClean || notClean === false) {
			if (notClean && feedback) {
				await shared.error("Branch nicht sauber, Änderungen an Dateien noch nicht committet");
			}
			return false;
		}
		return true;
	},
	// execute a basic git command
	//   a = element
	async command (a) {
		await xml.updateWait();
		let command = a.id.replace("fun-git-", "");
		command = command.substring(0, 1).toUpperCase() + command.substring(1);
		git["command" + command]();
	},
	// show status
	async commandStatus () {
		let status = await git.commandExec(`git status`);
		if (status === false) {
			document.querySelector("#fun-git-status").focus();
			return;
		}
		status = shared.errorString(status);
		status = status.replace(/\t/g, "  ");
		const win = document.querySelector("#dialog");
		win.classList.add("code");
		await dialog.open({
			type: "alert",
			text: status,
		});
		setTimeout(() => win.classList.remove("code"), 300);
	},
	// change branch
	async commandBranch () {
		let current = await git.branchCurrent(),
			dest = "";
		switch (current) {
			case "master":
				dest = "preprint";
				break;
			case "preprint":
				dest = "master";
				break;
		}
		// Is the working tree clean?
		const clean = await git.branchClean();
		if (!clean) {
			document.querySelector("#fun-git-branch").focus();
			return;
		}
		// checkout branch
		const checkout = await git.commandExec(`git checkout ${dest}`);
		if (checkout === false) {
			document.querySelector("#fun-git-branch").focus();
			return;
		}
		git.branchCurrentPrint();
		shared.feedback("okay");
		xml.update();
	},
	// pull on current branch
	async commandPull () {
		// Is the working tree clean?
		const clean = await git.branchClean();
		if (!clean) {
			document.querySelector("#fun-git-pull").focus();
			return;
		}
		// Do I know the user's password?
		let pass = git.configPass;
		if (!pass) {
			const result = await dialog.open({
				type: "pass",
				text: `Passwort für <b>${git.config.user}@git.zdl.org</b>`,
			});
			if (!result) {
				return;
			}
			// Passwort auslesen
			pass = document.querySelector("#dialog input").value.trim();
			if (!pass) {
				shared.error("kein Passwort eingegeben");
				return;
			}
		}
		// Okay, let's pull it!
		let branches = [await git.branchCurrent()];
		branches.unshift(branches[0] === "master" ? "preprint" : "master");
		for (const branch of branches) {
			const checkout = await git.commandExec(`git checkout ${branch}`);
			if (checkout === false) {
				document.querySelector("#fun-git-pull").focus();
				return;
			}
			const pull = await git.commandExec(`git pull https://${git.config.user}:${pass}@${git.remote}`);
			if (pull === false) {
				document.querySelector("#fun-git-pull").focus();
				return;
			}
		}
		git.configPass = pass;
		shared.feedback("okay");
		xml.update();
	},
	// restore changed files
	async commandRestore () {
		// Is the working tree clean?
		const clean = await git.branchClean(false);
		if (clean) {
			dialog.open({
				type: "alert",
				text: "Der Branch ist sauber.\nEs können keine Dateien zurückgesetzt werden.",
			});
			return;
		}
		// Are you really going to do this?
		const confirm = await dialog.open({
			type: "confirm",
			text: '<b class="warn">ACHTUNG!</b>\nBeim Zurücksetzen der Dateien werden nicht committete Änderungen im Repository unwiederbringlich gelöscht!\n(Dateien im Unterordner <i>ignore</i> sind davon nicht betroffen.)\nWollen Sie die geänderten Dateien wirklich zurücksetzen?',
			wait: true,
		});
		if (!confirm) {
			return;
		}
		// restore known folders and files
		const folders = [
			"articles",
			"resources",
			"share",
			"README.md",
		];
		const restore = await git.commandExec(`git restore ${folders.join(" ")}`);
		if (restore === false) {
			document.querySelector("#fun-git-restore").focus();
			return;
		}
		shared.feedback("okay");
		xml.update();
	},
	// execute a Git command
	//   command = string
	async commandExec (command) {
		const result = await new Promise(resolve => {
			command = `cd "${git.config.dir}" && ${command}`;
			const options = {
				windowsHide: true,
			};
			shared.exec(command, options, (err, stdout, stderr) => {
				if (err) {
					resolve([err.code, stderr.trim()]);
				} else {
					resolve(stdout.trim());
				}
			});
		});
		// handle errors
		if (Array.isArray(result)) {
			await shared.error(`Fehlercode: ${result[0]}, ${result[1]}`);
			return false;
		}
		// return result
		return result;
	},
	// fill in preferences
	fillPrefs () {
		for (const [k, v] of Object.entries(git.config)) {
			const text = v.replace(/[/\\]/g, m => m + "<wbr>");
			document.querySelector(`#prefs-git-${k}`).innerHTML = text;
		}
	},
};
