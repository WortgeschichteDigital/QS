"use strict";

const { BrowserWindow, Menu, MenuItem } = require("electron");
const path = require("path");

const items = {
  close: {
    label: "Fenster schließen",
    icon: "close.png",
    click: 'shared.ipc.invoke("close")',
    accelerator: "CommandOrControl+W",
  },
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
    click: 'document.querySelector("#filters-reset").click()',
  },
  results: {
    label: "Ergebnisleiste",
    icon: "sidebar.png",
    click: 'bars.toggle("results")',
  },
  update: {
    label: "Update",
    icon: "view-refresh.png",
    click: 'app.menuCommand("update")',
    accelerator: "F5",
  },
  viewClusters: {
    label: "Clusterei",
    icon: "clusters.png",
    click: 'app.menuCommand("clusters")',
  },
  viewHints: {
    label: "Hinweise",
    icon: "info.png",
    click: 'app.menuCommand("hints")',
  },
  viewSearch: {
    label: "Suche",
    icon: "search.png",
    click: 'app.menuCommand("search")',
    accelerator: "CommandOrControl+F",
  },
  viewXml: {
    label: "XML",
    icon: "xml.png",
    click: 'app.menuCommand("xml")',
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
function makeItem ({ wc, label, icon, click = "", role = "", accelerator = "" }) {
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
  if (accelerator) {
    opt.accelerator = accelerator;
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
