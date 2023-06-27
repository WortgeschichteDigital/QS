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
          shared.ipc.invoke("cli-message", "Error: export directory not specified");
          shared.ipc.invoke("cli-return-code", 1);
          return;
        }
      }
    }

    // basic checks for the export directory
    if (command["export-out"]) {
      // ERROR: path not absolute
      if (!shared.path.isAbsolute(command["export-out"])) {
        shared.ipc.invoke("cli-message", "Error: path not absolute");
        shared.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: target does not exist
      const exists = await shared.ipc.invoke("exists", command["export-out"]);
      if (!exists) {
        shared.ipc.invoke("cli-message", "Error: path target nonexistent");
        shared.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: path is not a directory
      const stats = await shared.fsp.lstat(command["export-out"]);
      if (!stats.isDirectory()) {
        shared.ipc.invoke("cli-message", "Error: path not a directory");
        shared.ipc.invoke("cli-return-code", 1);
        return;
      }

      // ERROR: directory not writable
      try {
        await shared.fsp.access(command["export-out"], shared.fsp.constants.W_OK);
      } catch {
        shared.ipc.invoke("cli-message", "Error: target directory not writable");
        shared.ipc.invoke("cli-return-code", 1);
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

    // COMMAND: transform SVG file
    if (command["transform-svg"]) {
      const result = await cli.svg(command);
      if (!result) {
        return;
      }
    }

    // everything done
    shared.ipc.invoke("cli-return-code", 0);
  },

  // COMMAND: export Artikel.json
  //   command = object
  async articleJSON (command) {
    // ERROR: Zeitstrahl data not present
    if (!Object.keys(artikel.zeitstrahl).length) {
      shared.ipc.invoke("cli-message", "Error: Zeitstrahl data missing");
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // Okay, let's export the data!
    shared.ipc.invoke("cli-message", "Exporting Artikel.json . . .");
    try {
      // calculate data
      await artikel.calculate({
        cli: true,
        noNew: command["no-new"],
      });
      // write file
      const path = shared.path.join(command["export-out"], "Artikel.json");
      await shared.fsp.writeFile(path, JSON.stringify(artikel.data.json));
      return true;
    } catch (err) {
      // unspecified error
      cli.unspecifiedError(err);
      return false;
    }
  },

  // COMMAND: export overview page
  async overview (command) {
    shared.ipc.invoke("cli-message", "Exporting overview page . . .");
    try {
      // calculate page
      const page = await overview.calculate(command["no-new"], true);
      if (!page) {
        return false;
      }
      // write file
      const path = shared.path.join(command["export-out"], "index.tt");
      await shared.fsp.writeFile(path, page);
      return true;
    } catch (err) {
      // unspecified error
      cli.unspecifiedError(err);
      return false;
    }
  },

  // COMMAND: transform SVG file
  async svg (command) {
    const path = command["transform-svg"];

    // ERROR: path does not exist
    const exists = await shared.ipc.invoke("exists", path);
    if (!exists) {
      shared.ipc.invoke("cli-message", "Error: SVG file not found");
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // ERROR: not of type file
    const stats = await shared.fsp.lstat(path);
    if (!stats.isFile()) {
      shared.ipc.invoke("cli-message", "Error: SVG file path not a file");
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // backup current file data
    const backup = { ...svg.file };

    // load XSLT files (if necessary)
    if (!Object.values(svg.xslt).some(i => i)) {
      const xslt = await svg.loadXslt();
      if (!xslt) {
        shared.ipc.invoke("cli-message", "Error: loading XSLT files failed");
        shared.ipc.invoke("cli-return-code", 1);
        return false;
      }
    }

    // load SVG file
    try {
      svg.file.content = await shared.fsp.readFile(path, { encoding: "utf8" });
      svg.file.path = path;
    } catch {
      shared.ipc.invoke("cli-message", "Error: reading SVG file failed");
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // transform file
    shared.ipc.invoke("cli-message", "Transforming SVG file . . .");
    const trans = svg.transformExecute();
    if (trans.err !== false) {
      shared.ipc.invoke("cli-message", `Error: transformation failed (${trans.err})`);
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }
    try {
      await shared.fsp.writeFile(trans.path, trans.str);
    } catch {
      shared.ipc.invoke("cli-message", "Error: writing SVG file failed");
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }

    // restore file data backup
    svg.file = { ...backup };

    return true;
  },

  // return message from unspecified error
  //   err = object
  unspecifiedError (err) {
    shared.ipc.invoke("cli-message", `Error: program error\n\n${err.name}: ${err.message}`);
    shared.ipc.invoke("cli-return-code", 1);
  },
};
