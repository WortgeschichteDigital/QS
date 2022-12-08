"use strict";

const { BrowserWindow, Menu, MenuItem } = require("electron"),
	path = require("path");

const items = {
	copyLink: {
		label: "Link kopieren",
		icon: "link.png",
		click: 'shared.clipboard.writeText(popup.element.getAttribute("href"))',
	},
	copyMail: {
		label: "Adresse kopieren",
		icon: "mail.png",
		click: 'shared.clipboard.writeText(popup.element.getAttribute("href").replace(/^mailto:/, ""))',
	},
	editUndo: {
		label: "Rückgängig",
		icon: "edit-undo.png",
		role: "undo",
	},
	editRedo: {
		label: "Wiederherstellen",
		icon: "edit-redo.png",
		role: "redo",
	},
	editCut: {
		label: "Ausschneiden",
		icon: "edit-cut.png",
		role: "cut",
	},
	editCopy: {
		label: "Kopieren",
		icon: "edit-copy.png",
		role: "copy",
	},
	editPaste: {
		label: "Einfügen",
		icon: "edit-paste.png",
		role: "paste",
	},
	editSelectAll: {
		label: "Alles auswählen",
		icon: "edit-select-all.png",
		role: "selectAll",
	},
	filtersReset: {
		label: "Filter zurücksetzen",
		icon: "cleanup.png",
		click: 'document.querySelector("#filters-reset").click()',
	},
};

// make separator
function makeSep () {
	return new MenuItem({
		type: "separator",
	});
}

// make menu item
//   wc = object (WebContents)
//   label = string (name of the menu item)
//   icon = string (PNG file)
//   click = string (functions to execute on click)
//   role = string (predefined menu role)
function makeItem ({ wc, label, icon, click = "", role = "" }) {
	let opt = {
		label,
		icon: path.join(__dirname, "../", "../", "img", "main", icon),
	};
	if (click) {
		opt.click = () => wc.executeJavaScript(click);
	}
	if (role) {
		opt.role = role;
	}
	return new MenuItem(opt);
}

module.exports = {
	// create popup menu
	//   wc = object (WebContents)
	//   list = array (list of menu items)
	make (wc, list) {
		// create new menu
		let menu = new Menu();
		for (const i of list) {
			if (i === "sep") {
				// separator
				menu.append(makeSep());
			} else {
				// menu item
				let args = {...items[i]};
				args.wc = wc;
				menu.append(makeItem(args));
			}
		}
		// show menu
		menu.popup({
			window: BrowserWindow.fromWebContents(wc),
		});
	},
};
