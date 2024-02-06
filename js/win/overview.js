"use strict";

const overview = {
  // open the overlay
  async show () {
    await overview.message();
    overlay.show("overview");
    document.querySelector("#overview-calculate").focus();
  },

  // update the messages
  async message () {
    const branch = await git.branchCurrent();
    const div = document.querySelector("#overview-branch");
    const img = div.querySelector("img");
    const p = div.querySelector("p:last-child");
    if (branch === "master") {
      img.src = "img/win/button-yes.svg";
      p.classList.add("off");
    } else {
      img.src = "img/win/button-no.svg";
      p.classList.remove("off");
    }
  },

  // change branch to master
  async changeBranch () {
    await git.commandBranch("master");
    overview.message();
  },

  // template file
  tt: "",

  // calculate the overview
  //   noNew = boolean
  //   cli = boolean
  async calculate (noNew, cli) {
    // get template
    let { tt } = overview;
    if (!tt) {
      // load XSL (if needed)
      const result = await win.loadXsl({
        obj: overview,
        key: "tt",
        xsl: "overview.tt",
      });
      if (!result) {
        return false;
      }
      tt = overview.tt;
    }

    // fill in articles
    const content = overview.make(noNew);
    const page = tt.replace('<div id="wgd-liste"></div>', `<div id="wgd-liste">\n${content}\n</div>`);

    // return page if called via CLI
    if (cli) {
      return page;
    }

    // save file
    const options = {
      title: "index.tt speichern",
      defaultPath: modules.path.join(shared.info.documents, "index.tt"),
      filters: [
        {
          name: "TemplateToolkit",
          extensions: [ "tt" ],
        },
      ],
    };
    if (prefs.data.zdl) {
      options.defaultPath = modules.path.join(prefs.data.zdl, "root", "wb", "wortgeschichten", "index.tt");
    }
    const result = await modules.ipc.invoke("file-dialog", false, options);
    if (result.canceled || !result.filePath) {
      return false;
    }
    try {
      await modules.fsp.writeFile(result.filePath, page);
      return true;
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
      return false;
    }
  },

  // make overview page
  //   noNew = boolean
  make (noNew) {
    // compile entry list
    const entries = [];
    for (const file of Object.values(xml.data.files)) {
      // skip new files (if requested)
      if (noNew && file.status === 2) {
        continue;
      }

      // article link
      const artLink = encodeURIComponent(shared.hidxClear(file.hl[0]));

      // Hauptlemmata
      for (const hl of file.hl) {
        // create entry
        const text = shared.hidxClear(hl);
        const entry = {
          letter: letter(hl),
          id: file.id,
          // "typ" has to be in German
          typ: file.fa ? "Wortfeldartikel" : "Hauptlemma",
          text,
          link: (file.fa ? "Wortfeld-" : "") + artLink,
          list: [],
        };
        entries.push(entry);

        // fill lemma list if applicable
        if (file.hlJoined.length > 1) {
          // the main lemma is in an article with multiple main lemmas
          // (as regards this, multiple spellings don't count)
          entry.link = "";
          entry.list.push({
            text: shared.hidxClear(file.hlJoined, true).join("&nbsp;· "),
            link: artLink,
            nl: false,
          });
        }
        if (file.nl.length) {
          // the main lemma's article has sub lemmas
          for (const nl of file.nlJoined) {
            const [ lemma ] = nl.split("/");
            entry.list.push({
              text: shared.hidxClear(nl),
              link: artLink + "#" + encodeURIComponent(file.nlTargets[lemma]),
              nl: true,
            });
          }
        } else if (file.fa) {
          // this is a field article
          for (const lemma of file.faLemmas) {
            for (const link of file.links) {
              if (link.lemma.spelling !== lemma) {
                continue;
              }
              // detect lemma type and further spellings
              const target = xml.data.files[link.lemma.file];
              const nl = !!target.nlTargets[link.lemma.spelling];
              const joined = nl ? target.nlJoined : target.hlJoined;
              const reg = new RegExp(`(^|/)${shared.escapeRegExp(shared.hidxClear(lemma))}(/| \\(|$)`);
              let text;
              for (const i of joined) {
                if (reg.test(i)) {
                  text = shared.hidxClear(i);
                  break;
                }
              }
              if (!entry.list.some(i => i.text === text)) {
                const artLink = encodeURIComponent(shared.hidxClear(target.hl[0]));
                let link;
                if (nl) {
                  link = artLink + "#" + encodeURIComponent(target.nlTargets[lemma]);
                } else {
                  link = artLink;
                }
                entry.list.push({
                  text,
                  link,
                  nl,
                });
              }
              break;
            }
          }
        }

        // create reference
        createReferences(entry, text);
      }

      // Nebenlemmata
      for (const nl of file.nl) {
        // create entry
        const text = shared.hidxClear(nl);
        const entry = {
          letter: letter(nl),
          id: file.id,
          // "typ" has to be in German
          typ: "",
          text,
          link: "",
          list: [
            {
              text: shared.hidxClear(file.hlJoined.join("&nbsp;· "), true),
              link: artLink + "#" + encodeURIComponent(file.nlTargets[nl]),
              nl: false,
            },
          ],
        };
        entries.push(entry);

        // create reference
        createReferences(entry, text);
      }
    }

    // create references
    function createReferences (entry, entryText) {
      // don't create reference because:
      //   * the entry only consists of one (relevant) word
      const text = entryText.replace(shared.artReg, "");
      if (!/ /.test(text)) {
        return;
      }

      // collect upper case words
      const words = text.split(" ");
      const upper = [];
      for (const word of words) {
        if (/^[A-ZÄÖÜ]/.test(word)) {
          upper.push(word);
        }
      }

      // don't create a reference because:
      //   * all words are upper case
      //     (but allow references for namelike expressions like "Friedliche Revolution")
      //   * the first word is the only upper case word
      const isAdjSub = /^[A-ZÄÖÜ][^\s]+(bar|lich|isch)e[mnrs]? [A-ZÄÖÜ][^\s]+$/.test(text);
      if (upper.length === words.length && !isAdjSub ||
          upper.length === 1 && words[0] === upper[0]) {
        return;
      }

      // create reference(s)
      for (let i = 0, len = upper.length; i < len; i++) {
        // detect text
        let ref;
        if (upper[i] === words[0]) {
          continue;
        } else if (isAdjSub ||
            upper.length === 1 && upper[0] === words[words.length - 1]) {
          ref = upper[i] + ", " + entryText.replace(/ [^\s]+$/, "");
        } else {
          ref = upper[i] + "&nbsp;→ " + entryText;
        }

        // push new entry
        const newEntry = structuredClone(entry);
        newEntry.letter = letter(ref);
        newEntry.text = ref;
        if (!newEntry.link) {
          newEntry.link = newEntry.list[0].link;
        }
        entries.push(newEntry);
      }
    }

    // sort entries
    shared.sortModeForLemmas = true;
    entries.sort((a, b) => shared.sort(a.text, b.text));
    shared.sortModeForLemmas = false;

    // make and return HTML code
    const base = "[% base %]wb/wortgeschichten/";
    let currentLetter = "";
    let html = "";
    for (const i of entries) {
      // print alpha block
      if (currentLetter !== i.letter) {
        currentLetter = i.letter;
        html += `<div class="wgd-ab"><p>${currentLetter}</p></div>\n\n`;
      }
      // print entry
      html += "<div";
      for (const ds of [ "id", "typ" ]) {
        if (i[ds]) {
          html += ` data-${ds}="${i[ds]}"`;
        }
      }
      html += ">\n<p>";
      let text = i.text.replace(/\//, "/<wbr>");
      if (!i.link) {
        html += shy(text);
      } else {
        let ref = "";
        if (/→/.test(text)) {
          const refText = text.split("→ ");
          ref = refText[0] + "→ ";
          text = refText[1];
        }
        html += `${ref}<a href="${base}${i.link}">${shy(text)}</a>`;
      }
      html += "</p>\n";
      if (i.list.length && !/→/.test(i.text)) {
        html += "<ul>\n";
        for (const li of i.list) {
          const cl = li.nl ? ' class="wgd-nl"' : "";
          const liText = li.text.replace(/\//, "/<wbr>");
          html += `${" ".repeat(2)}<li${cl}><a href="${base}${li.link}">${shy(liText)}</a></li>\n`;
        }
        html += "</ul>\n";
      }
      html += "</div>\n\n";
    }
    return html.trim();

    // detect letter of the alphabet
    function letter (lemma) {
      const text = lemma.replace(shared.artReg, "");
      const first = text.substring(0, 1);
      if (/[0-9]/.test(first)) {
        return "#";
      } else if (/ä/i.test(first)) {
        return "A";
      } else if (/ö/i.test(first)) {
        return "O";
      } else if (/ü/i.test(first)) {
        return "U";
      }
      return first.toUpperCase();
    }

    // insert soft hypen(s)
    // (this code is also used for zdl.org:
    // static/wgd/start/art.mjs)
    function shy (entryText) {
      const rep = new Set([
        [ /(?<=[a-z])bewegung/, "&shy;bewegung" ],
        [ /(?<=[a-z])durchsetzungs(?=[a-z])/, "&shy;durchsetzungs&shy;" ],
        [ /(?<=[a-z])theoretiker/, "&shy;theoretiker" ],
        [ /(?<=[a-z])theorie/, "&shy;theorie" ],
        [ /(?<=[a-z])verlierer/, "&shy;verlierer" ],
      ]);
      let text = entryText;
      for (const [ k, v ] of rep) {
        text = text.replace(k, v);
      }
      return text;
    }
  },
};
