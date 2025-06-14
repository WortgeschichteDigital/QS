
/* LOAD MODULES --------------------------------- */

// Electron modules
const {
  app,
  BaseWindow,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  WebContentsView,
} = require("electron");

// Node.js modules
const { promises: fsp } = require("fs");
const path = require("path");

// costum modules
const popup = require("./js/main/popup.cjs");
const services = require("./js/main/services.cjs");
const xml = require("./js/main/xml.cjs");


/* VARIABLES ------------------------------------ */

const dev = !app.isPackaged;


/* ERRORS --------------------------------------- */

const error = {
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
  // stash for errors in case many errors appear in fast succession
  logStash: "",
  // timeout so that the error log is not written too often
  logTimeout: undefined,

  // write recent errors to log file
  //   err = string
  log (err) {
    clearTimeout(error.logTimeout);
    error.logStash += err;
    error.logTimeout = setTimeout(() => {
      fsp.appendFile(error.logFile, error.logStash)
        .then(() => {
          error.logStash = "";
        });
    }, 5e3);
  },
};

process.on("uncaughtException", err => error.register(err));
process.on("unhandledRejection", err => error.register(err));


/* WINDOW MENU ---------------------------------- */

const winMenu = {
  // menu templates
  menuApp: [
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
    {
      label: "&Publikation",
      submenu: [
        {
          label: "Artikel.json",
          icon: path.join(__dirname, "img", "main", "json.png"),
          click: () => winMenu.execute("artikel-json"),
        },
        {
          label: "Artikelübersicht",
          icon: path.join(__dirname, "img", "main", "file.png"),
          click: () => winMenu.execute("overview"),
        },
        {
          label: "Terminologie",
          icon: path.join(__dirname, "img", "main", "file.png"),
          click: () => winMenu.execute("term"),
        },
        {
          label: "Wortverlaufskurven",
          icon: path.join(__dirname, "img", "main", "transform.png"),
          click: () => winMenu.execute("svg"),
        },
      ],
    },
  ],
  menuPv: [
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
          click: () => pv.nav(BaseWindow.getFocusedWindow(), "goBack"),
          accelerator: "Alt+Left",
        },
        {
          label: "Vorwärts",
          icon: path.join(__dirname, "img", "main", "nav-forward.png"),
          click: () => pv.nav(BaseWindow.getFocusedWindow(), "goForward"),
          accelerator: "Alt+Right",
        },
        { type: "separator" },
        {
          label: "XML-Vorschau",
          icon: path.join(__dirname, "img", "main", "xml.png"),
          click: () => {
            const bw = BaseWindow.getFocusedWindow();
            pv.open({
              winId: bw.id,
            });
          },
          accelerator: "F5",
        },
        {
          label: "Neues Fenster",
          icon: path.join(__dirname, "img", "main", "window-new.png"),
          click: () => pv.openNew(BaseWindow.getFocusedWindow()),
          accelerator: "CommandOrControl+N",
        },
      ],
    },
  ],
  menuWin: [
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
  ],
  menuWinHelp: [
    {
      label: "&Funktionen",
      submenu: [
        {
          label: "Suchen",
          icon: path.join(__dirname, "img", "main", "search.png"),
          click: () => winMenu.execute("search"),
          accelerator: "CommandOrControl+F",
        },
      ],
    },
  ],
  menuEdit: [
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
  ],
  menuView: [
    {
      label: "&Ansicht",
      submenu: [
        {
          label: "Anzeige vergrößern",
          icon: path.join(__dirname, "img", "main", "zoom-in.png"),
          role: "zoomIn",
          // Electron bug (otherwise Ctrl + Plus doesn't work)
          accelerator: "CommandOrControl+=",
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
  ],
  menuViewPv: [
    {
      label: "&Ansicht",
      submenu: [
        {
          label: "Anzeige vergrößern",
          icon: path.join(__dirname, "img", "main", "zoom-in.png"),
          click: () => pv.zoom("in"),
          // Electron bug (otherwise Ctrl + Plus doesn't work)
          accelerator: "CommandOrControl+=",
        },
        {
          label: "Anzeige verkleinern",
          icon: path.join(__dirname, "img", "main", "zoom-out.png"),
          click: () => pv.zoom("out"),
          accelerator: "CommandOrControl+-",
        },
        {
          label: "Standardgröße",
          icon: path.join(__dirname, "img", "main", "zoom-original.png"),
          click: () => pv.zoom("original"),
          accelerator: "CommandOrControl+0",
        },
        { type: "separator" },
        {
          label: "Vollbild",
          icon: path.join(__dirname, "img", "main", "view-fullscreen.png"),
          role: "toggleFullScreen",
        },
      ],
    },
  ],
  menuHelp: [
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
  ],
  menuDev: [
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
  ],
  menuDevPv: [
    {
      label: "&Dev",
      submenu: [
        {
          label: "Developer Tools",
          click: () => {
            const bw = BaseWindow.getFocusedWindow();
            const { wvBase } = win.data.find(i => i.id === bw.id);
            wvBase.webContents.openDevTools();
          },
          accelerator: "CommandOrControl+Shift+I",
        },
      ],
    },
  ],

  // set window menu
  //   bw = object (browser or base window)
  //   type = string (about | app | help | pv)
  set (bw, type) {
    // build window specific app menu
    let menu = [];
    if (type === "about") {
      menu = winMenu.menuWin;
    } else if (type === "app") {
      for (const i of [ winMenu.menuApp, winMenu.menuEdit, winMenu.menuView, winMenu.menuHelp ]) {
        menu = menu.concat(i);
      }
    } else if (type === "pv") {
      for (const i of [ winMenu.menuPv, winMenu.menuEdit, winMenu.menuViewPv ]) {
        menu = menu.concat(i);
      }
    } else if (type === "help") {
      for (const i of [ winMenu.menuWin, winMenu.menuWinHelp, winMenu.menuEdit, winMenu.menuView ]) {
        menu = menu.concat(i);
      }
    } else {
      for (const i of [ winMenu.menuWin, winMenu.menuEdit, winMenu.menuView ]) {
        menu = menu.concat(i);
      }
    }
    if (dev) {
      menu = menu.concat(type === "pv" ? winMenu.menuDevPv : winMenu.menuDev);
    }

    // remove ampersands on macOS
    if (process.platform === "darwin") {
      for (const i of menu) {
        i.label = i.label.replace("&", "");
      }
    }

    // build and set the menu
    const m = Menu.buildFromTemplate(menu);
    if (process.platform === "darwin") {
      Menu.setApplicationMenu(m);
    } else {
      bw.setMenu(m);
      if (type === "about") {
        bw.setMenuBarVisibility(false);
      }
    }
  },

  // execute a command from the app menu
  //   command = string
  execute (command) {
    const bw = BrowserWindow.getFocusedWindow();
    bw.webContents.send("menu-" + command);
  },
};


/* PREFERENCES ---------------------------------- */

const prefs = {
  // contents of preferences.json
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

for (const i of [ "about", "app", "help", "pv" ]) {
  prefs.data.win[i] = {
    x: -1,
    y: -1,
    width: 0,
    height: 0,
    maximized: false,
  };
}


/* APP WINDOWS ---------------------------------- */

const win = {
  // data of currently open windows; filled with objects:
  //   bw = object (browser or base window)
  //   id = integer (window ID)
  //   type = string (about | app | cli | help | pv | worker)
  //   wvBase = object (null | in "pv" windows: web contents with header)
  //   wvWeb = object (null | in "pv" windows: web contents with XML preview)
  //   xml = object (empty | in "pv" wndows: data regarding the XML preview)
  //     dir = string (articles | ignore)
  //     file = string (XML file name)
  //     git = string (path to git directory)
  data: [],

  // open new window
  //   show = object | undefined (show section in help window)
  //   type = string (about | app | cli | help | pv)
  //   xml = object | undefined (see win.data)
  open ({ show = null, type, xml = {} }) {
    // define window dimensions
    const { workArea } = screen.getPrimaryDisplay();
    const data = prefs.data.win[type] || {};
    const x = data.x >= 0 ? data.x : undefined;
    const y = data.y >= 0 ? data.y : undefined;
    const width = data.width ? data.width : defaults().width;
    const height = data.height ? data.height : defaults().height;
    function defaults () {
      if (type === "about") {
        return {
          width: 750,
          height: 405,
        };
      }
      return {
        width: 1000,
        height: workArea.height,
      };
    }
    // win title
    const title = {
      about: "QS / Über",
      app: "QS",
      cli: "QS",
      help: "QS / Hilfe",
      pv: "QS / " + xml.file,
    };

    // open window
    const bwOptions = {
      title: title[type],
      icon: win.icon(),
      backgroundColor: "#fff",
      x,
      y,
      width,
      minWidth: 700,
      height,
      minHeight: 700,
      useContentSize: type === "about",
      show: false,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: false,
        defaultEncoding: "UTF-8",
        devTools: dev,
        nodeIntegration: true,
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
    }
    let bw;
    let wvBase = null;
    let wvWeb = null;
    if (type === "pv") {
      // if this is the n-th preview window => let the system decide how to place it
      const pvWin = win.data.filter(i => i.type === "pv");
      if (pvWin.length > 0) {
        bwOptions.x = undefined;
        bwOptions.y = undefined;
      }

      // remove webPreferences
      delete bwOptions.webPreferences;

      // create base window
      bw = new BaseWindow(bwOptions);

      // create web contents: base
      wvBase = new WebContentsView({
        webPreferences: {
          contextIsolation: true,
          defaultEncoding: "UTF-8",
          devTools: dev,
          nodeIntegration: false,
          preload: path.join(__dirname, "js", "html", "pvPreload.js"),
          sandbox: true,
          spellcheck: false,
        },
      });
      bw.contentView.addChildView(wvBase);
      wvBase.webContents.loadFile(path.join(__dirname, "html", "pv.html"));

      // create web contents: web
      wvWeb = new WebContentsView();
      bw.contentView.addChildView(wvWeb);
      wvWeb.setVisible(false);
      wvWeb.webContents.loadFile(path.join(__dirname, "html", "pvLoading.html"));
      wvWeb.webContents.on("did-finish-load", function () {
        const bw = BrowserWindow.fromWebContents(this);
        const { wvBase } = win.data.find(i => i.id === bw.id);
        wvBase.webContents.send("update-icons", {
          canGoBack: this.navigationHistory.canGoBack(),
          canGoForward: this.navigationHistory.canGoForward(),
        });
      });
      wvWeb.webContents.on("did-fail-load", function () {
        const url = new URL(this.getURL());
        if (url.host === "www.zdl.org" && url.pathname === "/wb/wortgeschichten/pv") {
          const bw = BrowserWindow.fromWebContents(this);
          const data = win.data.find(i => i.id === bw.id);
          pv.load(bw, data.xml);
        } else {
          this.send("update-icons", {
            canGoBack: this.navigationHistory.canGoBack(),
            canGoForward: this.navigationHistory.canGoForward(),
          });
        }
      });

      // append resize action
      let resize;
      bw.on("resize", function () {
        clearTimeout(resize);
        resize = setTimeout(() => pv.setBounds(this), 25);
      });
    } else {
      bw = new BrowserWindow(bwOptions);
    }

    // maximize window?
    if (data.maximized) {
      bw.maximize();
    }

    // memorize window
    win.data.push({
      bw,
      id: bw.id,
      type,
      wvBase,
      wvWeb,
      xml,
    });

    // set menu
    if (type !== "cli") {
      if (process.platform === "darwin") {
        bw.on("focus", function () {
          winMenu.set(this, win.data.find(i => i.id === this.id).type);
        });
      } else {
        winMenu.set(bw, type);
      }
    }

    // load html
    if (type !== "pv") {
      const html = {
        about: path.join(__dirname, "html", "about.html"),
        app: path.join(__dirname, "win.html"),
        cli: path.join(__dirname, "win.html"),
        help: path.join(__dirname, "html", "help.html"),
      };
      if (dev) {
        // no cache while developing
        bw.loadURL("file://" + html[type], {
          extraHeaders: "pragma: no-cache\n",
        });
      } else {
        bw.loadFile(html[type]);
      }
    }

    // focus window (otherwise it might not be in the foreground)
    if (type !== "cli") {
      win.focus(bw);
    }

    // show window (this prevents flickering on startup)
    if (type !== "cli" && type !== "pv") {
      bw.once("ready-to-show", () => bw.show());
    }

    // send data if necessary
    if (type === "cli") {
      // pass CLI commands
      bw.webContents.once("did-finish-load", function () {
        setTimeout(() => {
          // timeout makes absolutely sure that the window is already listening
          const bw = BrowserWindow.fromWebContents(this);
          bw.webContents.send("cli-command", cliCommand);
        }, 100);
      });
    } else if (type === "pv") {
      // show window and load XML file for preview
      // (WORKAROUND: currently, base windows do not emit the "ready-to-show" event)
      wvBase.webContents.once("did-finish-load", function () {
        const bw = BrowserWindow.fromWebContents(this);
        const { wvWeb } = win.data.find(i => i.id === bw.id);

        // set bounds
        pv.setBounds(bw);

        // show window
        bw.show();

        // ensure a smooth loading of the contents of the window
        setTimeout(() => {
          this.send("init-done");
          setTimeout(() => {
            wvWeb.setVisible(true);
            setTimeout(() => pv.load(bw, xml), 300);
          }, 300);
        }, 1250);
      });
    } else if (show) {
      // make the window show a section
      bw.webContents.once("did-finish-load", function () {
        setTimeout(() => this.send("show", show), 500);
      });
    }

    // window is about to be closed
    bw.on("close", async function (evt) {
      // search window
      const idx = win.data.findIndex(i => i.id === this.id);
      const { type } = win.data[idx];

      // close every other window and
      // save preferences when the main window is about to be closed
      if (type === "app" && typeof prefs.saved === "undefined") {
        evt.preventDefault();
        // close every other window
        await win.closeAll([ "app" ]);
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
      if (!/about|cli/.test(type)) {
        const data = prefs.data.win[type];
        const bounds = win.data[idx].bw.getBounds();
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
      win.open({ type });
    }
  },

  // close the currently active (i.e. focused) window
  close () {
    const bw = BrowserWindow.getFocusedWindow() || BaseWindow.getFocusedWindow();
    bw.close();
  },

  // close all windows
  //   exclude = array (exclude the given window types from closing)
  async closeAll (exclude) {
    for (let i = win.data.length - 1; i >= 0; i--) {
      const w = win.data[i];
      // 1. the main window should remain open until last
      // 2. exclude passed window types from closing
      if (w.type === "app" ||
          exclude.includes(w.type)) {
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
    }
    return nativeImage.createFromPath(path.join(__dirname, "img", "icon", "linux", "icon-64px.png"));
  },

  // focus the app window
  //   bw = object (browser or base window)
  focus (bw) {
    if (bw.isMinimized()) {
      bw.restore();
    }
    setTimeout(() => bw.focus(), 25);
  },

  // show section in help window
  //   data = object
  help (data) {
    const w = win.data.find(i => i.type === "help");
    if (w) {
      w.bw.webContents.send("show", data);
      w.bw.focus();
    } else {
      win.open({
        type: "help",
        show: data,
      });
    }
  },
};


/* PREVIEW WINDOW ------------------------------- */

const pv = {
  // open a new preview window or reload the XML file into an already existing one
  //   args = object (either "winId" or the other keys are present)
  //     dir = string (articles | ignore)
  //     file = string (XML file name)
  //     git = string (path to git directory)
  //     winId = integer (window ID)
  open (args) {
    for (const i of win.data) {
      if (!args.winId && i.xml?.file === args.file ||
          args.winId && i.id === args.winId) {
        pv.load(i.bw, i.xml);
        return;
      }
    }
    win.open({
      type: "pv",
      xml: args,
    });
  },

  // open a new instance of an already existing preview window
  //   bw = base window
  openNew (bw) {
    const data = win.data.find(i => i.id === bw.id);
    win.open({
      type: "pv",
      xml: data.xml,
    });
  },

  // close all preview windows
  closeAll () {
    const exclude = [];
    for (const w of win.data) {
      if (w.type !== "pv") {
        exclude.push(w.type);
      }
    }
    win.closeAll(exclude);
  },

  // set bounds for the views of the given preview window
  //   bw = base window
  setBounds (bw) {
    // header height: 78px height + 3px margin
    const headerHeight = 81;

    // get browser window dimensions
    const [ width, height ] = bw.getContentSize();

    // find web contents
    const { wvBase, wvWeb } = win.data.find(i => i.id === bw.id);

    // set bounds: base
    wvBase.setBounds({
      x: 0,
      y: 0,
      width,
      height,
    });

    // set bounds: web
    wvWeb.setBounds({
      x: 0,
      y: headerHeight,
      width,
      height: height - headerHeight,
    });
  },

  // load the XML preview into a given base window
  //   bw = base window
  //   args = object (see win.data)
  async load (bw, args) {
    // get XML file
    const xmlPath = path.join(args.git, args.dir, args.file);
    const exists = await services.exists(xmlPath);
    let xmlFile = "";
    if (exists) {
      const xmlFiles = await xml.getFile(args.git, args.dir, args.file);
      if (xmlFiles[args.file]) {
        xmlFile = xmlFiles[args.file].xml;
        // update file data in main window
        const appWin = win.data.find(i => i.type === "app");
        appWin.bw.webContents.send("update-file", xmlFiles);
      }
    }

    // no XML data found => error message
    const { wvBase, wvWeb } = win.data.find(i => i.id === bw.id);
    if (!xmlFile) {
      pv.loadingError(wvBase, wvWeb, `Die Daten aus der Datei „${args.file}“ konnten nicht geladen werden.`);
      return;
    }

    // try to restore the scroll position on reload
    const wc = wvWeb.webContents;
    const url = new URL(wc.getURL());
    let scrollTop = 0;
    if (url.host === "www.zdl.org" && url.pathname === "/wb/wortgeschichten/pv") {
      try {
        const result = await wc.executeJavaScript(`
          window.pageYOffset;
        `);
        const top = parseInt(result, 10);
        if (!isNaN(top)) {
          scrollTop = top;
        }
      } catch {}
    }

    // load preview
    try {
      // load page
      const bytes = Buffer.from(`xml=${encodeURIComponent(xmlFile)}`);
      await wc.loadURL("https://www.zdl.org/wb/wortgeschichten/pv?bn=mark", {
        postData: [
          {
            type: "rawData",
            bytes,
          },
        ],
        extraHeaders: "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
      });

      // restore scroll position
      if (scrollTop) {
        wc.executeJavaScript(`
          window.scrollTo(0, ${scrollTop});
        `);
      }

      // finish up loading
      pv.loadingDone(wvBase, wvWeb);
    } catch (err) {
      // failed to load the preview => error message
      wc.stop();
      pv.loadingError(wvBase, wvWeb, shared.errorString(err.message));
    }

    // focus window
    // (this is important in case the window already exists)
    bw.focus();
  },

  // finish up the loading procedure
  //   wvBase = view
  //   wvWeb = view
  loadingDone (wvBase, wvWeb) {
    wvWeb.webContents.navigationHistory.clear();
    wvBase.webContents.send("update-icons", {
      canGoBack: false,
      canGoForward: false,
    });
  },

  // show error document on loading failures
  //   wvBase = view
  //   wvWeb = view
  //   message = string
  async loadingError (wvBase, wvWeb, message) {
    try {
      await wvWeb.webContents.loadFile(path.join(__dirname, "html", "pvError.html"));
      pv.loadingDone(wvBase, wvWeb);
      wvWeb.webContents.executeJavaScript(`
        let label = document.createElement("p");
        label.classList.add("label");
        label.textContent = "Fehlermeldung";
        document.body.appendChild(label);
        let err = document.createElement("p");
        err.innerHTML = "${message}";
        document.body.appendChild(err);
      `);
    } catch {
      wvWeb.webContents.stop();
      pv.loadingDone(wvBase, wvWeb);
    }
  },

  // change zoom of the web view
  //   action = string
  zoom (action) {
    const bw = BaseWindow.getFocusedWindow();
    const { wvWeb } = win.data.find(i => i.id === bw.id);
    let level = wvWeb.webContents.getZoomLevel();
    switch (action) {
      case "in":
        level++;
        break;
      case "out":
        level--;
        break;
      case "original":
        level = 0;
        break;
    }
    wvWeb.webContents.setZoomLevel(level);
  },

  // navigate within a web contents
  //   bw = base window
  //   action = string
  nav (bw, action) {
    const { wvWeb } = win.data.find(i => i.id === bw.id);
    if (action === "goBack") {
      wvWeb.webContents.navigationHistory.goBack();
    } else if (action === "goForward") {
      wvWeb.webContents.navigationHistory.goForward();
    }
  },
};


/* WORKER WINDOW -------------------------------- */

const worker = {
  // data received from worker
  data: null,

  // make the worker work
  //   data = object
  async work (data) {
    // send data to existing worker window or create a new one
    const workerWin = win.data.find(i => i.type === "worker");
    if (workerWin) {
      workerWin.bw.webContents.send("work", data);
    } else {
      // create browser window
      const bw = new BrowserWindow({
        title: "QS / Worker",
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          backgroundThrottling: false,
          contextIsolation: false,
          defaultEncoding: "UTF-8",
          devTools: dev,
          nodeIntegration: true,
        },
      });

      // memorize window
      win.data.push({
        bw,
        id: bw.id,
        type: "worker",
        wvBase: null,
        wvWeb: null,
        xml: null,
      });

      // load html
      const html = path.join(__dirname, "html", "worker.html");
      if (dev) {
        // no cache while developing
        bw.loadURL("file://" + html, {
          extraHeaders: "pragma: no-cache\n",
        });
      } else {
        bw.loadFile(html);
      }

      // window is going to be closed
      bw.on("close", () => {
        const idx = win.data.findIndex(i => i.type === "worker");
        win.data.splice(idx, 1);
      });

      // send data
      bw.webContents.once("did-finish-load", function () {
        const bw = BrowserWindow.fromWebContents(this);
        bw.webContents.send("work", data);
      });
    }

    // wait for worker to finish
    worker.data = null;
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        worker.data = false;
        resolve(false);
      }, 6e4);
      const wait = setInterval(() => {
        if (worker.data !== null) {
          clearTimeout(timeout);
          clearInterval(wait);
          resolve(true);
        }
      }, 100);
    });
    return worker.data;
  },
};


/* APP EVENTS ----------------------------------- */

// parse CLI options
const cliCommand = {
  // ignore new articles
  "no-new": false,
  // output directory for export command
  "export-out": "",
  // export Artikel.json
  "export-artikel-json": false,
  // export overview page with all articles
  "export-overview": false,
  // export terminology page
  "export-terminology": false,
  // output type of terminology page (tt | html)
  "export-terminology-type": "tt",
  // transform passed svg file (Wortverlaufskurve)
  "transform-svg": "",
};

for (let i = 0, len = process.argv.length; i < len; i++) {
  const arg = process.argv[i].match(/^--([^\s=]+)(?:=(.+))?/);
  if (!arg || typeof cliCommand[arg[1]] === "undefined") {
    // argument unknown
    continue;
  }
  let value = arg[2]?.replace(/^"|"$/g, "") || true;
  if (typeof value !== typeof cliCommand[arg[1]]) {
    // value has different type => probably misusage (e.g. no path given)
    continue;
  }
  // ensure "export-out" path is absolute
  if (arg[1] === "export-out" && !path.isAbsolute(value)) {
    value = path.join(process.cwd(), value);
    value = path.normalize(value);
  }
  cliCommand[arg[1]] = value;
}

const cliCommandFound = Object.values(cliCommand).some(i => i === true) || cliCommand["transform-svg"];
let cliReturnCode = -1;

// single instance lock
const locked = app.requestSingleInstanceLock(cliCommand);

if (cliCommandFound || !locked) {
  // CLI COMMAND OR SECOND INSTANCE
  (async function () {
    // quit immediately if second instance without CLI command
    if (!cliCommandFound) {
      app.quit();
      process.exit(0);
    }

    // wait until app is ready
    await app.whenReady();

    // read preferences
    await prefs.read();

    // open hidden app window
    win.open({ type: "cli" });

    // wait until there is a valid return code
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (cliReturnCode >= 0) {
          clearInterval(interval);
          resolve(true);
        }
      }, 100);
    });

    // quit app
    app.quit();
    process.exit(cliReturnCode);
  }());
} else {
  // NORMAL APP BEHAVIOR
  // focus existing app window in case a second instance is opened
  app.on("second-instance", (...args) => {
    if (Object.values(args[3]).some(i => i === true)) {
      return;
    }
    const app = win.data.find(i => i.type === "app");
    app.bw.focus();
  });

  // app initialized => open app window
  app.on("ready", async () => {
    // read preferences
    await prefs.read();
    // open app window
    win.open({ type: "app" });
  });

  // strengthen security for web contents:
  //   - disallow navigation to other pages
  //   - disallow creation of windows with window.open()
  app.on("web-contents-created", (evt, contents) => {
    contents.on("will-navigate", function (evt) {
      const mayNavigate = [];
      for (const i of win.data) {
        if (i.type !== "pv") {
          continue;
        }
        mayNavigate.push(i.wvWeb.webContents.id);
      }
      if (!mayNavigate.includes(this.id)) {
        // only allow navigation in preview windows and
        // only in those web contents that show the preview
        evt.preventDefault();
      }
    });
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
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
      win.open({ type: "app" });
    }
  });
}


