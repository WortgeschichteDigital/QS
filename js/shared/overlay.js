"use strict";

let overlay = {
	// z-index for stacking order
	zIndex: 1000,
	// show overlay window
	show (id) {
		document.body.classList.remove("scrollable");
		const over = document.getElementById(id);
		over.classList.remove("off");
		void over.offsetWidth;
		over.style.zIndex = ++overlay.zIndex;
		over.classList.remove("hide");
	},
	// hide overlay window
	hide (id) {
		const over = document.getElementById(id);
		over.addEventListener("transitionend", () => {
			over.classList.add("off");
			overlay.bodyScrollable();
		}, { once: true });
		over.classList.add("hide");
	},
	// decide whether the body should be scrollable
	bodyScrollable () {
		let scrollable = true;
		for (const i of document.querySelectorAll(".overlay")) {
			if (!i.classList.contains("off")) {
				scrollable = false;
				break;
			}
		}
		if (scrollable) {
			document.body.classList.add("scrollable");
		}
	},
};
