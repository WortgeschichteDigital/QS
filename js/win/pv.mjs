
import shared from "../shared.mjs";

export { pv as default };

const pv = {
  // update the navigation icons
  //   histData = object
  updateIcons (histData) {
    for (const i of [ "back", "forward" ]) {
      const icon = document.querySelector(`#${i} img`);
      if (i === "back" && histData.canGoBack ||
          i === "forward" && histData.canGoForward) {
        icon.src = `../img/nav-${i}-white.svg`;
      } else {
        icon.src = `../img/nav-${i}-grey.svg`;
      }
    }
  },

  // navigation
  //   action = string
  nav (action) {
    switch (action) {
      case "back":
        bridge.ipc.invoke("pv-nav", {
          action: "goBack",
          winId: shared.info.winId,
        });
        break;
      case "forward":
        bridge.ipc.invoke("pv-nav", {
          action: "goForward",
          winId: shared.info.winId,
        });
        break;
      case "new":
        bridge.ipc.invoke("pv-new");
        break;
      case "xml":
        bridge.ipc.invoke("pv", {
          winId: shared.info.winId,
        });
        break;
    }
  },
};
