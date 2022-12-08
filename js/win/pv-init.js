"use strict";

window.addEventListener("load", async () => {
	// WINDOW EVENTS
	let winEventsTimeout = null;
	window.addEventListener("resize", () => {
		clearTimeout(winEventsTimeout);
		winEventsTimeout = setTimeout(() => {
			tooltip.off();
		}, 25);
	});
	window.addEventListener("scroll", () => {
		clearTimeout(winEventsTimeout);
		winEventsTimeout = setTimeout(() => {
			tooltip.off();
		}, 25);
	});

	// WEBVIEW EVENTS
	const wv = document.querySelector("webview");
	wv.addEventListener("did-finish-load", () => pv.updateIcons());
	wv.addEventListener("did-fail-load", function() {
		if (/www\.zdl\.org\/wb\/wortgeschichten\/pv/.test(this.getURL())) {
			pv.xml();
		} else {
			pv.updateIcons();
		}
	});

	// CLICK EVENTS: HEADER
	document.querySelectorAll("header a").forEach(i => {
		i.addEventListener("click", function(evt) {
			evt.preventDefault();
			pv.nav(this.id);
		});
	});

	// LISTEN TO IPC MESSAGES
	shared.ir.on("menu-nav-back", () => pv.nav("back"));
	shared.ir.on("menu-nav-forward", () => pv.nav("forward"));
	shared.ir.on("menu-nav-xml", () => pv.nav("xml"));
	shared.ir.on("menu-new", () => pv.nav("new"));
	shared.ir.on("menu-update", () => pv.nav("update"));
	shared.ir.on("update", (evt, args) => {
		pv.data = args;
		document.title = `QS / ${pv.data.file}`;
		pv.xml();
	});

	// GET APP INFO
	shared.info = await shared.ir.invoke("app-info");

	// INITIALIZE WINDOW
	shared.keyboardMacOS();
	tooltip.init();
	await shared.wait(250);
	overlay.hide("loading");
});
