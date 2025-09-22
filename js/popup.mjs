
import overlay from "./overlay.mjs";
import shared from "./shared.mjs";

export { popup as default };

const popup = {
  // bridge to reach app/misc.mjs which is only available in the main window
  misc: null,

  // element the event refers to
  element: null,

  // open popup
  //   evt = object
  open (evt) {
    // detect click target
    const path = evt.composedPath();
    const target = popup.getTarget(path);
    if (!target) {
      return;
    }

    // collect items
    let items;
    let def = [ "close" ];
    let defSep = [ "sep" ].concat(def);
    if (popup.misc) {
      def = [ "update", "sep", "viewXml", "viewHints", "viewClusters", "viewSearch" ];
      defSep = [ "sep" ].concat(def);
    }
    if (target === "filters_reset") {
      items = [ "filtersReset" ].concat(defSep);
    } else if (target === "link") {
      items = [ "copyLink" ].concat(defSep);
    } else if (target === "mail") {
      items = [ "copyMail" ].concat(defSep);
    } else if (target === "results_bar") {
      items = [ "results" ].concat(defSep);
    } else if (target === "text_field") {
      items = [ "editCut", "editCopy", "editPaste", "sep", "editSelectAll" ];
    } else if (target === "text_field_readonly") {
      items = [ "editCopy", "sep", "editSelectAll" ];
    } else {
      items = def;
    }

    // add copy icon if click is on selection
    const sel = window.getSelection();
    if (target !== "text_field_readonly" &&
        sel.toString() &&
        path.includes(sel.getRangeAt(0).commonAncestorContainer.parentNode)) {
      items.unshift("editCopy", "sep");
    }

    // cretae popup menu
    if (items.length) {
      bridge.ipc.invoke("popup", items);
    }
  },

  // detect the matching target for the current right click
  //   path = array (save the event path, that is an element list
  //            by which the click event was called)
  getTarget (path) {
    for (let i = 0, len = path.length; i < len; i++) {
      // text field
      if (path[i].nodeName === "INPUT" &&
          path[i].type === "text") {
        if (path[i].getAttribute("readonly") !== null) {
          return "text_field_readonly";
        }
        return "text_field";
      }
      // code
      if (path[i].nodeName === "P" &&
          (path[i].closest("#dialog.code #dialog-text") || path[i].classList.contains("selectable")) ||
          path[i].nodeName === "PRE" && path[i].closest("#error")) {
        return "text_field_readonly";
      }
      // ID
      const { id } = path[i];
      if (id === "fun-filters") {
        return "filters_reset";
      }
      // links
      const href = path[i].nodeType === Node.ELEMENT_NODE ? path[i].getAttribute("href") : "";
      if (/^https:/.test(href)) {
        popup.element = path[i];
        return "link";
      } else if (/^mailto:/.test(href)) {
        popup.element = path[i];
        return "mail";
      }
    }

    // overlay visible?
    if (overlay.top()) {
      return "";
    }

    // default popup menu
    if (/hints|search/.test(popup.misc?.view)) {
      return "results_bar";
    }

    // default popup menu
    return "default";
  },

  // copy link to clipboard
  copyLink () {
    const link = popup.element.getAttribute("href").replace(/^mailto:/, "");
    navigator.clipboard.writeText(link)
      .then(() => shared.feedback("copied"))
      .catch(() => shared.feedback("error"));
  },
};