/* RENDERER REQUESTS ---------------------------- */

// Security: ensure that WebContents, which sent a request, have loaded a local file
function validSender (evt) {
  try {
    const validURL = new URL(evt.senderFrame.url);
    if (validURL.protocol !== "file:") {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

ipcMain.handle("app-info", evt => {
  if (!validSender(evt)) {
    return {};
  }
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

ipcMain.handle("cli-message", (evt, message) => console.log(message));

ipcMain.handle("cli-return-code", (evt, returnCode) => {
  cliReturnCode = returnCode;
});

ipcMain.handle("close", evt => {
  const bw = BrowserWindow.fromWebContents(evt.sender);
  bw.close();
});

ipcMain.handle("clear-cache", () => {
  const bw = win.data.find(i => i.type === "app")?.bw;
  if (bw) {
    const ses = bw.webContents.session;
    ses.clearCache();
    return true;
  }
  return false;
});

ipcMain.handle("help", (evt, data) => win.help(data));

ipcMain.handle("error", (evt, err) => error.log(err));

ipcMain.handle("exists", async (evt, path) => {
  if (!validSender(evt)) {
    return false;
  }
  const result = await services.exists(path);
  return result;
});

ipcMain.handle("file-dialog", async (evt, open, options) => {
  if (!validSender(evt)) {
    return null;
  }
  const bw = BrowserWindow.fromWebContents(evt.sender);
  const result = await services.fileDialog({
    bw,
    open,
    options,
  });
  return result;
});

ipcMain.handle("git-config", evt => {
  if (!validSender(evt)) {
    return {};
  }
  return prefs.data.git;
});

ipcMain.handle("git-save", (evt, config) => {
  if (!validSender(evt)) {
    return;
  }
  prefs.data.git = config;
  prefs.write();
});

ipcMain.handle("list-of-images", async () => {
  const result = await services.svg();
  return result;
});

ipcMain.handle("popup", (evt, items) => popup.make(evt.sender, items));

ipcMain.handle("prefs", () => prefs.data.options);

ipcMain.handle("prefs-save", async (evt, options) => {
  if (!validSender(evt)) {
    return;
  }
  prefs.data.options = options;
  await prefs.write();
  if (typeof prefs.saved !== "undefined") {
    prefs.saved = true;
  }
});

ipcMain.handle("process-info", evt => {
  if (!validSender(evt)) {
    return {};
  }
  return {
    platform: process.platform,
  };
});

ipcMain.handle("pv", (evt, args) => {
  if (!validSender(evt)) {
    return;
  }
  pv.open(args);
});

ipcMain.handle("pv-close-all", evt => {
  if (!validSender(evt)) {
    return;
  }
  pv.closeAll();
});

ipcMain.handle("pv-nav", (evt, data) => {
  if (!validSender(evt)) {
    return;
  }
  const { bw } = win.data.find(i => i.id === data.winId);
  pv.nav(bw, data.action);
});

ipcMain.handle("pv-new", evt => {
  if (!validSender(evt)) {
    return;
  }
  const bw = BrowserWindow.fromWebContents(evt.sender);
  pv.openNew(bw);
});

ipcMain.handle("xml-files", async (evt, repoDir) => {
  if (!validSender(evt)) {
    return {};
  }
  const result = await xml.getFiles(repoDir);
  return result;
});

ipcMain.handle("xml-worker-done", (evt, data) => {
  if (!validSender(evt)) {
    return;
  }
  worker.data = data;
});

ipcMain.handle("xml-worker-work", async (evt, data) => {
  if (!validSender(evt)) {
    return null;
  }
  const result = await worker.work(data);
  return result;
});
