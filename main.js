"use strict";

/***** LOAD MODULES *****/

// Electron modules
const { app, BrowserWindow, ipcMain, Menu, nativeImage } = require("electron"),
	display = require("electron").screen;

// Node.js modules
const fsp = require("fs").promises,
	path = require("path");

// costum modules
const popup = require("./js/main/popup"),
	services = require("./js/main/services"),
	xml = require("./js/main/xml");


/***** ERRORS *****/

let error = {
	// register an error in main.js
	//   err = object
	register (err) {
		let e = `\n----- ${new Date().toISOString()} -----\n`;
		e += "main.js\n";
		e += err.stack + "\n";
		error.log(e);
	},
	// log variables
	logFile: path.join(app.getPath("userData"), "error.log"),
	logStash: "", // in case many errors appear in fast succession
	logTimeout: null,
	// write recent errors to log file
	//   err = string
	log (err) {
		clearTimeout(error.logTimeout);
		error.logStash += err;
		error.logTimeout = setTimeout(() => {
			fsp.appendFile(error.logFile, error.logStash)
				.then(() => error.logStash = "");
		}, 5e3);
	},
};

process.on("uncaughtException", err => error.register(err));
process.on("unhandledRejection", err => error.register(err));


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
				label: "XML",
				icon: path.join(__dirname, "img", "main", "xml.png"),
				click: () => winMenu.execute("xml"),
			},
			{
				label: "Hinweise",
				icon: path.join(__dirname, "img", "main", "info.png"),
				click: () => winMenu.execute("hints"),
			},
			{
				label: "Clusterei",
				icon: path.join(__dirname, "img", "main", "clusters.png"),
				click: () => winMenu.execute("clusters"),
			},
			{
				label: "Suche",
				icon: path.join(__dirname, "img", "main", "search.png"),
				click: () => winMenu.execute("search"),
				accelerator: "CommandOrControl+F",
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
				click: () => win.closeAll([]),
				accelerator: "CommandOrControl+Q",
			},
		],
	},
	{
		label: "&Funktionen",
		submenu: [
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
				label: "Teaser-Tags",
				icon: path.join(__dirname, "img", "main", "xml.png"),
				click: () => winMenu.execute("teaser-tags"),
			},
		],
	},
];

