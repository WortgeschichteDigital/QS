"use strict";

let keyboard = {
	// handle keyboard events
	//   evt = obejct
	async shortcuts (evt) {
		const m = shared.detectKeyboardModifiers(evt),
			active = document.activeElement;
		// Key "Escape"
		if (!m && evt.key === "Escape") {
			const olTop = overlay.top();
			if (olTop) {
				const close = document.querySelector(`#${olTop} a.overlay-close`);
				if (close) { // Git configuration has no close icon
					close.click();
				}
				return;
			} else if (active.id === "search-text") {
				viewSearch.toggleAdvanced("off");
				return;
			}
			const select = document.querySelector(".select-popup");
			if (select) {
				bars.closeSelectPopup(select, false);
				return;
			}
			const commentHelp = document.querySelector(".comment-help");
			if (commentHelp) {
				commentHelp.firstElementChild.click();
			}
		}
		// Key "Enter"
		else if (!m && evt.key === "Enter") {
			const olTop = overlay.top();
			if (olTop === "git" && /^git-(user|dir)$/.test(active.id)) {
				await shared.wait(25);
				document.querySelector("#git-okay").click();
			} else if (active.id === "search-text") {
				viewSearch.start();
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
		} else if (m === "Alt" && /^Arrow(Left|Right)$/.test(evt.key)) {
			app.toggleViewShortcut(evt.key === "ArrowRight");
		} else if (m === "Ctrl" && /^Arrow(Left|Right)$/.test(evt.key)) {
			if (overlay.top() === "tags") {
				evt.preventDefault();
				const nav = document.querySelectorAll("#tags-nav > a");
				if (!nav[0].parentNode.classList.contains("off")) {
					if (evt.key === "ArrowLeft") {
						nav[0].click();
					} else {
						nav[1].click();
					}
				}
			}
		} else if (m === "Ctrl" && /^Arrow(Down|Up)$/.test(evt.key)) {
			const olTop = overlay.top();
			if (olTop === "prefs") {
				evt.preventDefault();
				shared.verticalNav(document.querySelector("#prefs ul"), evt.key === "ArrowUp");
			} else if (!olTop && app.view === "hints") {
				viewHints.nav(evt.key === "ArrowDown");
			}
		}
		// PageDown + PageUp
		else if (!m && /^Page(Down|Up)$/.test(evt.key)) {
			evt.preventDefault();
			app.scroll(evt.key === "PageDown");
		}
	},
};
