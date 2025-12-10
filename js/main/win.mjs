
import {
  BaseWindow,
  BrowserWindow,
  nativeImage,
  screen,
  WebContentsView,
} from "electron";
import path from "node:path";

import dd from "./dd.mjs";
import prefs from "./prefs.mjs";
import pv from "./pv.mjs";
import winMenu from "./winMenu.mjs";

const __dirname = import.meta.dirname;

export { win as default };

const win = {
  // data of currently open windows; filled with objects:
  //   bw = object (browser or base window)
  //   id = integer (window ID)
  //   contentsIds = array (filled with integers of webContents IDs that are
  //                        open in this browser or base window)
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
        contextIsolation: true,
        defaultEncoding: "UTF-8",
        devTools: dd.dev,
        nodeIntegration: false,
        preload: path.join(__dirname, "preload.cjs"),
        sandbox: true,
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
    const contentsIds = [];
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
          devTools: dd.dev,
          nodeIntegration: false,
          preload: path.join(__dirname, "preload.cjs"),
          sandbox: true,
          spellcheck: false,
        },
      });
      bw.contentView.addChildView(wvBase);
      wvBase.webContents.loadFile(path.join(__dirname, "..", "..", "html", "pv.html"));
      contentsIds.push(wvBase.webContents.id);

      // create web contents: web
      wvWeb = new WebContentsView();
      bw.contentView.addChildView(wvWeb);
      wvWeb.setVisible(false);
      wvWeb.webContents.loadFile(path.join(__dirname, "..", "..", "html", "pvLoading.html"));
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
      contentsIds.push(bw.webContents.id);
    }

    // maximize window?
    if (data.maximized) {
      bw.maximize();
    }

    // memorize window
    win.data.push({
      bw,
      id: bw.id,
      contentsIds,
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
        about: path.join(__dirname, "..", "..", "html", "about.html"),
        app: path.join(__dirname, "..", "..", "index.html"),
        cli: path.join(__dirname, "..", "..", "index.html"),
        help: path.join(__dirname, "..", "..", "html", "help.html"),
      };
      if (dd.dev) {
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
          bw.webContents.send("cli-command", dd.cliCommand);
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
      return nativeImage.createFromPath(path.join(__dirname, "..", "..", "img", "icon", "win", "icon.ico"));
    } else if (process.platform === "darwin") {
      return nativeImage.createFromPath(path.join(__dirname, "..", "..", "img", "icon", "mac", "icon.icns"));
    }
    return nativeImage.createFromPath(path.join(__dirname, "..", "..", "img", "icon", "linux", "icon-64px.png"));
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
