"use strict";

let viewHints = {
	// populate the view
	//   type = string (switched | updated)
	async populate (type) {
		await xml.updateWait();
		if (app.view !== "hints") {
			return;
		}
		app.resetViewScrollTop(type);
		// TODO
	},
};
