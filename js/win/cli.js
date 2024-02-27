"use strict";

const cli = {
  // distribute passed CLI commands
  //   command = object
  async distribute (command) {
    // wait until the app is ready
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (win.ready) {
          clearInterval(interval);
          resolve(true);
        }
      }, 50);
    });

    // ERROR: export command found, but no export directory given
    if (!command["export-out"]) {
      for (const [ k, v ] of Object.entries(command)) {
        if (/^export-/.test(k) && v === true) {
          modules.ipc.invoke("cli-message", "Error: export directory not specified");
          modules.ipc.invoke("cli-return-code", 1);
          return;
        }
      }
    }

    // basic checks for the export directory
    if (command["export-out"]) {
      // ERROR: target does not exist
      const exists = await modules.ipc.invoke("exists", command["export-out"]);
      if (!exists) {
        modules.ipc.invoke("cli-message", "Error: path target nonexistent");
        modules.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: path is not a directory
      const stats = await modules.fsp.lstat(command["export-out"]);
      if (!stats.isDirectory()) {
        modules.ipc.invoke("cli-message", "Error: path not a directory");
        modules.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: directory not writable
      try {
        await modules.fsp.access(command["export-out"], modules.fsp.constants.W_OK);
      } catch {
        modules.ipc.invoke("cli-message", "Error: target directory not writable");
        modules.ipc.invoke("cli-return-code", 1);
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
    modules.ipc.invoke("cli-return-code", 0);
  },

  // COMMAND: export Artikel.json
  //   command = object
  async articleJSON (command) {
    // ERROR: Zeitstrahl data not present
    if (!Object.keys(artikel.zeitstrahl).length) {
      modules.ipc.invoke("cli-message", "Error: Zeitstrahl data missing");
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // Okay, let's export the data!
    modules.ipc.invoke("cli-message", "Exporting Artikel.json . . .");
    try {
      // calculate data
      await artikel.calculate({
        cli: true,
        noNew: command["no-new"],
      });
      // write file
      const path = modules.path.join(command["export-out"], "Artikel.json");
      await modules.fsp.writeFile(path, JSON.stringify(artikel.data.json));
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
    modules.ipc.invoke("cli-message", "Exporting overview page . . .");
    try {
      // calculate page
      const page = await overview.calculate(command["no-new"], true);
      if (!page) {
        return false;
      }
      // write file
      const path = modules.path.join(command["export-out"], "artikel.tt");
      await modules.fsp.writeFile(path, page);
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
    modules.ipc.invoke("cli-message", "Exporting terminology . . .");
    const type = command["export-terminology-type"] || "tt";
    const file = term.makeFile(type, command["no-new"]);

    // save file
    try {
      const path = modules.path.join(command["export-out"], `terminologie.${type}`);
      await modules.fsp.writeFile(path, file);
      return true;
    } catch {
      modules.ipc.invoke("cli-message", "Error: writing terminology file failed");
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }
  },

  // COMMAND: transform SVG file
  //   command = object
  async svg (command) {
    const path = command["transform-svg"];

    // ERROR: path does not exist
    const exists = await modules.ipc.invoke("exists", path);
    if (!exists) {
      modules.ipc.invoke("cli-message", "Error: SVG file not found");
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // ERROR: not of type file
    const stats = await modules.fsp.lstat(path);
    if (!stats.isFile()) {
      modules.ipc.invoke("cli-message", "Error: SVG file path not a file");
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // backup current file data
    const backup = { ...svg.file };

    // load XSLT files (if necessary)
    if (!Object.values(svg.xslt).some(i => i)) {
      const xslt = await svg.loadXslt();
      if (!xslt) {
        modules.ipc.invoke("cli-message", "Error: loading XSLT files failed");
        modules.ipc.invoke("cli-return-code", 1);
        return false;
      }
    }

    // load SVG file
    try {
      svg.file.content = await modules.fsp.readFile(path, { encoding: "utf8" });
      svg.file.path = path;
    } catch {
      modules.ipc.invoke("cli-message", "Error: reading SVG file failed");
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // transform file
    modules.ipc.invoke("cli-message", "Transforming SVG file . . .");
    const trans = svg.transformExecute();
    if (trans.err !== false) {
      modules.ipc.invoke("cli-message", `Error: transformation failed (${trans.err})`);
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }
    try {
      await modules.fsp.writeFile(trans.path, trans.str);
    } catch {
      modules.ipc.invoke("cli-message", "Error: writing SVG file failed");
      modules.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // restore file data backup
    svg.file = { ...backup };

    return true;
  },

  // return message from unspecified error
  //   err = object
  unspecifiedError (err) {
    modules.ipc.invoke("cli-message", `Error: program error\n\n${err.name}: ${err.message}`);
    modules.ipc.invoke("cli-return-code", 1);
  },
};
