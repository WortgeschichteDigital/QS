"use strict";

/***** LOAD MODULES *****/

// Electron modules
const { app, BrowserWindow, ipcMain, Menu, nativeImage } = require("electron"),
	display = require("electron").screen;

// Node.js modules
const fsp = require("fs").promises,
	path = require("path");

// costum modules
const services = require("./js/main/services");


/***** SINGLE INSTANCE LOCK *****/

if (!app.requestSingleInstanceLock()) {
	app.quit();
	process.exit(0);
}


/***** WINDOW MENU *****/

let menuApp = [
	{
		label: "&QS",
		submenu: [
			{
				label: "Einstellungen",
				icon: path.join(__dirname, "img", "main", "configure.png"),
				// click: () => win.bw.webContents.send("load-language"),
			},
			{ type: "separator" },
			{
				label: "Beenden",
				icon: path.join(__dirname, "img", "main", "application-exit.png"),
				// click: () => win.bw.webContents.send("hist-bar"),
				accelerator: "CommandOrControl+Q",
			},
		],
	},
];

let menuWin = [
	{
		label: "&QS",
		submenu: [
			{
				label: "Schließen",
				icon: path.join(__dirname, "img", "main", "window-close.png"),
				// click: () => win.bw.webContents.send("hist-bar"),
				accelerator: "CommandOrControl+W",
			},
		],
	},
];

let menuAll = [
	{
		label: "&Bearbeiten",
		submenu: [
			{
				label: "Rückgängig",
				icon: path.join(__dirname, "img", "main", "edit-undo.png"),
				role: "undo",
			},
			{
				label: "Wiederherstellen",
				icon: path.join(__dirname, "img", "main", "edit-redo.png"),
				role: "redo",
			},
			{ type: "separator" },
			{
				label: "Ausschneiden",
				icon: path.join(__dirname, "img", "main", "edit-cut.png"),
				role: "cut",
			},
			{
				label: "Kopieren",
				icon: path.join(__dirname, "img", "main", "edit-copy.png"),
				role: "copy",
			},
			{
				label: "Einfügen",
				icon: path.join(__dirname, "img", "main", "edit-paste.png"),
				role: "paste",
			},
			{ type: "separator" },
			{
				label: "Alles auswählen",
				icon: path.join(__dirname, "img", "main", "edit-select-all.png"),
				role: "selectAll",
			},
		],
	},
	{
		label: "&Ansicht",
		submenu: [
			{
				label: "Anzeige vergrößern",
				icon: path.join(__dirname, "img", "main", "zoom-in.png"),
				role: "zoomIn",
				accelerator: "CommandOrControl+=", // Electron-BUG: otherwise Ctrl + Plus doesn't work
			},
			{
				label: "Anzeige verkleinern",
				icon: path.join(__dirname, "img", "main", "zoom-out.png"),
				role: "zoomOut",
			},
			{
				label: "Standardgröße",
				icon: path.join(__dirname, "img", "main", "zoom-original.png"),
				role: "resetZoom",
			},
			{ type: "separator" },
			{
				label: "Vollbild",
				icon: path.join(__dirname, "img", "main", "view-fullscreen.png"),
				role: "toggleFullScreen",
			},
		],
	},
];

let menuHelp = [
	{
		label: "&Hilfe",
		submenu: [
			{
				label: "Handbuch",
				icon: path.join(__dirname, "img", "main", "emblem-question.png"),
				// click: () => win.bw.webContents.send("show-handbook"),
				accelerator: "F1",
			},
			{ type: "separator" },
			{
				label: "Updates",
				icon: path.join(__dirname, "img", "main", "view-refresh.png"),
				// click: () => win.bw.webContents.send("show-handbook"),
			},
			{
				label: "Fehlerlog",
				icon: path.join(__dirname, "img", "main", "dialog-error.png"),
				// click: () => win.bw.webContents.send("show-handbook"),
			},
			{ type: "separator" },
			{
				label: "Über QS",
				icon: path.join(__dirname, "img", "main", "help-about.png"),
				// click: () => win.bw.webContents.send("show-handbook"),
			},
		],
	},
];

let menuDev = [
	{
		label: "&Dev",
		submenu: [
			{
				role: "reload",
				accelerator: "F5",
			},
			{
				role: "forceReload",
			},
			{
				role: "toggleDevTools",
			},
		],
	},
];

let winMenu = {
	// set window menu
	//   bw = object (browser window)
	//   type = string (about | app | help | pv)
	set (bw, type) {
		// build window specific app menu
		let menu = [];
		if (type === "app") {
			for (const i of [menuApp, menuAll, menuHelp]) {
				menu = menu.concat(i);
			}
		} else {
			for (const i of [menuWin, menuAll]) {
				menu = menu.concat(i);
			}
		}
		if (!app.isPackaged) {
			menu = menu.concat(menuDev);
		}
		// remove ampersands on macOS
		if (process.platform === "darwin") {
			for (const i of menu) {
				i.label = i.label.replace("&", "");
			}
		}
		// build and set the mneu
		const m = Menu.buildFromTemplate(menu);
		bw.setMenu(m);
	},
};


/***** PREFERENCES *****/

