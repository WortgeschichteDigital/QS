"use strict";

let shared = {
	// execute a menu command
	menuCommand (command) {
		if (!app.ready) {
			dialog.open({
				type: "alert",
				text: "Die App ist noch nicht bereit.",
			});
			return;
		}
		switch (command) {
			case "preferences":
				overlay.show("prefs");
				break;
		}
	},
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
				// in macOS, it is more convenient when the meta key acts the same as control
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
	// wait for the given milliseconds
	//   ms = integer
	async wait (ms) {
		return new Promise(resolve => setTimeout(() => resolve(true), ms));
	},
	// prepare error strings
	//   err = string
	errorString (err) {
		err = err.replace(/\n/g, "<br>");
		err = err.replace(/(?<!<)\//g, "/<wbr>");
		return err;
	},
};
