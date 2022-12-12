"use strict";

let shared = {
	// app info
	//   appPath = string (path to app root folder)
	//   documents = string (path to user documents dir)
	//   packaged = boolean (app is packaged)
	//   temp = string (path to temp dir)
	//   userData = string (path to config dir)
	//   version = string (app version)
	//   winId = integer (window ID)
	info: {},
	// Electron modules
	// (this file is also included in workers, but in that context,
	// require() isn't available => test whether window exists or not)
	clipboard: typeof window !== "undefined" ? require("electron").clipboard : null,
	ipc: typeof window !== "undefined" ? require("electron").ipcRenderer : null,
	shell: typeof window !== "undefined" ? require("electron").shell : null,
	// Node.js modules
	exec: typeof window !== "undefined" ? require("child_process").exec : null,
	crypto: typeof window !== "undefined" ? require("crypto") : null,
	fsp: typeof window !== "undefined" ? require("fs").promises : null,
	path: typeof window !== "undefined" ? require("path") : null,
	// erase all children within the given element
	//   ele = element
	clear (ele) {
		while (ele.hasChildNodes()) {
			ele.removeChild(ele.lastChild);
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
	// display error message
	//   err = string
	async error (err) {
		err = shared.errorString(err);
		await dialog.open({
			type: "alert",
			text: `Es ist ein <b class="warn">Fehler</b> aufgetreten!\n<i>Fehlermeldung:</i><br>${err}`,
		});
	},
	// reduce the error stack
	//   err = string
	reduceErrorStack (err) {
		let stack = [];
		for (const m of err.matchAll(/[a-zA-Z]+\.js:[0-9]+/g)) {
			stack.unshift(m[0]);
		}
		return stack.join(" > ");
	},
	// prepare error strings for better readability
	//   err = string
	errorString (err) {
		err = err.replace(/\n/g, "<br>");
		err = err.replace(/(?<!<)[/\\]/g, m => `${m}<wbr>`);
		return err;
	},
	// log errors
	//   evt = object
	onError (evt) {
		let file = evt.filename, // normal errors
			message = evt.message,
			line = evt.lineno,
			column = evt.colno,
			stack = "";
		if (evt.stack) { // forwarded errors
			if (!/file:.+?\.js/.test(evt.stack)) {
				noDetails();
			} else {
				file = evt.stack.match(/file:.+?\.js/)[0];
				message = `${evt.name}: ${evt.message}`;
				line = parseInt(evt.stack.match(/\.js:([0-9]+):/)[1], 10);
				column = parseInt(evt.stack.match(/\.js:[0-9]+:([0-9]+)/)[1], 10);
				stack = shared.reduceErrorStack(evt.stack);
			}
		} else if (evt.reason) { // in promise errors
			if (!/file:.+?\.js/.test(evt.reason.stack)) {
				noDetails();
			} else {
				file = evt.reason.stack.match(/file:.+?\.js/)[0];
				message = evt.reason.stack.match(/(.+?)\n/)[1];
				line = parseInt(evt.reason.stack.match(/\.js:([0-9]+):/)[1], 10);
				column = parseInt(evt.reason.stack.match(/\.js:[0-9]+:([0-9]+)/)[1], 10);
				stack = shared.reduceErrorStack(evt.reason.stack);
			}
		}
		// create error and send to main
		let err = `\n----- ${new Date().toISOString()} -----\n`;
		if (file || line || column) {
			err += `${file}: ${line}:${column}\n`;
		}
		err += message + "\n";
		if (stack) {
			err += `(${stack})\n`;
		}
		shared.ipc.invoke("error", err);
		// no details avaiblable
		function noDetails () {
			let stack = evt.reason.stack ? evt.reason.stack : "";
			if (!stack && evt.reason.name) {
				stack = `${evt.reason.name}: ${evt.reason.message}`;
			}
			file = "";
			message = stack;
			line = 0;
			column = 0;
		}
	},
	// escape special RegExp tokens
	escapeRegExp (text) {
		return text.replace(/\/|\(|\)|\[|\]|\{|\}|\.|\?|\\|\+|\*|\^|\$|\|/g, m => `\\${m}`);
	},
	// open links in external program
	externalLinks () {
		document.querySelectorAll('a[href^="https:"], a[href^="mailto:"]').forEach(i => {
			i.addEventListener("click", function(evt) {
				evt.preventDefault();
				if (evt.detail > 1) { // no double-clicks
					return;
				}
				shared.shell.openExternal(this.getAttribute("href"));
			});
		});
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
	// fetch data
	//   url = string
	async fetch (url) {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 1e4);
		let response;
		try {
			response = await fetch(url, {
				signal: controller.signal,
			});
		} catch (err) {
			return {
				ok: false,
				err,
				text: "",
			};
		}
		if (!response.ok) {
			return {
				ok: false,
				err: {
					name: "Server-Fehler",
					message: `HTTP-Status-Code ${response.status}`,
				},
				text: "",
			};
		}
		const text = await response.text();
		return {
			ok: true,
			err: {},
			text,
		};
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
	// navigate through a vertical navigation
	//   nav = element
	//   up = boolean
	verticalNav (nav, up) {
		let active = nav.querySelector(".active"),
			target;
		if (up) {
			target = active.parentNode.previousSibling;
		} else {
			target = active.parentNode.nextSibling;
		}
		if (!target) {
			return;
		}
		target.firstChild.click();
	},
	// detect scroll end
	//   obj = element (scrollable element)
	async scrollEnd (obj = window) {
		await new Promise(resolve => {
			let scroll = false,
				scrollTimer = null;
			function scrollDetect () {
				scroll = true;
				clearTimeout(scrollTimer);
				scrollTimer = setTimeout(() => scrollEnd(), 25);
			}
			function scrollEnd () {
				obj.removeEventListener("scroll", scrollDetect);
				resolve(true);
			}
			obj.addEventListener("scroll", scrollDetect);
			setTimeout(() => {
				if (!scroll) {
					scrollEnd();
				}
			}, 50);
		});
	},
	// sort alpha-numeric
	sort (a, b) {
		let x = shared.sortPrep(a),
			y = shared.sortPrep(b),
			z = [x, y];
		if (x === y) {
			if (a === b) {
				return 0;
			}
			z = [a, b];
		}
		z.sort();
		if (z[0] === x ||
				z[0] === a) {
			return -1;
		}
		return 1;
	},
	// prepare strings for alpha-numeric sorting
	sortPrepCache: {},
	sortPrep (str) {
		if (shared.sortPrepCache[str]) {
			return shared.sortPrepCache[str];
		}
		let norm = str.toLowerCase();
		const rep = new Map([
			[/ä/g, "ae"],
			[/[èé]/g, "e"],
			[/ö/g, "oe"],
			[/ü/g, "ue"],
			[/ß/g, "ss"],
		]);
		for (let [k, v] of rep) {
			norm = norm.replace(k, v);
		}
		shared.sortPrepCache[str] = norm;
		return norm;
	},
	// wait for the given milliseconds
	//   ms = integer
	wait (ms) {
		return new Promise(resolve => setTimeout(() => resolve(true), ms));
	},
};
