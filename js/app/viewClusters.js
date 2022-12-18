"use strict";

let viewClusters = {
	// last content state of this view
	contentState: {
		filterState: "", // hash
		xmlDate: "", // date of last XML update
	},
	// currently active filters
	filters: {},
	// update the view
	//   type = string (switched | updated)
	update (type) {
		// get current content state
		// (restore scroll position in case the state is unchanged)
		const filterState = app.getFilterState();
		if (filterState === viewClusters.contentState.filterState &&
				xml.data.date === viewClusters.contentState.xmlDate) {
			app.resetViewScrollTop(type);
			viewClusters.focusSearchField();
			return;
		}
		viewClusters.contentState.filterState = filterState;
		viewClusters.contentState.xmlDate = xml.data.date;
		// update domain
		viewClusters.filters = bars.getFiltersData();
		const domain = document.querySelector("#clusters-nav-domain");
		domain.textContent = viewClusters.filters["select-domains"] || "kein Themenfeld";
		if (viewClusters.filters["select-domains"]) {
			domain.classList.remove("no-domain");
		} else {
			domain.classList.add("no-domain");
		}
		// update sections TODO
		clustersMod.update();
		// focus search field in modulation section
		viewClusters.focusSearchField();
	},
	// focus search field in modulation section
	focusSearchField () {
		if (!document.querySelector("#clusters-modulate.off")) {
			document.querySelector("#clusters-modulate-search").select();
		}
	},
	// switch cluster sections
	//   icon = node
	switchSection (icon) {
		// no need to switch the section
		if (icon.classList.contains("active")) {
			return;
		}
		// switch section
		const id = "clusters-" + icon.id.replace(/.+-/, "");
		document.querySelectorAll("#clusters > div").forEach(i => {
			if (i.id === id) {
				i.classList.remove("off");
			} else {
				i.classList.add("off");
			}
		});
		// switch active icon
		document.querySelector(".clusters-view.active").classList.remove("active");
		icon.classList.add("active");
		// reset scroll
		window.scrollTo(0, 0);
		// focus search field in modulation section
		viewClusters.focusSearchField();
	},
	// preview: switch to or from clusters preview respectively
	previewSwitchMode () {
		// TODO
	},
};
