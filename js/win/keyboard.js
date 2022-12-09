"use strict";

let keyboard = {
	// handle keyboard events
	//   evt = obejct
	async shortcuts (evt) {
		const m = shared.detectKeyboardModifiers(evt);
		// Arrows
		if (m === "Ctrl" && /^Arrow(Down|Up)$/.test(evt.key)) {
			evt.preventDefault();
			shared.verticalNav(document.querySelector("nav"), evt.key === "ArrowUp");
		}
	},
};
