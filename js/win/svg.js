"use strict";

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
    document.querySelector("#svg-load").focus();
  },

  // load XSLT files
  async loadXslt () {
    const promises = [];
    for (let i = 1; i <= 2; i++) {
      promises.push(win.loadXsl({
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
      defaultPath: shared.path.join(git.config.dir, "resources", "images"),
      filters: [
        {
          name: "SVG",
          extensions: [ "svg" ],
        },
      ],
      properties: [ "openFile" ],
    };
    const result = await shared.ipc.invoke("file-dialog", true, options);
    if (result.canceld || !result?.filePaths?.length) {
      return;
    }
    const [ path ] = result.filePaths;
    try {
      svg.file.content = await shared.fsp.readFile(path, { encoding: "utf8" });
      svg.file.path = path;
    } catch (err) {
      await shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      document.querySelector("#svg-load").focus();
      return;
    }

    // feedback
    const div = document.querySelector("#svg-path");
    div.classList.remove("no-plot");
    div.innerHTML = path.replace(/[/\\]/g, m => m + "<wbr>");
    document.querySelector("#svg-transform").focus();
  },

  // transform SVG file
  async transform () {
    // no file loaded
    if (!svg.file.content) {
      await dialog.open({
        type: "alert",
        text: "Sie haben noch keine Wortverlaufskurve geladen.",
      });
      document.querySelector("#svg-load").focus();
      return;
    }

    // check if svg file still exists
    const exists = await shared.ipc.invoke("exists", svg.file.path);
    if (!exists) {
      await dialog.open({
        type: "alert",
        text: "Die Wortverlaufskurve existiert nicht mehr.",
      });
      document.querySelector("#svg-load").focus();
      return;
    }

    // transform file
    const trans = svg.transformExecute();
    if (trans.err !== false) {
      await shared.error(`transformation failed (${trans.err})`);
      document.querySelector("#svg-load").focus();
      return;
    }
    try {
      await shared.fsp.writeFile(trans.path, trans.str);
    } catch (err) {
      await shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      document.querySelector("#svg-transform").focus();
      return;
    }
    dialog.open({
      type: "alert",
      text: `Wortverlaufskurve transformiert!\n<b>${trans.file}</b>`,
    });
  },

  // execute the actual transformation
  transformExecute () {
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
    const parsedPath = shared.path.parse(svg.file.path);
    result.file = "! " + parsedPath.base;
    result.path = shared.path.join(parsedPath.dir, result.file);

    return result;
  },
};
