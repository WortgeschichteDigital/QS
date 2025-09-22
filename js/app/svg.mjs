
import git from "./git.mjs";
import misc from "./misc.mjs";

import dialog from "../dialog.mjs";
import overlay from "../overlay.mjs";
import shared from "../shared.mjs";

export { svg as default };

const svg = {
  // XSLT files
  xslt: {
    1: "",
    2: "",
  },

  // SVG file
  file: {
    content: "",
    path: "",
  },

  // open the overlay
  async show () {
    // load XSLT
    if (!Object.values(svg.xslt).some(i => i)) {
      const xsltLoaded = await svg.loadXslt();
      if (!xsltLoaded) {
        shared.error("Laden der XSLT-Scripts fehlgeschlagen");
        return;
      }
    }

    // open windows
    overlay.show("svg");
    document.getElementById("svg-load").focus();
  },

  // load XSLT files
  async loadXslt () {
    const promises = [];
    for (let i = 1; i <= 2; i++) {
      promises.push(misc.loadXsl({
        obj: svg.xslt,
        key: i,
        xsl: `wortverlaufskurven-v${i}.xsl`,
      }));
    }
    const [ ...results ] = await Promise.all(promises);
    if (results.some(i => !i)) {
      return false;
    }
    return true;
  },

  // load SVG file
  async load () {
    // load file
    const options = {
      title: "Wortverlaufskurve laden",
      defaultPath: await bridge.ipc.invoke("path-join", git.config.dir, "resources", "images"),
      filters: [
        {
          name: "SVG",
          extensions: [ "svg" ],
        },
      ],
      properties: [ "openFile" ],
    };
    const resultDialog = await bridge.ipc.invoke("file-dialog", true, options);
    if (resultDialog.canceled || !resultDialog?.filePaths?.length) {
      return;
    }
    const [ path ] = resultDialog.filePaths;
    const resultRead = await bridge.ipc.invoke("file-read", path);
    if (typeof resultRead !== "string") {
      await shared.error(`${resultRead.name}: ${resultRead.message} (${shared.errorReduceStack(resultRead.stack)})`);
      document.getElementById("svg-load").focus();
      return;
    }
    svg.file.content = resultRead;
    svg.file.path = path;

    // feedback
    const div = document.getElementById("svg-path");
    div.classList.remove("no-plot");
    div.innerHTML = path.replace(/[/\\]/g, m => m + "<wbr>");
    document.getElementById("svg-transform").focus();
  },

  // transform SVG file
  async transform () {
    // no file loaded
    if (!svg.file.content) {
      await dialog.open({
        type: "alert",
        text: "Sie haben noch keine Wortverlaufskurve geladen.",
      });
      document.getElementById("svg-load").focus();
      return;
    }

    // check if svg file still exists
    const exists = await bridge.ipc.invoke("exists", svg.file.path);
    if (!exists) {
      await dialog.open({
        type: "alert",
        text: "Die Wortverlaufskurve existiert nicht mehr.",
      });
      document.getElementById("svg-load").focus();
      return;
    }

    // transform file
    const trans = await svg.transformExecute();
    if (trans.err !== false) {
      await shared.error(`transformation failed (${trans.err})`);
      document.getElementById("svg-load").focus();
      return;
    }
    const written = await bridge.ipc.invoke("file-write", trans.path, trans.str);
    if (written !== true) {
      await shared.error(`${written.name}: ${written.message} (${shared.errorReduceStack(written.stack)})`);
      document.getElementById("svg-transform").focus();
      return;
    }
    dialog.open({
      type: "alert",
      text: `Wortverlaufskurve transformiert!\n<b>${trans.file}</b>`,
    });
  },

  // execute the actual transformation
  async transformExecute () {
    // decide which XSLT to use
    let script = svg.xslt["1"];
    if (/highcharts-series /.test(svg.file.content)) {
      script = svg.xslt["2"];
    }

    // transform svg file
    const xslt = new DOMParser().parseFromString(script, "application/xml");
    const xml = new DOMParser().parseFromString(svg.file.content, "text/xml");
    const processor = new XSLTProcessor();
    processor.importStylesheet(xslt);
    const trans = processor.transformToDocument(xml);

    // return compile transformation result
    const result = {
      err: trans.querySelector("parsererror div")?.textContent?.trim() || false,
      str: new XMLSerializer().serializeToString(trans),
    };
    const parsedPath = await bridge.ipc.invoke("path-parse", svg.file.path);
    result.file = "! " + parsedPath.base;
    result.path = await bridge.ipc.invoke("path-join", parsedPath.dir, result.file);

    return result;
  },
};
