"use strict";

let keyboard = {
	// handle keyboard events
	//   evt = obejct
	async shortcuts (evt) {
		const m = shared.detectKeyboardModifiers(evt),
			active = document.activeElement,
			olTop = overlay.top(); // string (ID of topmost overlay window)
		// Key "Escape"
		if (!m && evt.key === "Escape") {
			if (olTop) {
				const close = document.querySelector(`#${olTop} a.overlay-close`);
				if (close) { // Git configuration has no close icon
					close.click();
				}
			}
			return;
		}
		// Key "Enter"
		else if (!m && evt.key === "Enter") {
			if (olTop === "git" && /^git-(user|dir)$/.test(active.id)) {
				await shared.wait(25);
				document.querySelector("#git-okay").click();
			}
			return;
		}
	},
};
