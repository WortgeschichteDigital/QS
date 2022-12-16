"use strict";

let help = {
	// initialize view
	init () {
		// prepare navigation and sections
		document.querySelector("nav a").classList.add("active");
		document.querySelectorAll("section").forEach((i, n) => {
			if (n === 0) {
				return;
			}
			i.classList.add("off");
		});
		// include table of contents icon
		let a = document.createElement("a");
		document.body.appendChild(a);
		a.href = "#";
		a.id = "toc";
		a.title = "Inhaltsverzeichnis";
		let img = document.createElement("img");
		a.appendChild(img);
		img.src = "../img/app/toc.svg";
		img.width = "48";
		img.height = "48";
		img.alt = "";
		a.addEventListener("click", function(evt) {
			evt.preventDefault();
			if (document.querySelector(".toc-popup")) {
				help.tocClose();
			} else {
				help.tocOpen();
			}
		});
	},
	// show table of contents
	tocOpen () {
		document.querySelector("#toc").dispatchEvent(new Event("mouseout"));
		let toc = document.createElement("div");
		document.body.appendChild(toc);
		toc.classList.add("toc-popup");
		// fill in headings
		const section = document.querySelector("nav a.active").getAttribute("href");
		for (const i of document.querySelector(section).children) {
			if (!/^H[0-6]$/.test(i.nodeName)) {
				continue;
			}
			let a = document.createElement("a");
			toc.appendChild(a);
			a.classList.add("level-" + i.nodeName.match(/[0-6]$/)[0]);
			a.href = "#" + i.nextElementSibling.id;
			a.textContent = i.textContent;
			a.addEventListener("click", function(evt) {
				help.tocClose();
			});
		}
		// show popup
		void toc.offsetWidth;
		toc.classList.add("visible");
	},
	// close table of contents
	tocClose () {
		const toc = document.querySelector(".toc-popup");
		if (!toc || !toc.classList.contains("visible")) {
			return;
		}
		toc.addEventListener("transitionend", function() {
			this.parentNode.removeChild(this);
		}, { once: true });
		toc.classList.remove("visible");
	},
	// navigation with internal links
	//   hash = string
	internalLink (hash) {
		const section = hash.substring(1).split("-")[0];
		if (document.querySelector(`#${section}.off`)) {
			help.switchSection(section);
		}
		if (hash.includes("-")) {
			window.location = hash;
		}
	},
	// navigate to the given section
	//   sect = string (section ID)
	switchSection (sect) {
		help.tocClose();
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
	// show a specific section
	//   data = object
	show (data) {
		document.querySelector(`nav a[href="#${data.section}"]`).click();
		window.location.hash = "#" + data.id;
	},
};
