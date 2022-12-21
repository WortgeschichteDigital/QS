"use strict";

const keyboard = {
  // handle keyboard events
  //   evt = obejct
  shortcuts (evt) {
    const m = shared.detectKeyboardModifiers(evt);
    // Key "Escape"
    if (!m && evt.key === "Escape") {
      if (typeof help !== "undefined") {
        help.tocClose();
      }
    // Arrows
    } else if (m === "Alt" && /^Arrow(Left|Right)$/.test(evt.key) && typeof help !== "undefined") {
      help.historyNav(evt.key === "ArrowLeft");
    } else if (m === "Ctrl" && /^Arrow(Down|Up)$/.test(evt.key)) {
      evt.preventDefault();
      shared.verticalNav(document.querySelector("nav"), evt.key === "ArrowUp");
    }
  },
};
