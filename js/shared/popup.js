"use strict";

let popup = {
	// element the event refers to
	element: null,
	// open popup
	//   evt = object
	open (evt) {
		// detect click target
		const target = popup.getTarget(evt.path);
		if (!target) {
			return;
		}
		// collect items
		let items = [],
			def = ["close"],
			defSep = ["sep"].concat(def);
		if (typeof app !== "undefined") {
			def = ["update", "sep", "viewXml", "viewHints", "viewClusters", "viewSearch"],
			defSep = ["sep"].concat(def);
		}
		if (target === "filters_reset") {
			items = ["filtersReset"].concat(defSep);
		} else if (target === "link") {
			items = ["copyLink"].concat(defSep);
		} else if (target === "mail") {
			items = ["copyMail"].concat(defSep);
		} else if (target === "results_bar") {
			items = ["results"].concat(defSep);
		} else if (target === "text_field") {
			items = ["editCut", "editCopy", "editPaste", "sep", "editSelectAll"];
		} else {
			items = def;
		}
		// cretae popup menu
		if (items.length) {
			shared.ipc.invoke("popup", items);
		}
	},
	// detect the matching target for the current right click
	//   path = array (save the event path, that is an element list
	//            by which the click event was called)
	getTarget (path) {
		for (let i = 0, len = path.length; i < len; i++) {
			// text field
			if (path[i].nodeName === "INPUT" &&
					path[i].type === "text") {
				return "text_field";
			}
			// ID
			const id = path[i].id;
			if (id === "fun-filters") {
				return "filters_reset";
			}
			// links
			const href = path[i].nodeType === 1 ? path[i].getAttribute("href") : "";
			if (/^https:/.test(href)) {
				popup.element = path[i];
				return "link";
			} else if (/^mailto:/.test(href)) {
				popup.element = path[i];
				return "mail";
			}
		}
		// overlay visible?
		if (overlay.top()) {
			return "";
		}
		// default popup menu
		if (typeof app !== "undefined" && /hints|search/.test(app.view)) {
			return "results_bar";
		}
		// default popup menu
		return "default";
	},
};
