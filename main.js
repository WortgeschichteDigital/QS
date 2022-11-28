"use strict";

/***** LOAD MODULES *****/

// Electron modules
const { app, BrowserWindow, ipcMain, Menu, nativeImage } = require("electron"),
	display = require("electron").screen;

// Node.js modules
const fsp = require("fs").promises,
	path = require("path");

// costum modules
const services = require("./js/main/services"),
	xml = require("./js/main/xml");


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
				label: "Suche",
				icon: path.join(__dirname, "img", "main", "search.png"),
				click: () => winMenu.execute("search"),
				accelerator: "CommandOrControl+F",
			},
			{
				label: "Filter",
				icon: path.join(__dirname, "img", "main", "filter.png"),
				click: () => winMenu.execute("filters"),
				accelerator: "CommandOrControl+Shift+F",
			},
			{
				label: "Update",
				icon: path.join(__dirname, "img", "main", "view-refresh.png"),
				click: () => winMenu.execute("update"),
				accelerator: "F5",
			},
			{ type: "separator" },
			{
				label: "Einstellungen",
				icon: path.join(__dirname, "img", "main", "preferences.png"),
				click: () => winMenu.execute("preferences"),
			},
			{ type: "separator" },
			{
				label: "Beenden",
				icon: path.join(__dirname, "img", "main", "exit.png"),
				click: () => winMenu.quitApp(),
				accelerator: "CommandOrControl+Q",
			},
		],
	},
];

