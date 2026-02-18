
import hints from "./workerHints.mjs";

import shared from "../shared.mjs";

export { xml as default };

const xml = {
  // XML file data (see app/xml.js)
  data: {},

  // XML file content (see app/xml.js)
  files: {},

  // directory with Git repository
  gitDir: "",

  // errors that occured during the update process
  updateErrors: [],

  // fill file data
  //   updated = array (names of files that were updated)
  fillData (updated) {
    for (const file of updated) {
      const doc = new DOMParser().parseFromString(xml.files[file], "text/xml");

      // XML not well-formed
      if (doc.querySelector("parsererror")) {
        xml.updateErrors.push({
          file,
          err: "XML not well-formed",
        });
        delete xml.data.files[file];
        continue;
      }

      // parse file
      // (assume that authors try to parse invalid XML files;
      // therefore, let's wrap it all in a try block)
      const data = xml.data.files[file];
      try {
        // authors
        data.authors = [];
        doc.querySelectorAll("Revision Autor").forEach(i => {
          if (i.getAttribute("Funktion") && !/^Autor/.test(i.getAttribute("Funktion"))) {
            return;
          }
          const text = i.textContent;
          if (!data.authors.includes(text)) {
            data.authors.push(text);
          }
        });

        // field
        data.fa = doc.querySelector('Artikel[Typ="Wortfeldartikel"]') !== null;

        // data.faLemmas is filled after the link analysis
        data.faLemmas = [];

        // main lemmas
        data.hl = [];
        data.hlJoined = [];
        doc.querySelectorAll('Artikel > Lemma[Typ="Hauptlemma"]').forEach(i => {
          const schreibungen = [];
          i.querySelectorAll("Schreibung").forEach(s => {
            const hidx = s.getAttribute("hidx");
            let schreibung = s.textContent;
            if (hidx) {
              schreibung += ` (${hidx})`;
            }
            schreibungen.push(schreibung);
          });
          if (data.fa) {
            schreibungen[0] += " (Wortfeld)";
          }
          data.hl = data.hl.concat(schreibungen);
          data.hlJoined.push(schreibungen.join("/"));
        });

        // sub lemmas
        data.nl = [];
        data.nlJoined = [];
        doc.querySelectorAll('Artikel > Lemma[Typ="Nebenlemma"]').forEach(i => {
          const schreibungen = [];
          i.querySelectorAll("Schreibung").forEach(s => {
            const hidx = s.getAttribute("hidx");
            let schreibung = s.textContent;
            if (hidx) {
              schreibung += ` (${hidx})`;
            }
            schreibungen.push(schreibung);
          });
          data.nl = data.nl.concat(schreibungen);
          data.nlJoined.push(schreibungen.join("/"));
        });

        // diasystemic information
        data.diasys = [];
        let [ lemma ] = data.hlJoined;
        doc.querySelectorAll("Lesarten").forEach(l => {
          const schreibung = l.querySelector("Lemma Schreibung")?.textContent;
          if (schreibung) {
            const hlReg = new RegExp(`(^|/)${schreibung}(/|$)`);
            for (const hl of data.hlJoined) {
              if (hlReg.test(hl)) {
                lemma = hl;
                break;
              }
            }
          }
          l.querySelectorAll("Diasystematik > *").forEach(i => {
            data.diasys.push({
              category: i.nodeName,
              value: i.textContent,
              lemma,
            });
          });
        });

        // topic domains
        data.domains = [];
        doc.querySelectorAll("Artikel > Diasystematik Themenfeld").forEach(i => {
          data.domains.push(i.textContent);
        });

        // create array for hints
        // (filled in hints.glean())
        data.hints = [];

        // file ID
        data.id = doc.querySelector("Artikel").getAttribute("xml:id");

        // collect all links
        data.links = [];
        doc.querySelectorAll("Verweis").forEach(i => {
          const verweistext = i.querySelector("Verweistext").textContent.trim();
          const vz = i.querySelector("Verweisziel");
          let verweisziel = vz.textContent.trim();
          const hidx = vz.getAttribute("hidx");
          if (hidx) {
            verweisziel += ` (${hidx})`;
          }
          const scopePoints = xml.getScopePoints(i);
          data.links.push({
            lemma: {},
            line: xml.getLineNumber({
              doc,
              ele: i,
              file: xml.files[file],
            }),
            points: scopePoints.points,
            scope: scopePoints.scope,
            type: i?.getAttribute("Typ")?.split(" ") || [],
            verweistext,
            verweisziel,
          });
        });

        // publication date
        const published = doc.querySelector("Revision Datum").textContent.split(".");
        data.published = published[2] + "-" + published[1] + "-" + published[0];

        // all possibile targets within the article
        data.targets = [];
        doc.querySelectorAll("Wortgeschichte *").forEach(i => {
          const id = i.getAttribute("xml:id");
          if (id) {
            data.targets.push(id);
          }
        });
      } catch (err) {
        xml.updateErrors.push({
          file,
          err: `${err.name}: ${err.message}`,
        });
      }
    }

    // fill "lemma" in all links and "faLemmas" in field articles
    for (const values of Object.values(xml.data.files)) {
      if (!values.links) {
        // in case an XML file could not be read due to a "not well-formed" error
        continue;
      }
      for (const link of values.links) {
        const lemma = xml.getLemma(link.verweistext, link.verweisziel);
        link.lemma = lemma;
      }
      // fill "faLemmas" in field articles
      if (values.fa) {
        for (const link of values.links) {
          if (link.scope !== "Verweise" ||
              !link.lemma.spelling ||
              values.faLemmas.includes(link.lemma.spelling)) {
            continue;
          }
          const file = xml.data.files[link.lemma.file];
          let spellings = [ link.lemma.spelling ];
          if (!file.hlJoined.includes(spellings[0]) &&
              !file.nlJoined.includes(spellings[0])) {
            const reg = new RegExp(`(^|/)${shared.escapeRegExp(spellings[0])}(/| \\(|$)`);
            for (const lemma of file.hlJoined.concat(file.nlJoined)) {
              if (reg.test(lemma)) {
                const hidx = lemma.match(/ \(.+?\)$/);
                spellings = lemma.split("/");
                if (hidx) {
                  for (let i = 0, len = spellings.length - 1; i < len; i++) {
                    spellings[i] += hidx[0];
                  }
                }
                break;
              }
            }
          }
          for (const s of spellings) {
            values.faLemmas.push(s);
          }
        }
      }
    }

    // purge files that produced errors
    // (this has to be done here as well,
    // as all files are parsed again in hints.glean())
    for (const i of xml.updateErrors) {
      delete xml.data.files[i.file];
      delete xml.files[i.file];
    }
  },

  // determine scope and cluster points of the given link
  //   link = node
  getScopePoints (link) {
    if (link.closest("Anmerkung") ||
        link.closest("Abschnitt") &&
        link.closest("Abschnitt").getAttribute("Relevanz") === "niedrig") {
      // footnote or learn more (Mehr erfahren)
      return {
        points: 1,
        scope: "Wortgeschichte",
      };
    } else if (link.closest("Wortgeschichte")) {
      // continuous text (base value)
      return {
        points: 2,
        scope: "Wortgeschichte",
      };
    } else if (link.closest("Wortgeschichte_kompakt")) {
      // summary (Kurz gefasst)
      return {
        points: 3,
        scope: "Kurz gefasst",
      };
    } else if (link.closest("Verweise")) {
      if (link.closest("Verweise").getAttribute("Typ") === "Wortfeldartikel") {
        // link to field article
        return {
          points: 10,
          scope: "Verweise",
        };
      }
      // structured reference list
      return {
        points: 3,
        scope: "Verweise",
      };
    }
    // this should never happen
    return {
      points: 0,
      scope: "",
    };
  },

  // get the actual lemma a <Verweisziel> points to
  //   vt = string (text contents of <Verweistext>)
  //   vz = string (contents of <Verweisziel> + @hidx in parens if present)
  getLemma (vt, vz) {
    let [ lemma, hash ] = vz.split("#");
    if (/ \([1-9]\)$/.test(hash)) {
      // this hashed lemma has an @hidx
      const hidx = hash.match(/ \(([1-9])\)$/)[1];
      lemma += ` (${hidx})`;
    }
    if (/^Wortfeld-/.test(lemma)) {
      lemma = lemma.replace(/^Wortfeld-/, "");
      lemma += " (Wortfeld)";
    }
    for (const [ file, values ] of Object.entries(xml.data.files)) {
      if (values.hl.includes(lemma) || values.nl.includes(lemma)) {
        return {
          file,
          spelling: lemma,
        };
      }
    }
    // this can happen when the user tagged an unresolvable <Verweisziel>
    return {
      file: "",
      spelling: "",
    };
  },

  // get line number of current element
  //   doc = document (parsed XML file)
  //   ele = node
  //   file = string (unparsed XML file)
  //   idx = number | undefined (set in case ele is a comment node)
  getLineNumber ({ doc, ele, file, idx = -1 }) {
    let content = file;

    // erase comments but retain the line breaks
    // (tags of the searched type can be located within a comment
    // which would produce bogus line counts)
    if (idx === -1) {
      content = file.replace(/<!--.+?-->/gs, m => {
        const n = m.match(/\n/g);
        if (n) {
          return "\n".repeat(n.length);
        }
        return "";
      });
    }

    // search line number
    const { nodeName } = ele;
    let reg = new RegExp(`<${nodeName}(?=[ >])`, "g");
    let hitIdx = 0;
    if (idx === -1) {
      // element nodes
      const nodes = doc.getElementsByTagName(nodeName);
      for (let i = 0, len = nodes.length; i < len; i++) {
        if (nodes[i] === ele) {
          hitIdx = i;
          break;
        }
      }
    } else {
      // comment nodes
      reg = /<!--/g;
      hitIdx = idx;
    }
    let offset = 0;
    for (let i = 0; i <= hitIdx; i++) {
      offset = reg.exec(content).index;
    }

    return content.substring(0, offset).split("\n").length;
  },

  // write cache file
  async writeCache () {
    const path = await bridge.ipc.invoke("path-join", shared.info.userData, `xml-cache-${xml.data.branch}.json`);
    const written = await bridge.ipc.invoke("file-write", path, JSON.stringify(xml.data));
    if (written !== true) {
      xml.updateErrors.push({
        file: "Cache",
        err: `${written.name}: ${written.message} (${shared.errorReduceStack(written.stack)})`,
      });
    }
  },

  // execute update operation
  //   data = object (worker data)
  async update (data) {
    // prepare data
    xml.data = data.data;
    xml.files = data.files;
    xml.gitDir = data.gitDir;
    xml.updateErrors = [];
    const { changed, untracked, xmlFiles } = data;

    // get XML files
    const files = xmlFiles || await bridge.ipc.invoke("xml-files", xml.gitDir);
    const updated = [];
    for (const [ k, v ] of Object.entries(files)) {
      // save file content
      xml.files[k] = v.xml;
      // update file data?
      if (xml.data.files?.[k]?.hash !== v.hash ||
          xml.data.files?.[k]?.dir !== v.dir ||
          data.newAppVersion) {
        updated.push(k);
        xml.data.files[k] = {};
        for (const [ key, val ] of Object.entries(v)) {
          if (key === "xml") {
            continue;
          }
          xml.data.files[k][key] = val;
        }
      }
    }

    // remove files that don't exist anymore from data objects
    // removedFiles === true => some files were removed => update all hints
    let removedFiles = false;

    // don't remove any file in case only some files were received
    if (!xmlFiles) {
      for (const file of Object.keys(xml.data.files)) {
        if (!files[file]) {
          removedFiles = true;
          delete xml.data.files[file];
          if (xml.files[file]) {
            delete xml.files[file];
          }
        }
      }
    }

    // handle changed and untracked files
    for (const file of changed.concat(untracked)) {
      if (!/^articles\//.test(file)) {
        continue;
      }
      const name = file.split("/")[1].trim();
      if (xml.data.files[name]) {
        // deleted files appear as changed
        xml.data.files[name].status = changed.includes(file) ? 1 : 2;
      }
    }

    // analyze new files
    if (updated.length) {
      xml.fillData(updated);
    }

    // glean hints & save data to cache file
    if (updated.length || removedFiles) {
      await hints.glean();
      xml.data.date = new Date().toISOString();
      await xml.writeCache();
    }

    // reset the status of files that are neither changed nor untracked anymore
    x: for (const [ file, values ] of Object.entries(xml.data.files)) {
      // no need to check this file because
      //   - it has been known and was unchanged
      //   - it has already been updated
      if (!values.status || updated.includes(file)) {
        continue;
      }

      // check whether the file is still changed or untracked
      const reg = new RegExp("/" + RegExp.escape(file) + "$");
      const cu = [ changed, untracked ];
      for (let i = 1; i <= 2; i++) {
        const current = cu[i - 1];
        for (const f of current) {
          if (reg.test(f)) {
            if (values.status !== i) {
              values.status = i;
              xml.data.date = new Date().toISOString();
            }
            continue x;
          }
        }
      }
      values.status = 0;
      xml.data.date = new Date().toISOString();
    }

    // send data to main window
    bridge.ipc.invoke("xml-worker-done", {
      data: xml.data,
      files: xml.files,
      updateErrors: xml.updateErrors,
    });
  },
};
