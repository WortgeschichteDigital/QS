"use strict";

let git = {
	// Git config
	config: {},
	// initialize git config
	async init () {
		// get config data
		git.config = await app.ir.invoke("get-git-config");
		// check config
		if (!git.config.dir.length ||
				!git.config.user) {
			await git.showConfig();
		}
		// check repository structure TODO
	},
	// show config overlay
	async showConfig () {
		overlay.show("git");
		// TODO
	},
};
