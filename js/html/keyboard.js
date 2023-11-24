"use strict";

const keyboard = {
  // handle keyboard events
  //   evt = obejct
  shortcuts (evt) {
    const m = shared.detectKeyboardModifiers(evt);
    if (typeof about !== "undefined") {
      // Key "Escape"
      if (!m && evt.key === "Escape") {
        modules.ipc.invoke("close");
      }
    } else if (typeof help !== "undefined") {
      // Key "Escape"
      if (!m && evt.key === "Escape") {
        help.tocClose();
      // Key "F3"
      } else if (!m && evt.key === "F3") {
        help.search(true);
      } else if (m === "Shift" && evt.key === "F3") {
        help.search(false);
      // Arrows
      } else if (m === "Alt" && /^Arrow(Left|Right)$/.test(evt.key) && typeof help !== "undefined") {
        help.historyNav(evt.key === "ArrowLeft");
      } else if (m === "Ctrl" && /^Arrow(Down|Up)$/.test(evt.key)) {
        evt.preventDefault();
        shared.verticalNav(document.querySelector("nav"), evt.key === "ArrowUp");
      }
    }
  },
};
