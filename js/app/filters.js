"use strict";

let filters = {
	// filter data
	data: {
		authors: [],
		domains: [],
		status: [
			{
				icon: "status-unchanged.svg",
				text: "Datei unverändert",
				value: "0",
			},
			{
				icon: "status-changed.svg",
				text: "Datei geändert",
				value: "1",
			},
			{
				icon: "status-untracked.svg",
				text: "Datei neu",
				value: "2",
			},
		],
	},
	// update filter values
	update () {
		const cats = {
			authors: new Set(),
			domains: new Set(),
		};
		for (const i of Object.values(xml.data.files)) {
			i.authors.forEach(i => cats.authors.add(i));
			i.domains.forEach(i => cats.domains.add(i));
		}
		for (const [cat, set] of Object.entries(cats)) {
			filters.data[cat] = [];
			for (const i of set) {
				filters.data[cat].push({
					icon: "",
					text: i,
					value: i,
				});
			}
		}
		filters.data.authors.sort((a, b) => shared.sort(a.value, b.value));
		filters.data.domains.sort((a, b) => shared.sort(a.value, b.value));
	},
	// fill the given select according to its value
	//   select = element
	fillSelect (select) {
		// no value
		const value = select.dataset.value;
		if (!value) {
			select.textContent = "alle";
			return;
		}
		// search data
		const cat = select.id.replace("select-", ""),
			data = filters.data[cat].find(i => i.value === value);
		// filter doesn't exist anymore
		if (!data) {
			select.dataset.value = "";
			select.textContent = "alle";
			return;
		}
		// fill in filter
		let icon = "";
		if (data.icon) {
			icon = `<img src="img/app/${data.icon}" width="24" height="24" alt="">`;
		}
		select.innerHTML = icon + data.text;
	},
	// build select popup
	//   a = element (clicked select filter)
	selectPopup (a) {
		// create popup
		let div = document.createElement("div");
		a.parentNode.appendChild(div);
		div.classList.add("select-popup", "hide");
		// fill popup
		const alle = [{
			icon: "",
			text: "<i>alle</i>",
			value: "",
		}];
		const cat = a.id.replace("select-", ""),
			hasIcons = filters.data[cat].some(i => i.icon);
		for (const i of alle.concat(filters.data[cat])) {
			let item = document.createElement("a");
			div.appendChild(item);
			item.dataset.value = i.value;
			item.href = "#";
			let icon = "";
			if (i.icon) {
				icon = `<img src="img/app/${i.icon}" width="24" height="24" alt="">`;
			} else if (hasIcons) {
				icon = `<img src="img/app/placeholder.svg" width="24" height="24" alt="">`;
			}
			item.innerHTML = icon + i.text;
			item.addEventListener("click", function(evt) {
				evt.preventDefault();
				const select = this.closest(".select-cont").firstChild;
				select.dataset.value = i.value;
				filters.fillSelect(select);
				filters.closeselectPopup(this, false);
				filters.active();
				app.populateView();
			});
		}
		// show popup
		void div.offsetWidth;
		div.classList.remove("hide");
	},
	// close a select popup
	//   ele = element (caller: select filter or item in select popup)
	//   timeout = boolean
	closeselectPopup (ele, timeout) {
		const wait = timeout ? 200 : 0;
		setTimeout(() => {
			const dd = ele.closest(".select-cont").querySelector(".select-popup");
			if (dd) {
				dd.addEventListener("transitionend", function() {
					if (this.parentNode) {
						this.parentNode.removeChild(this);
					}
				}, { once: true });
				dd.classList.add("hide");
			}
		}, wait);
	},
	// return filter data
	getData () {
		let data = {};
		document.querySelectorAll(".select-filter").forEach(i => {
			data[i.id] = i.dataset.value;
		});
		return data;
	},
	// visualize that filters are active
	active () {
		let data = filters.getData(),
			active = false;
		for (const v of Object.values(data)) {
			if (v) {
				active = true;
				break;
			}
		}
		const button = document.querySelector("#fun-filters");
		if (active) {
			button.classList.add("active-filters");
		} else {
			button.classList.remove("active-filters");
		}
	},
	// reset all filters in the filter bar
	reset () {
		document.querySelectorAll(".select-filter").forEach(i => {
			if (i.dataset.value) {
				i.dataset.value = "";
				filters.fillSelect(i);
			}
		});
		filters.active();
		app.populateView();
	},
	// toggle filter bar
	toggleBar () {
		document.querySelector("#fun-filters").classList.toggle("active");
		document.querySelector("#filters").classList.toggle("visible");
	},
	// show or hide filter categories appropriate to the current view
	toggleCategories () {
		const status = document.querySelector("#filters-status"),
			hints = document.querySelector("#filters-hints");
		if (app.view === "xml") {
			status.classList.remove("off");
			hints.classList.add("off");
		} else if (app.view === "hints") {
			status.classList.remove("off");
			hints.classList.remove("off");
		} else if (app.view === "search") {
			status.classList.remove("off");
			hints.classList.add("off");
		} else {
			status.classList.add("off");
			hints.classList.add("off");
		}
	},
};
