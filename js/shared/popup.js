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
		let items = [];
		if (target === "text_field") {
			items = ["editUndo", "editRedo", "sep", "editCut", "editCopy", "editPaste", "editSelectAll"];
		} else if (target === "filters_reset") {
			items = ["filtersReset"];
		} else if (target === "link") {
			items = ["copyLink"];
		} else if (target === "mail") {
			items = ["copyMail"];
		}
		// cretae popup menu
		shared.ir.invoke("popup", items);
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
		// no popup menu
		return "";
	},
};
