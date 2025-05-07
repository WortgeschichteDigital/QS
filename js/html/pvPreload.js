"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modules", {
  ipc: {
    async invoke (command, data = null) {
      const validCommands = [
        "app-info",
        "close",
        "error",
        "popup",
        "process-info",
        "pv",
        "pv-nav",
        "pv-new",
      ];
      if (!validCommands.includes(command)) {
        return null;
      }
      return await ipcRenderer.invoke(command, data);
    },

    on (command, callback) {
      ipcRenderer.on(command, callback);
    },
  },
});
