
import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

import services from "./services.mjs";

export { prefs as default };

const prefs = {
  // contents of preferences.json
  data: {
    git: {
      dir: "",
      user: "",
    },
    options: {},
    win: {},
  },

  // path to preferences file
  file: path.join(app.getPath("userData"), "preferences.json"),

  // read preferences
  async read () {
    const exists = await services.exists(prefs.file);
    if (!exists) {
      return false;
    }
    const content = await fs.readFile(prefs.file, { encoding: "utf8" });
    try {
      prefs.data = JSON.parse(content);
      return true;
    } catch {
      // the preferences file is corrupt => erase it
      fs.unlink(prefs.file);
      return false;
    }
  },

  // write preferences
  write () {
    return new Promise(resolve => {
      fs.writeFile(prefs.file, JSON.stringify(prefs.data))
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  },
};
