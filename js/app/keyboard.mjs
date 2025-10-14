
import bars from "./bars.mjs";
import clustersMod from "./clustersMod.mjs";
import git from "./git.mjs";
import misc from "./misc.mjs";
import viewClusters from "./viewClusters.mjs";
import viewHints from "./viewHints.mjs";
import viewSearch from "./viewSearch.mjs";

import overlay from "../overlay.mjs";
import shared from "../shared.mjs";

export { keyboard as default };

const keyboard = {
  // handle keyboard events
  //   evt = obejct
  async shortcuts (evt) {
    const m = shared.detectKeyboardModifiers(evt);
    const { activeElement: active } = document;

    // Key "Escape"
    if (!m && evt.key === "Escape") {
      const olTop = overlay.top();
      if (olTop) {
        // Git configuration has no close icon
        document.querySelector(`#${olTop} a.overlay-close`)?.click();
        return;
      } else if (active.id === "search-text") {
        viewSearch.toggleAdvanced("off");
        return;
      } else if (document.getElementById("fun-git-branch-select")) {
        git.branchSelectRemove();
        return;
      }
      const select = document.querySelector(".select-popup");
      if (select) {
        bars.selectPopupClose(select, false);
        return;
      }
      const popups = document.querySelectorAll(".hints-popup");
      if (popups.length) {
        const arr = Array.from(popups);
        arr.sort((a, b) => {
          const x = parseInt(a.dataset.id, 10);
          const y = parseInt(b.dataset.id, 10);
          return y - x;
        });
        arr[0].firstElementChild.click();
        return;
      }
      viewClusters.previewPopupOff("off");

    // Key "Enter"
    } else if (!m && evt.key === "Enter") {
      const olTop = overlay.top();
      if (olTop === "git" && /^git-(user|dir)$/.test(active.id)) {
        await shared.wait(25);
        document.getElementById("git-okay").click();
      } else if (active.id === "search-text") {
        viewSearch.start();
      }

    // Arrows
    } else if (!m && /^Arrow(Left|Right)$/.test(evt.key) &&
        active.nodeName === "INPUT" && active.type === "button") {
      const buttons = active.parentNode.querySelectorAll('input[type="button"]');
      let idx = -1;
      for (let i = 0, len = buttons.length; i < len; i++) {
        if (buttons[i] === active) {
          idx = i;
          break;
        }
      }
      if (evt.key === "ArrowLeft") {
        idx--;
      } else {
        idx++;
      }
      if (idx === buttons.length) {
        idx = 0;
      } else if (idx < 0) {
        idx = buttons.length - 1;
      }
      buttons[idx].focus();
    } else if (!m && /^Arrow(Down|Up)$/.test(evt.key) &&
        active.id === "clusters-model-search") {
      evt.preventDefault();
      clustersMod.searchNav(evt.key === "ArrowUp");
    } else if (m === "Alt" && /^Arrow(Left|Right)$/.test(evt.key)) {
      misc.viewToggleShortcut(evt.key === "ArrowRight");
    } else if (m === "Ctrl" && /^Arrow(Left|Right)$/.test(evt.key)) {
      if (overlay.top() === "tags") {
        evt.preventDefault();
        const nav = document.querySelectorAll("#tags-nav > a");
        if (!nav[0].parentNode.classList.contains("off")) {
          if (evt.key === "ArrowLeft") {
            nav[0].click();
          } else {
            nav[1].click();
          }
        }
      }
    } else if (m === "Ctrl" && /^Arrow(Down|Up)$/.test(evt.key)) {
      const olTop = overlay.top();
      if (olTop === "prefs") {
        evt.preventDefault();
        shared.verticalNav(document.querySelector("#prefs ul"), evt.key === "ArrowUp");
      } else if (!olTop && misc.view === "hints") {
        viewHints.nav(evt.key === "ArrowDown");
      }

    // PageDown + PageUp
    } else if (!m && /^Page(Down|Up)$/.test(evt.key)) {
      evt.preventDefault();
      misc.scroll(evt.key === "PageDown");
    }
  },
};
