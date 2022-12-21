"use strict";

const updates = {
  // saves the timeout that is set after starting the app
  timeout: undefined,

  // check for updates
  //   auto = boolean (automatic check => no feedback in case of error)
  async check (auto) {
    clearTimeout(updates.timeout);
    // don't check while developing
    if (auto && !shared.info.packaged) {
      return;
    }
    // download RSS feed
    const data = await shared.fetch("https://github.com/WortgeschichteDigital/QS/releases.atom");
    // error
    if (!data.ok) {
      if (!auto) {
        shared.error(`${data.err.name}: ${data.err.message}`);
      }
      return;
    }
    // parse RSS feed
    const parser = new DOMParser();
    const rss = parser.parseFromString(data.text, "text/xml");
    const entries = rss.querySelectorAll("entry");
    if (!entries.length) {
      // no entries found, so probably the feed was not well-formed
      // (which happens sometimes)
      if (!auto) {
        shared.error("Server-Fehler: RSS-Feed nicht wohlgeformt");
      }
      return;
    }
    // detect newest version
    let versionOnline;
    for (let i = 0, len = entries.length; i < len; i++) {
      const entry = entries[i];
      const version = entry.querySelector("id").firstChild.nodeValue.match(/[0-9]+\.[0-9]+\.[0-9]+$/);
      if (!version) {
        continue;
      }
      [ versionOnline ] = version;
      break;
    }
    // display outcome
    if (updates.verToInt(versionOnline) > updates.verToInt(shared.info.version)) {
      dialog.open({
        type: "alert",
        text: `Es gibt ein <b>Update</b>!\n<span class="update">installiert:</span>v${shared.info.version}<br><span class="update">online:</span>v${versionOnline}`,
      });
    } else if (!auto) {
      dialog.open({
        type: "alert",
        text: "Die App is up-to-date.",
      });
    }
    // memorize last update check
    [ prefs.data.updateCheck ] = new Date().toISOString().split("T");
  },

  // convert a version string into an integer
  //   version = string
  verToInt (version) {
    let [ v ] = version.split("-");
    v = v.replace(/[0-9]+/g, m => m.padStart(3, "0"));
    v = v.replace(/\./g, "");
    return parseInt(v, 10);
  },
};
