"use strict";

let overlay = {
	// z-index for stacking order
	zIndex: 1000,
	// show overlay window
	show (id) {
		const over = document.getElementById(id);
		over.classList.remove("off");
		void over.offsetWidth;
		over.style.zIndex = ++overlay.zIndex;
		over.classList.remove("hide");
	},
	// hide overlay window
	hide (id) {
		return new Promise(resolve => {
			const over = document.getElementById(id);
			over.addEventListener("transitionend", () => {
				over.classList.add("off");
				resolve(true);
			}, { once: true });
			over.classList.add("hide");
		});
	},
	// react to close icon
	//   icon = element
	close (icon) {
		const id = icon.closest("[id]").id;
		if (id === "dialog") {
			dialog.response = null;
		}
		overlay.hide(id);
	},
	// detect topmost overlay window
	top () {
		let top = {
			zIndex: 0,
			id: "",
		};
		for (const i of document.querySelectorAll(".overlay")) {
			if (i.classList.contains("hide")) {
				continue;
			}
			const zIndex = parseInt(i.style.zIndex, 10);
			if (zIndex > top.zIndex) {
				top.zIndex = zIndex;
				top.id = i.id;
			}
		}
		return top.id;
	},
};
