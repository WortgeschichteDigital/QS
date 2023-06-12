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
      shared.ipc.invoke("cli-message", `Error: program error\n\n${err.name}: ${err.message}`);
      shared.ipc.invoke("cli-return-code", 1);
      return false;
    }
  },
};
