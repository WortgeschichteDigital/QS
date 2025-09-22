
import {
  BrowserWindow,
  Menu,
  MenuItem,
} from "electron";
import path from "node:path";

import winMenu from "./winMenu.mjs";

const __dirname = new URL(".", import.meta.url).pathname;

const items = {
  close: {
    label: "Fenster schließen",
    icon: "close.png",
    click: () => winMenu.execute("close"),
    accelerator: "CommandOrControl+W",
  },
  copyLink: {
    label: "Link kopieren",
    icon: "link.png",
    click: () => winMenu.execute("copy-link"),
  },
  copyMail: {
    label: "Adresse kopieren",
    icon: "mail.png",
    click: () => winMenu.execute("copy-link"),
  },
  editCut: {
    label: "Ausschneiden",
    icon: "edit-cut.png",
    role: "cut",
    accelerator: "CommandOrControl+X",
  },
  editCopy: {
    label: "Kopieren",
    icon: "edit-copy.png",
    role: "copy",
    accelerator: "CommandOrControl+C",
  },
  editPaste: {
    label: "Einfügen",
    icon: "edit-paste.png",
    role: "paste",
    accelerator: "CommandOrControl+V",
  },
  editSelectAll: {
    label: "Alles auswählen",
    icon: "edit-select-all.png",
    role: "selectAll",
    accelerator: "CommandOrControl+A",
  },
  filtersReset: {
    label: "Filter zurücksetzen",
    icon: "cleanup.png",
    click: () => winMenu.execute("filters-reset"),
  },
  results: {
    label: "Ergebnisleiste",
    icon: "sidebar.png",
    click: () => winMenu.execute("results"),
  },
  update: {
    label: "Update",
    icon: "view-refresh.png",
    click: () => winMenu.execute("menu-update"),
    accelerator: "F5",
  },
  viewClusters: {
    label: "Clusterei",
    icon: "clusters.png",
    click: () => winMenu.execute("menu-clusters"),
  },
  viewHints: {
    label: "Hinweise",
    icon: "info.png",
    click: () => winMenu.execute("menu-hints"),
  },
  viewSearch: {
    label: "Suche",
    icon: "search.png",
    click: () => winMenu.execute("menu-search"),
    accelerator: "CommandOrControl+F",
  },
  viewXml: {
    label: "XML",
    icon: "xml.png",
    click: () => winMenu.execute("menu-xml"),
  },
};

// make separator
function makeSep () {
  return new MenuItem({
    type: "separator",
  });
}

// make menu item
//   label = string (name of the menu item)
//   icon = string (PNG file)
//   click = function (function that is executed on click)
//   role = string (predefined menu role)
function makeItem ({ label, icon, click = null, role = "", accelerator = "" }) {
  const opt = {
    label,
    icon: path.join(__dirname, "..", "..", "img", "main", icon),
  };
  if (click) {
    opt.click = click;
  }
  if (role) {
    opt.role = role;
  }
  if (accelerator) {
    opt.accelerator = accelerator;
  }
  return new MenuItem(opt);
}

export default {
  // create popup menu
  //   wc = object (WebContents)
  //   list = array (list of menu items)
  make (wc, list) {
    // create new menu
    const menu = new Menu();
    for (const i of list) {
      if (i === "sep") {
        // separator
        menu.append(makeSep());
      } else {
        // menu item
        const args = clone(items[i]);
        menu.append(makeItem(args));
      }
    }

    // cloner
    function clone (item) {
      const c = {};
      for (const [ k, v ] of Object.entries(item)) {
        c[k] = v;
      }
      return c;
    }

    // show menu
    menu.popup({
      window: BrowserWindow.fromWebContents(wc),
    });
  },
};
