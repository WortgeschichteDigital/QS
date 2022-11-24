"use strict";

window.addEventListener("load", async () => {
	await shared.wait(1e3);
	await git.init();
	// overlay.hide("loading"); // TODO
});
