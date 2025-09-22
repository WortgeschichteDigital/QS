
const validInvokes = [
  "app-info",
  "clear-cache",
  "cli-message",
  "cli-return-code",
  "close",
  "command",
  "error",
  "exists",
  "file-access-write",
  "file-copy",
  "file-dialog",
  "file-read",
  "file-readdir",
  "file-unlink",
  "file-write",
  "git-config",
  "git-save",
  "help",
  "list-of-images",
  "open-external",
  "open-path",
  "path-info",
  "path-join",
  "path-parse",
  "popup",
  "prefs",
  "prefs-save",
  "pv",
  "pv-close-all",
  "pv-nav",
  "pv-new",
  "xml-files",
  "xml-worker-done",
  "xml-worker-work",
];

const validListeners = [
  "cli-command",
  "close",
  "copy-link",
  "filters-reset",
  "init-done",
  "menu-app-updates",
  "menu-artikel-json",
  "menu-clusters",
  "menu-error-log",
  "menu-filters",
  "menu-hints",
  "menu-overview",
  "menu-preferences",
  "menu-search",
  "menu-svg",
  "menu-teaser-tags",
  "menu-term",
  "menu-update",
  "menu-xml",
  "results",
  "save-prefs",
  "show",
  "update-file",
  "update-icons",
  "work",
];

const {
  contextBridge,
  ipcRenderer,
} = require("electron");

contextBridge.exposeInMainWorld("bridge", {
  ipc: {
    async invoke (command, ...args) {
      if (!validInvokes.includes(command)) {
        return null;
      }
      return await ipcRenderer.invoke(command, ...args);
    },

    listen (command, callback) {
      if (!validListeners.includes(command)) {
        return;
      }
      ipcRenderer.on(command, (evt, ...args) => callback(...args));
    },
  },
});
