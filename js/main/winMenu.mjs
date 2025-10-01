
import {
  BaseWindow,
  BrowserWindow,
  Menu,
} from "electron";
import path from "node:path";

import dd from "./dd.mjs";
import pv from "./pv.mjs";
import win from "./win.mjs";

const __dirname = import.meta.dirname;

export { winMenu as default };

const winMenu = {
  // menu templates
  menuApp: [
    {
      label: "&QS",
      submenu: [
        {
          label: "XML",
          icon: path.join(__dirname, "..", "..", "img", "main", "xml.png"),
          click: () => winMenu.execute("menu-xml"),
        },
        {
          label: "Hinweise",
          icon: path.join(__dirname, "..", "..", "img", "main", "info.png"),
          click: () => winMenu.execute("menu-hints"),
        },
        {
          label: "Clusterei",
          icon: path.join(__dirname, "..", "..", "img", "main", "clusters.png"),
          click: () => winMenu.execute("menu-clusters"),
        },
        {
          label: "Suche",
          icon: path.join(__dirname, "..", "..", "img", "main", "search.png"),
          click: () => winMenu.execute("menu-search"),
          accelerator: "CommandOrControl+F",
        },
        { type: "separator" },
        {
          label: "Einstellungen",
          icon: path.join(__dirname, "..", "..", "img", "main", "preferences.png"),
          click: () => winMenu.execute("menu-preferences"),
        },
        { type: "separator" },
        {
          label: "Beenden",
          icon: path.join(__dirname, "..", "..", "img", "main", "exit.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "filter.png"),
          click: () => winMenu.execute("menu-filters"),
          accelerator: "CommandOrControl+Shift+F",
        },
        {
          label: "Update",
          icon: path.join(__dirname, "..", "..", "img", "main", "view-refresh.png"),
          click: () => winMenu.execute("menu-update"),
          accelerator: "F5",
        },
        { type: "separator" },
        {
          label: "Teaser-Tags",
          icon: path.join(__dirname, "..", "..", "img", "main", "xml.png"),
          click: () => winMenu.execute("menu-teaser-tags"),
        },
      ],
    },
    {
      label: "&Publikation",
      submenu: [
        {
          label: "Artikel.json",
          icon: path.join(__dirname, "..", "..", "img", "main", "json.png"),
          click: () => winMenu.execute("menu-artikel-json"),
        },
        {
          label: "Artikelübersicht",
          icon: path.join(__dirname, "..", "..", "img", "main", "file.png"),
          click: () => winMenu.execute("menu-overview"),
        },
        {
          label: "Terminologie",
          icon: path.join(__dirname, "..", "..", "img", "main", "file.png"),
          click: () => winMenu.execute("menu-term"),
        },
        {
          label: "Wortverlaufskurven",
          icon: path.join(__dirname, "..", "..", "img", "main", "transform.png"),
          click: () => winMenu.execute("menu-svg"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "close.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "nav-back.png"),
          click: () => pv.nav(BaseWindow.getFocusedWindow(), "goBack"),
          accelerator: "Alt+Left",
        },
        {
          label: "Vorwärts",
          icon: path.join(__dirname, "..", "..", "img", "main", "nav-forward.png"),
          click: () => pv.nav(BaseWindow.getFocusedWindow(), "goForward"),
          accelerator: "Alt+Right",
        },
        { type: "separator" },
        {
          label: "XML-Vorschau",
          icon: path.join(__dirname, "..", "..", "img", "main", "xml.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "window-new.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "close.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "search.png"),
          click: () => winMenu.execute("menu-search"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "edit-undo.png"),
          role: "undo",
        },
        {
          label: "Wiederherstellen",
          icon: path.join(__dirname, "..", "..", "img", "main", "edit-redo.png"),
          role: "redo",
        },
        { type: "separator" },
        {
          label: "Ausschneiden",
          icon: path.join(__dirname, "..", "..", "img", "main", "edit-cut.png"),
          role: "cut",
        },
        {
          label: "Kopieren",
          icon: path.join(__dirname, "..", "..", "img", "main", "edit-copy.png"),
          role: "copy",
        },
        {
          label: "Einfügen",
          icon: path.join(__dirname, "..", "..", "img", "main", "edit-paste.png"),
          role: "paste",
        },
        { type: "separator" },
        {
          label: "Alles auswählen",
          icon: path.join(__dirname, "..", "..", "img", "main", "edit-select-all.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "zoom-in.png"),
          role: "zoomIn",
          // Electron bug (otherwise Ctrl + Plus doesn't work)
          accelerator: "CommandOrControl+=",
        },
        {
          label: "Anzeige verkleinern",
          icon: path.join(__dirname, "..", "..", "img", "main", "zoom-out.png"),
          role: "zoomOut",
        },
        {
          label: "Standardgröße",
          icon: path.join(__dirname, "..", "..", "img", "main", "zoom-original.png"),
          role: "resetZoom",
        },
        { type: "separator" },
        {
          label: "Vollbild",
          icon: path.join(__dirname, "..", "..", "img", "main", "view-fullscreen.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "zoom-in.png"),
          click: () => pv.zoom("in"),
          // Electron bug (otherwise Ctrl + Plus doesn't work)
          accelerator: "CommandOrControl+=",
        },
        {
          label: "Anzeige verkleinern",
          icon: path.join(__dirname, "..", "..", "img", "main", "zoom-out.png"),
          click: () => pv.zoom("out"),
          accelerator: "CommandOrControl+-",
        },
        {
          label: "Standardgröße",
          icon: path.join(__dirname, "..", "..", "img", "main", "zoom-original.png"),
          click: () => pv.zoom("original"),
          accelerator: "CommandOrControl+0",
        },
        { type: "separator" },
        {
          label: "Vollbild",
          icon: path.join(__dirname, "..", "..", "img", "main", "view-fullscreen.png"),
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
          icon: path.join(__dirname, "..", "..", "img", "main", "help.png"),
          click: () => win.infoOpen("help"),
          accelerator: "F1",
        },
        { type: "separator" },
        {
          label: "Updates",
          click: () => winMenu.execute("menu-app-updates"),
        },
        {
          label: "Fehlerlog",
          click: () => winMenu.execute("menu-error-log"),
        },
        { type: "separator" },
        {
          label: "Über QS",
          icon: path.join(__dirname, "..", "..", "img", "main", "info.png"),
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
    if (dd.dev) {
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
    bw.webContents.send(command);
  },
};
