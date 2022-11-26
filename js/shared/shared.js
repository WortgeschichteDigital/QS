"use strict";

let shared = {
	// detect pressed modifiers
	//   evt = object (keydown event)
	detectKeyboardModifiers (evt) {
		let m = [];
		if (evt.altKey) {
			m.push("Alt");
		}
		if (evt.getModifierState("AltGraph")) {
			m.push("AltGr");
		}
		if (evt.getModifierState("CapsLock")) {
			m.push("Caps");
		}
		if (evt.ctrlKey) {
			m.push("Ctrl");
		}
		if (evt.metaKey) {
			if (process.platform === "darwin") {
				// in macOS, it is more convenient when the meta key acts
				// the same as the control key
				m.push("Ctrl");
			} else {
				m.push("Meta");
			}
		}
		if (evt.shiftKey) {
			m.push("Shift");
		}
		return m.join("+");
	},
	// change titles with keyboard shortcuts if on macOS
	keyboardMacOS () {
		if (process.platform !== "darwin") {
			return;
		}
		const sc = {
			Alt: "⌥",
			Strg: "⌘",
		};
		// <kbd>
		document.querySelectorAll("kbd").forEach(i => {
			const text = i.textContent;
			if (!/^(Alt|Strg)$/.test(text)) {
				return;
			}
			i.textContent = sc[text];
		});
		// @title
		document.querySelectorAll("[title]").forEach(i => {
			i.title = i.title.replace(/Alt\s\+/, sc.Alt + "\u00A0+");
			i.title = i.title.replace(/Strg\s\+/, sc.Strg + "\u00A0+");
		});
	},
	// prepare error strings for better readability
	//   err = string
	errorString (err) {
		err = err.replace(/\n/g, "<br>");
		err = err.replace(/(?<!<)[/\\]/g, m => `${m}<wbr>`);
		return err;
	},
	// show passive feedback
	//   type = string
	async feedback (type) {
		let fb = document.createElement("div");
		fb.classList.add("feedback", "type-" + type);
		document.body.appendChild(fb);
		void fb.offsetWidth;
		fb.classList.add("visible");
		await shared.wait(1300);
		fb.addEventListener("transitionend", function() {
			this.parentNode.removeChild(this);
		}, { once: true });
		fb.classList.remove("visible");
	},
	// wait for the given milliseconds
	//   ms = integer
	wait (ms) {
		return new Promise(resolve => setTimeout(() => resolve(true), ms));
	},
};
