"use strict";

let help = {
	// initialize view
	init () {
		document.querySelector("nav a").classList.add("active");
		document.querySelectorAll("section").forEach((i, n) => {
			if (n === 0) {
				return;
			}
			i.classList.add("off");
		});
	},
	// navigate to the given section
	//   sect = string (section ID)
	nav (sect) {
		// update navigation
		const active = document.querySelector("nav .active");
		if (active.getAttribute("href").substring(1) === sect) {
			return;
		}
		active.classList.remove("active");
		document.querySelector(`nav a[href="#${sect}"]`).classList.add("active");
		// update section view
		document.querySelectorAll("section").forEach(i => {
			if (i.id === sect) {
				i.classList.remove("off");
			} else {
				i.classList.add("off");
			}
		});
		// scroll to top
		window.scrollTo(0, 0);
	},
};
