"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("modules", {
  async bufferFrom (str) {
    return await ipcRenderer.invoke("ctxBridge-buffer-from", str);
  },

  ipc: {
    async invoke (command, data = null) {
      const validCommands = [
        "app-info",
        "close",
        "error",
        "popup",
        "pv",
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

  path: {
    async join (...args) {
      return await ipcRenderer.invoke("ctxBridge-path-join", args);
    },
  },

  async process () {
    const platform = await ipcRenderer.invoke("ctxBridge-process-platform");
    return {
      platform,
    };
  },
});