let menuPv = [
	{
		label: "&QS",
		submenu: [
			{
				label: "Fenster schließen",
				icon: path.join(__dirname, "img", "main", "close.png"),
				click: () => win.close(),
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
		],
	},
	{
		label: "&Funktionen",
		submenu: [
			{
				label: "Update",
				icon: path.join(__dirname, "img", "main", "view-refresh.png"),
				click: () => winMenu.execute("update"),
				accelerator: "F5",
			},
			{
				label: "Neues Fenster",
				icon: path.join(__dirname, "img", "main", "window-new.png"),
				click: () => winMenu.execute("new"),
				accelerator: "CommandOrControl+N",
			},
		],
	},
];

let menuWin = [
	{
		label: "&QS",
		submenu: [
			{
				label: "Fenster schließen",
				icon: path.join(__dirname, "img", "main", "close.png"),
				click: () => win.close(),
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
				icon: path.join(__dirname, "img", "main", "help.png"),
				click: () => win.infoOpen("help"),
				accelerator: "F1",
			},
			{ type: "separator" },
			{
				label: "Updates",
				click: () => winMenu.execute("app-updates"),
			},
			{
				label: "Fehlerlog",
				click: () => winMenu.execute("error-log"),
			},
			{ type: "separator" },
			{
				label: "Über QS",
				icon: path.join(__dirname, "img", "main", "info.png"),
				click: () => win.infoOpen("about"),
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
		if (type === "about") {
			menu = menuWin;
		} else if (type === "app") {
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
	// data of currently open windows; filled with objects:
	//   bw = object (browser window)
	//   id = integer (window ID)
	//   type = string (about | app | help | pv)
	//   xml = string (name of XML file shown in pv window, otherwise empty string)
	data: [],
	// open new window
	//   type = string (about | app | help | pv)
	//   xml = object | undefined (see win.pvOpen())
	open (type, xml = {}) {
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
					width: 750,
					height: 400,
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
		if (type === "about") {
			bwOptions.parent = win.data.find(i => i.type === "app").bw;
			bwOptions.modal = true;
			bwOptions.center = true;
			bwOptions.resizable = false;
			bwOptions.minimizable = false;
			bwOptions.maximizable = false;
			// determine how the height of the window should be calculated
			// (Linux works different in this respect)
			if (/darwin|win32/.test(process.platform)) {
				bwOptions.webPreferences.useContentSize = true;
			}
		} else if (type === "pv") {
			// if this is the n-th preview window => let the system decide how to place it
			const pvWin = win.data.filter(i => i.type === "pv");
			if (pvWin.length > 0) {
				bwOptions.x = null;
				bwOptions.y = null;
			}
			// preview windows have <webview>
			bwOptions.webPreferences.webviewTag = true;
		}
		const bw = new BrowserWindow(bwOptions);
		// maximize window?
		if (data.maximized) {
			bw.maximize();
		}
		// memorize window
		win.data.push({
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
			for (let i = 0, len = win.data.length; i < len; i++) {
				if (win.data[i].id === this.id) {
					idx = i;
					type = win.data[i].type;
					break;
				}
			}
			// close every other window and
			// save preferences when the main window is about to be closed
			if (type === "app" && typeof prefs.saved === "undefined") {
				evt.preventDefault();
				// close every other window
				await win.closeAll(["app"]);
				// save preferences
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
			if (type !== "about") {
				const data = prefs.data.win[type],
					bounds = win.data[idx].bw.getBounds();
				data.x = bounds.x;
				data.y = bounds.y;
				data.width = bounds.width;
				data.height = bounds.height;
				data.maximized = win.data[idx].bw.isMaximized();
			}
			// dereference window
			win.data.splice(idx, 1);
		});
	},
	// open an informational window
	//   type = string (about | help)
	infoOpen (type) {
		const w = win.data.find(i => i.type === type);
		if (w) {
			w.bw.focus();
		} else {
			win.open(type);
		}
	},
	// close the currently active (i.e. focused) window
	close () {
		const bw = BrowserWindow.getFocusedWindow();
		bw.close();
	},
	// close all windows
	//   exclude = array (exclude windows the given window types from closing)
	async closeAll (exclude) {
		for (let i = win.data.length - 1; i >= 0; i--) {
			const w = win.data[i];
			if (w.type === "app" || // the main window should remain open until last
					exclude.includes(w.type)) { // exclude this window type from closing
				continue;
			}
			w.bw.close();
			await new Promise(resolve => setTimeout(() => resolve(true), 50));
		}
		if (!exclude.includes("app")) {
			win.data[0].bw.close();
		}
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
	//     winId = integer (window ID)
	pvOpen (args) {
		for (const i of win.data) {
			if (!args.winId && i.xml === args.file ||
					args.winId && i.id === args.winId) {
				win.pvSend(i.bw, args);
				return;
			}
		}
		win.open("pv", args);
	},
	// close all preview windows
	pvCloseAll () {
		let exclude = [];
		for (const w of win.data) {
			if (w.type !== "pv") {
				exclude.push(w.type);
			}
		}
		win.closeAll(exclude);
	},
	// send data to preview window
	//   bw = object (browser window)
	//   args = object (see win.pvOpen())
	async pvSend (bw, args) {
		// get XML file
		const xmlPath = path.join(args.git, args.dir, args.file),
			exists = await services.exists(xmlPath);
		args.xml = "";
		if (exists) {
			const xmlFiles = await xml.getFile(args.git, args.dir, args.file);
			if (xmlFiles[args.file]) {
				args.xml = xmlFiles[args.file].xml;
				// update file data in main window
				const appWin = win.data.find(i => i.type === "app");
				appWin.bw.webContents.send("update-file", xmlFiles);
			}
		}
		// send data
		bw.webContents.send("update", args);
		// focus window
		// (this is important in case the window already exists)
		bw.focus();
	},
};


/***** APP EVENTS *****/

// focus existing app window in case a second instance is opened
app.on("second-instance", () => {
	for (const i of win.data) {
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
	// open app window
	win.open("app");
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
	for (const i of win.data) {
		if (i.type === "app") {
			appWinExists = true;
			break;
		}
	}
	if (!appWinExists) {
		win.open("app");
	}
});


/***** RENDERER REQUESTS *****/

ipcMain.handle("app-info", evt => {
	const bw = BrowserWindow.fromWebContents(evt.sender);
	return {
		appPath: app.getAppPath(),
		documents: app.getPath("documents"),
		packaged: app.isPackaged,
		temp: app.getPath("temp"),
		userData: app.getPath("userData"),
		version: app.getVersion(),
		winId: bw.id,
	};
});

ipcMain.handle("close", evt => {
	const bw = BrowserWindow.fromWebContents(evt.sender);
	bw.close();
});

ipcMain.handle("error", async (evt, err) => error.log(err));

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

ipcMain.handle("popup", (evt, items) => popup.make(evt.sender, items));

ipcMain.handle("prefs", () => prefs.data.options);

ipcMain.handle("prefs-save", async (evt, options) => {
	prefs.data.options = options;
	await prefs.write();
	if (typeof prefs.saved !== "undefined") {
		prefs.saved = true;
	}
});

ipcMain.handle("pv", (evt, args) => win.pvOpen(args));

ipcMain.handle("pv-close-all", () => win.pvCloseAll());

ipcMain.handle("pv-new", (evt, args) => win.open("pv", args));

ipcMain.handle("xml-files", async (evt, repoDir) => await xml.getFiles(repoDir));
