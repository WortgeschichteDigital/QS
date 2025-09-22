
import { app } from "electron";

export { dd as default };

const dd = {
  // cli command options
  cliCommand: {
    // ignore new articles
    "no-new": false,

    // output directory for export command
    "export-out": "",

    // export Artikel.json
    "export-artikel-json": false,

    // export overview page with all articles
    "export-overview": false,

    // export terminology page
    "export-terminology": false,

    // output type of terminology page (tt | html)
    "export-terminology-type": "tt",

    // transform passed svg file (Wortverlaufskurve)
    "transform-svg": "",
  },

  // app is in developer mode
  dev: !app.isPackaged,
};