let prefs = {
	data: {
		git: {
			dir: [],
			user: "",
		},
		options: {},
		win: {},
	},
	// path to preferences file
	file: path.join(app.getPath("userData"), "preferences.json"),
	// read preferences
	async read () {
		const exists = await services.exists(prefs.file);
		if (!exists) {
			return false;
		}
		const content = await fsp.readFile(prefs.file, {encoding: "utf8"});
		try {
			prefs.data = JSON.parse(content);
			return true;
		} catch {
			// the preferences file is corrupt => erase it
			fsp.unlink(prefs.file);
			return false;
		}
	},
	// write preferences
	async write () {
		return new Promise(resolve => {
			fsp.writeFile(prefs.file, JSON.stringify(prefs.data))
				.then(() => resolve(true))
				.catch(() => resolve(false));
		});
	},
};

for (const i of ["about", "app", "help", "pv"]) {
	prefs.data.win[i] = {
		x: -1,
		y: -1,
		width: 0,
		height: 0,
		maximized: false,
	};
}


/***** APP WINDOWS *****/

let win = {
	// currently open windows; contains objects:
	//   bw = object (browser window)
	//   id = integer (window ID)
	//   type = string (about | app | help | pv)
	open: [],
	// create window
	//   type = string (about | app | help | pv)
	//   xmlFile = string | undefined (title of xmlFile shown in pv window)
	create (type, xmlFile = "") {
		// define window dimensions
		const data = prefs.data.win[type],
			x = data.x >= 0 ? data.x : null,
			y = data.y >= 0 ? data.y : null,
			width = data.width ? data.width : 800,
			height = data.height ? data.height : display.getPrimaryDisplay().workArea.height;
		// win title
		const title = {
			about: "QS / Über",
			app: "QS",
			help: "QS / Hilfe",
			pv: "QS / " + xmlFile,
		};
		// open window
		const bw = new BrowserWindow({
			title: title[type],
			icon: win.icon(),
			backgroundColor: "#fff",
			x,
			y,
			width,
			minWidth: 600,
			height,
			minHeight: 400,
			show: false,
			webPreferences: {
				contextIsolation: false,
				nodeIntegration: true,
				enableRemoteModule: false,
				devTools: !app.isPackaged,
				defaultEncoding: "utf-8",
				spellcheck: false,
			},
		});
		// maximize window?
		if (data.maximized) {
			bw.maximize();
		}
		// memorize window
		win.open.push({
			bw,
			id: bw.id,
			type,
		});
		// set menu
		winMenu.set(bw, type);
		// load html
		const html = {
			about: path.join(__dirname, "win", "about.html"),
			app: path.join(__dirname, "start.html"),
			help: path.join(__dirname, "win", "help.html"),
			pv: path.join(__dirname, "win", "pv.html"),
		};
		bw.loadFile(html[type]);
		// focus window (otherwise it might not be in the foreground)
		win.focus(bw);
		// show window (this prevents flickering on startup)
		bw.once("ready-to-show", () => bw.show());
		// window is going to be closed
		bw.on("close", function() {
			// search window
			let idx = -1,
				type = "";
			for (let i = 0, len = win.open.length; i < len; i++) {
				if (win.open[i].id === this.id) {
					idx = i;
					type = win.open[i].type;
					break;
				}
			}
			// save window size and state
			const data = prefs.data.win[type],
				bounds = win.open[idx].bw.getBounds();
			data.x = bounds.x;
			data.y = bounds.y;
			data.width = bounds.width;
			data.height = bounds.height;
			data.maximized = win.open[idx].bw.isMaximized();
			// drop window
			win.open.splice(idx, 1);
		});
	},
	// make app icon
	icon () {
		if (process.platform === "win32") {
			return nativeImage.createFromPath(path.join(__dirname, "img", "icon", "win", "icon.ico"));
		} else if (process.platform === "darwin") {
			return nativeImage.createFromPath(path.join(__dirname, "img", "icon", "mac", "icon.icns"));
		} else {
			return nativeImage.createFromPath(path.join(__dirname, "img", "icon", "linux", "icon-64px.png"));
		}
	},
	// focus the app window
	//   bw = object (browser window)
	focus (bw) {
		if (bw.isMinimized()) {
			bw.restore();
		}
		setTimeout(() => bw.focus(), 25);
	},
};


/***** APP EVENTS *****/

// focus existing app window in case a second instance is opened
app.on("second-instance", () => {
	for (const i of win.open) {
		if (i.type === "app") {
			i.bw.focus();
			break;
		}
	}
});

// app initialized => open app window
app.on("ready", async () => {
	// read preferences
	await prefs.read();
	// create app window
	win.create("app");
});

// quit app when every window is closed
app.on("window-all-closed", async () => {
	// write preferences
	await prefs.write();
	// on macOS an app typically remains active
	// until the user quits it explicitly
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// reactive app
app.on("activate", () => {
	// on macOS the window object might already exist;
	// in tis case, we don't need to create the app window
	let appWinExists = false;
	for (const i of win.open) {
		if (i.type === "app") {
			appWinExists = true;
			break;
		}
	}
	if (!appWinExists) {
		win.create("app");
	}
});


/***** RENDERER REQUESTS *****/

ipcMain.handle("get-git-config", () => prefs.data.git);
