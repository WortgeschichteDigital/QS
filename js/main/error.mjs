
import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export { error as default };

const error = {
  // prepare error strings for better readability
  //   err = string
  errorString (err) {
    let error = err.replace(/\n/g, "<br>");
    error = error.replace(/(?<!<)[/\\]/g, m => `${m}<wbr>`);
    return error;
  },

  // register an error in main.mjs
  //   err = object
  register (err) {
    let e = `\n----- ${new Date().toISOString()} -----\n`;
    e += "main.mjs\n";
    e += err.stack + "\n";
    error.log(e);
  },

  // log variables
  logFile: path.join(app.getPath("userData"), "error.log"),
  // stash for errors in case many errors appear in fast succession
  logStash: "",
  // timeout so that the error log is not written too often
  logTimeout: undefined,

  // write recent errors to log file
  //   err = string
  log (err) {
    clearTimeout(error.logTimeout);
    error.logStash += err;
    error.logTimeout = setTimeout(() => {
      fs.appendFile(error.logFile, error.logStash)
        .then(() => {
          error.logStash = "";
        });
    }, 5e3);
  },
};