let menuPv = [
	{
		label: "&QS",
		submenu: [
			{
				label: "Schließen",
				icon: path.join(__dirname, "img", "main", "close.png"),
				click: () => winMenu.closeWin(),
				accelerator: "CommandOrControl+W",
			},
		],
	},
	{
		label: "&Navigation",
		submenu: [
			{
				label: "Zurück",
				icon: path.join(__dirname, "img", "main", "nav-back.png"),
				click: () => winMenu.execute("nav-back"),
				accelerator: "Alt+Left",
			},
			{
				label: "Vorwärts",
				icon: path.join(__dirname, "img", "main", "nav-forward.png"),
				click: () => winMenu.execute("nav-forward"),
				accelerator: "Alt+Right",
			},
			{ type: "separator" },
			{
				label: "XML-Vorschau",
				icon: path.join(__dirname, "img", "main", "xml.png"),
				click: () => winMenu.execute("nav-xml"),
				accelerator: "Alt+Home",
			},
			{ type: "separator" },
			{
				label: "Update",
				icon: path.join(__dirname, "img", "main", "view-refresh.png"),
				click: () => winMenu.execute("nav-update"),
				accelerator: "F5",
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
				icon: path.join(__dirname, "img", "main", "close.png"),
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
				icon: path.join(__dirname, "img", "main", "question.png"),
				// click: () => win.bw.webContents.send("show-handbook"),
				accelerator: "F1",
			},
			{ type: "separator" },
			{
				label: "Updates",
				// click: () => win.bw.webContents.send("show-handbook"),
			},
			{
				label: "Fehlerlog",
				// click: () => win.bw.webContents.send("show-handbook"),
			},
			{ type: "separator" },
			{
				label: "Über QS",
				icon: path.join(__dirname, "img", "main", "info.png"),
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
		} else if (type === "pv") {
			for (const i of [menuPv, menuAll]) {
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
	// execute a command from the app menu
	//   command = string
	execute (command) {
		const bw = BrowserWindow.getFocusedWindow();
		bw.webContents.send("menu-" + command);
	},
	// close the focused window
	closeWin () {
		const bw = BrowserWindow.getFocusedWindow();
		bw.close();
	},
	// close all windows and quit the app
	async quitApp () {
		for (const w of win.open) {
			if (w.type === "app") {
				// the main window should remain until last
				continue;
			}
			w.bw.close();
			await new Promise(resolve => setTimeout(() => resolve(true), 50));
		}
		win.open[0].bw.close();
	},
};


/***** PREFERENCES *****/

let prefs = {
	data: {
		git: {
			dir: "",
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
		const content = await fsp.readFile(prefs.file, { encoding: "utf8" });
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
	write () {
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
	// currently open windows; filled with objects:
	//   bw = object (browser window)
	//   id = integer (window ID)
	//   type = string (about | app | help | pv)
	//   xml = string (name of XML file shown in pv window, otherwise empty string)
	open: [],
	// create window
	//   type = string (about | app | help | pv)
	//   xml = object | undefined (see win.pv())
	create (type, xml = {}) {
		// define window dimensions
		const workArea = display.getPrimaryDisplay().workArea,
			data = prefs.data.win[type],
			x = data.x >= 0 ? data.x : null,
			y = data.y >= 0 ? data.y : null,
			width = data.width ? data.width : defaults().width,
			height = data.height ? data.height : defaults().height;
		function defaults () {
			if (type === "about") {
				return {
					width: 700,
					height: 250,
				};
			} else {
				return {
					width: 1000,
					height: workArea.height,
				};
			}
		}
		// win title
		const title = {
			about: "QS / Über",
			app: "QS",
			help: "QS / Hilfe",
			pv: "QS / " + xml.file,
		};
		// open window
		let bwOptions = {
			title: title[type],
			icon: win.icon(),
			backgroundColor: "#fff",
			x,
			y,
			width,
			minWidth: 700,
			height,
			minHeight: 700,
			show: false,
			webPreferences: {
				contextIsolation: false,
				nodeIntegration: true,
				enableRemoteModule: false,
				devTools: !app.isPackaged,
				defaultEncoding: "utf-8",
				spellcheck: false,
			},
		};
		if (type === "pv") {
			bwOptions.webPreferences.webviewTag = true;
		}
		const bw = new BrowserWindow(bwOptions);
		// maximize window?
		if (data.maximized) {
			bw.maximize();
		}
		// memorize window
		win.open.push({
			bw,
			id: bw.id,
			type,
			xml: xml.file || "",
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
		// send XML data if necessary
		if (type === "pv") {
			bw.webContents.once("did-finish-load", function() {
				const bw = BrowserWindow.fromWebContents(this);
				win.pvSend(bw, xml);
			});
		}
		// window is going to be closed
		bw.on("close", async function(evt) {
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
			// save preferences if type main window is about to be closed
			if (type === "app" && typeof prefs.saved === "undefined") {
				evt.preventDefault();
				prefs.saved = false;
				this.webContents.send("save-prefs");
				await new Promise(resolve => {
					const interval = setInterval(() => {
						if (prefs.saved) {
							clearInterval(interval);
							resolve(true);
						}
					}, 25);
				});
				this.close();
				return;
			}
			// save window size and state
			const data = prefs.data.win[type],
				bounds = win.open[idx].bw.getBounds();
			data.x = bounds.x;
			data.y = bounds.y;
			data.width = bounds.width;
			data.height = bounds.height;
			data.maximized = win.open[idx].bw.isMaximized();
			// dereference window
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
	// open or focus preview window
	//   args = object
	//     dir = string (articles | ignore)
	//     file = string (XML file name)
	//     git = string (path to git directory)
	pv (args) {
		for (const i of win.open) {
			if (i.xml === args.file) {
				win.pvSend(i.bw, args);
				return;
			}
		}
		win.create("pv", args);
	},
	// send data to preview window
	async pvSend (bw, args) {
		// get XML file
		const xmlPath = path.join(args.git, args.dir, args.file),
			exists = await services.exists(xmlPath);
		if (!exists) {
			return;
		}
		const contents = await xml.getFile(xmlPath);
		if (!contents) {
			return;
		}
		// send data
		args.xml = contents;
		bw.webContents.send("update", args);
		// focus window
		// (this is important in case the window already exists)
		bw.focus();
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

// reactivate app
app.on("activate", () => {
	// on macOS the window object might already exist;
	// in this case, we don't need to create the app window
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

ipcMain.handle("app-info", () => {
	return {
		documents: app.getPath("documents"),
		temp: app.getPath("temp"),
		userData: app.getPath("userData"),
	};
});

ipcMain.handle("exists", async (evt, path) => await services.exists(path));

ipcMain.handle("file-dialog", async (evt, open, options) => {
	const bw = BrowserWindow.fromWebContents(evt.sender);
	return await services.fileDialog({ bw, open, options });
});

ipcMain.handle("git-config", () => prefs.data.git);

ipcMain.handle("git-save", (evt, config) => {
	prefs.data.git = config;
	prefs.write();
});

ipcMain.handle("list-of-images", async () => await services.svg());

ipcMain.handle("prefs", () => prefs.data.options);

ipcMain.handle("prefs-save", async (evt, options) => {
	prefs.data.options = options;
	await prefs.write();
	if (typeof prefs.saved !== "undefined") {
		prefs.saved = true;
	}
});

ipcMain.handle("pv", (evt, args) => win.pv(args));

ipcMain.handle("xml-files", async (evt, repoDir) => await xml.getFiles(repoDir));
