
import artikel from "./artikel.mjs";
import misc from "./misc.mjs";
import overview from "./overview.mjs";
import svg from "./svg.mjs";
import term from "./term.mjs";

export { cli as default };

const cli = {
  // distribute passed CLI commands
  //   command = object
  async distribute (command) {
    // wait until the app is ready
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (misc.ready) {
          clearInterval(interval);
          resolve(true);
        }
      }, 50);
    });

    // ERROR: export command found, but no export directory given
    if (!command["export-out"]) {
      for (const [ k, v ] of Object.entries(command)) {
        if (/^export-/.test(k) && v === true) {
          bridge.ipc.invoke("cli-message", "Error: export directory not specified");
          bridge.ipc.invoke("cli-return-code", 1);
          return;
        }
      }
    }

    // basic checks for the export directory
    if (command["export-out"]) {
      // ERROR: target does not exist
      const exists = await bridge.ipc.invoke("exists", command["export-out"]);
      if (!exists) {
        bridge.ipc.invoke("cli-message", "Error: path target nonexistent");
        bridge.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: path is not a directory
      const stats = await bridge.ipc.invoke("path-info", command["export-out"]);
      if (!stats.isDirectory) {
        bridge.ipc.invoke("cli-message", "Error: path not a directory");
        bridge.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: directory not writable
      const writeAccess = await bridge.ipc.invoke("file-access-write", command["export-out"]);
      if (!writeAccess) {
        bridge.ipc.invoke("cli-message", "Error: target directory not writable");
        bridge.ipc.invoke("cli-return-code", 1);
        return;
      }
    }

    // COMMAND: export Artikel.json
    if (command["export-artikel-json"]) {
      const result = await cli.articleJSON(command);
      if (!result) {
        return;
      }
    }

    // COMMAND: export overview page
    if (command["export-overview"]) {
      const result = await cli.overview(command);
      if (!result) {
        return;
      }
    }

    // COMMAND: export terminology
    if (command["export-terminology"]) {
      const result = await cli.term(command);
      if (!result) {
        return;
      }
    }

    // COMMAND: transform SVG file
    if (command["transform-svg"]) {
      const result = await cli.svg(command);
      if (!result) {
        return;
      }
    }

    // everything done
    bridge.ipc.invoke("cli-return-code", 0);
  },

  // COMMAND: export Artikel.json
  //   command = object
  async articleJSON (command) {
    // ERROR: Zeitstrahl data not present
    if (!Object.keys(artikel.zeitstrahl).length) {
      bridge.ipc.invoke("cli-message", "Error: Zeitstrahl data missing");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // ERROR: resources data not present
    if (!Object.keys(artikel.ressourcen).length) {
      bridge.ipc.invoke("cli-message", "Error: resources data missing");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // Okay, let's export the data!
    bridge.ipc.invoke("cli-message", "Exporting Artikel.json . . .");
    try {
      // calculate data
      await artikel.calculate({
        cli: true,
        noNew: command["no-new"],
      });
      // write file
      const path = await bridge.ipc.invoke("path-join", command["export-out"], "Artikel.json");
      const written = await bridge.ipc.invoke("file-write", path, JSON.stringify(artikel.data.json));
      if (written !== true) {
        cli.unspecifiedError(written);
        return false;
      }
      return true;
    } catch (err) {
      // unspecified error
      cli.unspecifiedError(err);
      return false;
    }
  },

  // COMMAND: export overview page
  //   command = object
  async overview (command) {
    bridge.ipc.invoke("cli-message", "Exporting overview page . . .");
    try {
      // calculate page
      const page = await overview.calculate(command["no-new"], true);
      if (!page) {
        return false;
      }
      // write file
      const path = await bridge.ipc.invoke("path-join", command["export-out"], "artikel.tt");
      const written = await bridge.ipc.invoke("file-write", path, page);
      if (written !== true) {
        cli.unspecifiedError(written);
        return false;
      }
      return true;
    } catch (err) {
      // unspecified error
      cli.unspecifiedError(err);
      return false;
    }
  },

  // COMMAND: export terminology
  //   command = object
  async term (command) {
    // load Terminologie.json and template
    const json = await term.load(true);
    if (!json) {
      return false;
    }

    // make file
    bridge.ipc.invoke("cli-message", "Exporting terminology . . .");
    const type = command["export-terminology-type"] || "tt";
    const file = term.makeFile(type, command["no-new"]);

    // save file
    const path = await bridge.ipc.invoke("path-join", command["export-out"], `terminologie.${type}`);
    const written = await bridge.ipc.invoke("file-write", path, file);
    if (written !== true) {
      bridge.ipc.invoke("cli-message", "Error: writing terminology file failed");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }
    return true;
  },

  // COMMAND: transform SVG file
  //   command = object
  async svg (command) {
    const path = command["transform-svg"];

    // ERROR: path does not exist
    const exists = await bridge.ipc.invoke("exists", path);
    if (!exists) {
      bridge.ipc.invoke("cli-message", "Error: SVG file not found");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // ERROR: not of type file
    const stats = await bridge.ipc.invoke("path-info", path);
    if (!stats.isFile) {
      bridge.ipc.invoke("cli-message", "Error: SVG file path not a file");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // backup current file data
    const backup = { ...svg.file };

    // load XSLT files (if necessary)
    if (!Object.values(svg.xslt).some(i => i)) {
      const xslt = await svg.loadXslt();
      if (!xslt) {
        bridge.ipc.invoke("cli-message", "Error: loading XSLT files failed");
        bridge.ipc.invoke("cli-return-code", 1);
        return false;
      }
    }

    // load SVG file
    const result = await bridge.ipc.invoke("file-read", path);
    if (typeof result !== "string") {
      bridge.ipc.invoke("cli-message", "Error: reading SVG file failed");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }
    svg.file.content = result;
    svg.file.path = path;

    // transform file
    bridge.ipc.invoke("cli-message", "Transforming SVG file . . .");
    const trans = await svg.transformExecute();
    if (trans.err !== false) {
      bridge.ipc.invoke("cli-message", `Error: transformation failed (${trans.err})`);
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }
    const written = await bridge.ipc.invoke("file-write", trans.path, trans.str);
    if (written !== true) {
      bridge.ipc.invoke("cli-message", "Error: writing SVG file failed");
      bridge.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // restore file data backup
    svg.file = { ...backup };

    return true;
  },

  // return message from unspecified error
  //   err = object
  unspecifiedError (err) {
    bridge.ipc.invoke("cli-message", `Error: program error\n\n${err.name}: ${err.message}`);
    bridge.ipc.invoke("cli-return-code", 1);
  },
};
