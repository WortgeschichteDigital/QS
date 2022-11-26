"use strict";

let keyboard = {
	// handle keyboard events
	//   evt = obejct
	async shortcuts (evt) {
		const m = shared.detectKeyboardModifiers(evt),
			active = document.activeElement,
			olTop = overlay.top(); // string (ID of topmost overlay window, empty if all .off)
		// Key "Escape"
		if (!m && evt.key === "Escape" && olTop) {
			const close = document.querySelector(`#${olTop} a.overlay-close`);
			if (close) { // Git configuration has no close icon
				close.click();
			}
		}
		// Key "Enter"
		else if (!m && evt.key === "Enter") {
			if (olTop === "git" && /^git-(user|dir)$/.test(active.id)) {
				await shared.wait(25);
				document.querySelector("#git-okay").click();
			}
		}
		// Arrows
		else if (!m && /^Arrow(Left|Right)$/.test(evt.key) &&
				active.nodeName === "INPUT" && active.type === "button") {
			let buttons = active.parentNode.querySelectorAll('input[type="button"]'),
				idx = -1;
			for (let i = 0, len = buttons.length; i < len; i++) {
				if (buttons[i] === active) {
					idx = i;
					break;
				}
			}
			if (evt.key === "ArrowLeft") {
				idx--;
			} else {
				idx++;
			}
			if (idx === buttons.length) {
				idx = 0;
			} else if (idx < 0) {
				idx = buttons.length - 1;
			}
			buttons[idx].focus();
		}
	},
};
