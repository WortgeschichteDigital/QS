"use strict";

const pv = {
  // update the navigation icons
  //   histData = object
  updateIcons (histData) {
    for (const i of [ "back", "forward" ]) {
      const icon = document.querySelector(`#${i} img`);
      if (i === "back" && histData.canGoBack ||
          i === "forward" && histData.canGoForward) {
        icon.src = `../img/win/nav-${i}-white.svg`;
      } else {
        icon.src = `../img/win/nav-${i}-grey.svg`;
      }
    }
  },

  // navigation
  //   action = string
  nav (action) {
    switch (action) {
      case "back":
        modules.ipc.invoke("pv-nav", {
          action: "goBack",
          winId: shared.info.winId,
        });
        break;
      case "forward":
        modules.ipc.invoke("pv-nav", {
          action: "goForward",
          winId: shared.info.winId,
        });
        break;
      case "new":
        modules.ipc.invoke("pv-new");
        break;
      case "xml":
        modules.ipc.invoke("pv", {
          winId: shared.info.winId,
        });
        break;
    }
  },
};
