"use strict";

const term = {
  // terminology data
  //   Termini      = {}  terms
  //     ***** full entry *****
  //       reg      = ""  regular search expression
  //       auch     = []  alternative term name
  //       ober     = []  hypernym; points to Temini[ober[n]]
  //       unter    = []  hyponym; points to Termini[unter[n]]
  //       sauch    = []  see also; points to Termini[sauch[n]]
  //       text     = []  explanation text
  //         typ    = ""  paragraph type:
  //                        bsp-kurz = example for popup + overview page
  //                        bsp-lang = example for overview page only
  //                        txt-kurz = explanatory text for popup + overview page
  //                        txt-lang = explanotory text for overview page only
  //         html   = ""  text content (formatted in HTML)
  //       lit      = []  literature
  //         sigle  = ""  abbrevation; points to Literatur[sigle]
  //         seite  = ""  page, including comments (formatted in HTML)
  //     ***** reference *****
  //       reg      = ""  regular search expression
  //       siehe    = ""  reference term; points to Termini[siehe]
  //   Literatur    = {}  cited literature
  //     [sigle]    = {}  abbreviation
  //       ppn      = ""  the title's PPN; points to an titel in https://kxp.k10plus.de/DB=2.1/
  //       titel    = ""  complete bibliographical information (formatted in HTML)
  json: null,

  // template file
  tt: "",

  // open the overlay
  show () {
    overlay.show("term");
    document.querySelector("#term-export").focus();
  },

  // export
  async exportFile () {
    // load Terminologie.json and template
    const json = await term.load(false);
    if (!json) {
      return;
    }

    // get exporte type
    const type = document.querySelector('#term [name="term-type"]:checked').id.replace(/.+-/, "");

    // make file
    const file = term.makeFile(type, true);

    // save file
    const options = {
      title: `terminologie.${type} speichern`,
      defaultPath: modules.path.join(shared.info.documents, `terminologie.${type}`),
      filters: [
        {
          name: "TemplateToolkit",
          extensions: [ "tt" ],
        },
      ],
    };
    if (type === "html") {
      options.filters[0] = {
        name: "HTML",
        extensions: [ "html", "htm" ],
      };
    }
    if (prefs.data.zdl) {
      options.defaultPath = modules.path.join(prefs.data.zdl, "root", "wb", "WGd", `terminologie.${type}`);
    }
    const result = await modules.ipc.invoke("file-dialog", false, options);
    if (result.canceled || !result.filePath) {
      return;
    }
    try {
      await modules.fsp.writeFile(result.filePath, file);
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
    }
  },

  // load Terminologie.json and template
  //   cli = boolean
  async load (cli) {
    // Terminologie.json
    const path = modules.path.join(git.config.dir, "resources", "Terminologie.json");
    try {
      const content = await modules.fsp.readFile(path, { encoding: "utf8" });
      term.json = JSON.parse(content);
    } catch (err) {
      if (cli) {
        modules.ipc.invoke("cli-message", "Error: reading Terminologie.json failed");
        modules.ipc.invoke("cli-return-code", 1);
      } else {
        await shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
        document.querySelector("#term-export").focus();
      }
      return false;
    }

    // terminologie.tt
    const result = await win.loadXsl({
      obj: term,
      key: "tt",
      xsl: "terminologie.tt",
    });
    if (!result) {
      if (cli) {
        modules.ipc.invoke("cli-message", "Error: reading terminologie.tt failed");
        modules.ipc.invoke("cli-return-code", 1);
      }
      return false;
    }

    // success!
    return true;
  },

  // create terminology file
  //   type = string (tt | html)
  //   noNew = boolean
  makeFile (type, noNew) {
    const j = term.json;

    // 1. CREATE INDEX WITH MATCHING ARTICLES
    // add index key to json data
    for (const val of Object.values(j.Termini)) {
      if (!val.siehe) {
        val.index = [];
      }
    }

    // scan XML files for matching terms
    // (it's very important not to scan the whole but only the author's text;
    // therefore tagged content, which encloses definitions or citations, is ignored)
    const areas = [ "Wortgeschichte_kompakt", "Wortgeschichte" ];
    const tags = [ "Ueberschrift", "Textblock", "Liste" ];
    const followTags = [ "Anmerkung", "Listenpunkt" ];

    for (const [ name, file ] of Object.entries(xml.data.files)) {
      // skip new files (if requested)
      if (noNew && file.status === 2) {
        continue;
      }

      // parse document
      const doc = new DOMParser().parseFromString(xml.files[name], "text/xml");

      // get author text (excluding text in markup)
      let authorText = "";
      for (const area of areas) {
        for (const tag of tags) {
          for (const i of doc.querySelectorAll(`${area} ${tag}`)) {
            authorText += traverseChildren(i);
          }
        }
      }

      // scan author text
      for (const val of Object.values(j.Termini)) {
        // search expression
        const reg = new RegExp(val.reg);

        // detect correct index
        const index = val.siehe ? j.Termini[val.siehe].index : val.index;

        // search matching text
        if (reg.test(authorText)) {
          for (const hl of file.hl) {
            if (index.some(i => i.lemma === hl && i.id === file.id)) {
              continue;
            }
            let [ link ] = file.hl;
            if (file.fa) {
              link = "Wortfeld-" + link;
            }
            index.push({
              fa: file.fa,
              id: file.id,
              lemma: hl,
              link,
            });
          }
        }
      }
    }

    function traverseChildren (node) {
      let authorText = "";
      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          authorText += " " + child.nodeValue.trim();
        } else if (followTags.includes(child.nodeName)) {
          authorText += traverseChildren(child);
        }
      }
      return authorText;
    }

    shared.sortModeForLemmas = true;
    for (const val of Object.values(j.Termini)) {
      if (val.index) {
        val.index.sort((a, b) => shared.sort(a.lemma, b.lemma));
      }
    }
    shared.sortModeForLemmas = false;

    // 2. CREATE RESULTING FILE
    const blocks = [];

    // make blocks
    for (const [ term, val ] of Object.entries(j.Termini)) {
      // REFERENCE
      if (val.siehe) {
        let ref = `<p class='wgd-term-siehe'>${term}<span> → </span>`;
        ref += `<a href='#${encodeURIComponent(val.siehe)}'>${val.siehe}</a></p>`;
        blocks.push(ref);
        continue;
      }

      // EXPLANATION BLOCK
      const block = [ "<article>" ];

      // element: heading
      block.push(" ".repeat(2) + "<header>");
      block.push(`${" ".repeat(4)}<h2 id='${encodeURIComponent(term)}'>${term}${makeCopyLink(term)}</h2>`);

      // element: infos
      const infos = [
        {
          key: "auch",
          text: "auch",
          link: false,
        },
        {
          key: "ober",
          text: "Oberbegriff",
          link: true,
        },
        {
          key: "unter",
          text: "Unterbegriff",
          link: true,
        },
        {
          key: "sauch",
          text: "<abbr title='siehe'>s.</abbr> auch",
          link: true,
        },
      ];
      for (const info of infos) {
        if (!val[info.key].length) {
          continue;
        }

        // label
        let text = "<p class='wgd-term-info'><span>";
        let label = info.text;
        if (val[info.key].length > 1 && /begriff$/.test(label)) {
          label += "e";
        }
        text += label + ":</span> ";

        // no links
        if (!info.link) {
          text += val[info.key].join(", ") + "</p>";
          block.push(" ".repeat(4) + text);
          continue;
        }

        // links
        for (let i = 0, len = val[info.key].length; i < len; i++) {
          if (i > 0) {
            text += ", ";
          }
          let termLink = val[info.key][i];
          if (j.Termini[termLink].siehe) {
            termLink = j.Termini[termLink].siehe;
          }
          text += `<a href='#${encodeURIComponent(termLink)}'>${val[info.key][i]}</a>`;
        }
        text += "</p>";
        block.push(" ".repeat(4) + text);
      }
      block.push(" ".repeat(2) + "</header>");

      // element: text
      for (let i = 0, len = val.text.length; i < len; i++) {
        const item = val.text[i];
        let p = "";

        // label for examples
        if (/^bsp/.test(item.typ) &&
            !/^bsp/.test(val.text[i - 1].typ) &&
            !val.text[i - 1].label) {
          let bsp = " ".repeat(2) + "<p class='wgd-term-bsp-label'><i>";
          if (i !== val.text.length - 1 &&
              /^bsp/.test(val.text[i + 1].typ)) {
            bsp += "Beispiele:";
          } else {
            bsp += "Beispiel:";
          }
          p += bsp + "</i></p>\n";
        }

        // explanation or example
        p += " ".repeat(2) + "<p";
        if (/^bsp/.test(item.typ)) {
          p += " class='wgd-term-bsp'";
        } else if (/lang$/.test(item.typ)) {
          p += " class='wgd-term-lang'";
        }
        if (item.label) {
          p += " class='wgd-term-bsp-label'";
        }
        p += `>${item.html}</p>`;
        block.push(p);
      }

      // footer
      block.push(" ".repeat(2) + "<footer>");

      // element: literature
      if (val.lit.length) {
        let lit = "<p class='wgd-term-lit'><i>Literatur:</i> ";
        for (let i = 0, len = val.lit.length; i < len; i++) {
          const item = val.lit[i];
          if (i > 0) {
            lit += "; ";
          }
          lit += `<a href='#${encodeURIComponent(item.sigle)}'><cite>${item.sigle}</cite></a>`;
          if (item.seite) {
            lit += ", " + item.seite;
          }
          if (i === val.lit.length - 1 &&
              !/\.<\/.+?>$/.test(lit)) {
            lit += ".";
          }
        }
        lit += "</p>";
        block.push(" ".repeat(4) + lit);
      }

      // element: index
      if (type === "tt" && val.index.length) {
        const numerus = val.index.length > 1 ? "Wortgeschichten" : "Wortgeschichte";
        let index = `<p class='wgd-term-wg'><i>${numerus}:</i> `;
        for (let i = 0, len = val.index.length; i < len; i++) {
          const item = val.index[i];
          if (i > 0) {
            index += ", ";
          }
          index += `<a href='[% base %]wb/wortgeschichten/${encodeURIComponent(item.link)}`;
          if (item.fa) {
            index += "' class='wgd-term-wfa' title='Wortfeldartikel";
          }
          index += `'>${shared.hidxPrint(item.lemma)}</a>`;
        }
        index += "</p>";
        block.push(" ".repeat(4) + index);
      }

      // element: citation help
      let citation = "<p class='wgd-term-zit'><i>Zitierhilfe:</i> <span>";
      citation += val.autor[0];
      for (let i = 1, len = val.autor.length; i < len; i++) {
        const autor = val.autor[i].split(", ");
        citation += `/${autor[1]} ${autor[0]}`;
      }
      citation += `: „${term}“. In: Wortgeschichte digital&nbsp;– ZDL, https://www.zdl.org/<wbr>wb/<wbr>wgd/<wbr>Terminologie<wbr>#${encodeURIComponent(term)}`;
      citation += ".</span></p>";
      block.push(" ".repeat(4) + citation);

      // add block
      block.push(" ".repeat(2) + "</footer>");
      block.push("</article>");
      blocks.push(block.join("\n"));
    }

    // LITERATURE BLOCK
    const literature = [];
    literature.push("<section>");
    literature.push(`${" ".repeat(2)}<h2 id='Literatur'>Literatur${makeCopyLink("Literatur")}</h2>`);
    const litBlock = [];
    for (const [ sigle, val ] of Object.entries(j.Literatur)) {
      let lit = `${" ".repeat(4)}<p id='${encodeURIComponent(sigle)}'`;
      if (val.lang) {
        lit += ` lang='${val.lang}'`;
      }
      lit += " class='wgd-term-lit-titel'>";
      lit += "<b class='wgd-term-lit-sigle'>";
      if (val.ppn) {
        lit += `<a href='https://kxp.k10plus.de/DB=2.1/PPNSET?PPN=${val.ppn}' title='Titelaufnahme im GVK'>${sigle}</a>`;
      } else {
        lit += sigle;
      }
      lit += " </b>";
      lit += val.titel + "</p>";
      litBlock.push(lit);
    }
    // nest literature into <div> to insure that the last-child is also the last-child
    // when the tooltip is visible
    literature.push(`${" ".repeat(2)}<div>\n${litBlock.join("\n")}\n${" ".repeat(2)}</div>`);
    literature.push("</section>");
    blocks.push(literature.join("\n"));

    // LICENSE BLOCK
    if (type === "tt") {
      blocks.push("<footer id='wgd-term-lizenz'>\n<div><span id='wgd-term-lizenz-label'>Lizenz</span><a href='https://creativecommons.org/licenses/by-sa/4.0/deed.de' rel='license' id='wgd-term-lizenz-img'><img src='[% base %]static/images/wgd-cc.svg' width='120' height='42' alt='CC BY-SA'></a>Die Erläuterungstexte des terminologischen Kerninventars stehen unter der <a href='https://creativecommons.org/licenses/by-sa/4.0/deed.de' rel='license' class='wgd-link-extern'>Creative Commons-Lizenz BY-SA 4.0</a>.</div>\n</footer>");
    }

    // copy link creator
    function makeCopyLink (term) {
      return `<a href='#${encodeURIComponent(term)}' class='wgd-fragment' title='URL zu dieser Überschrift'></a>`;
    }

    // 3. PREPARE AND RETURN OUTPUT FILE
    let result = blocks.join("\n\n");

    // TT
    if (type === "tt") {
      result = result.replace(/ class='wgd-term-lang'/g, "");
      return term.tt.replace("{{RESULT}}", result);
    }

    // HTML
    // deletions
    result = result.replace(/<a href='.+?' class='wgd-fragment'.+?><\/a>/g, "");
    result = result.replace(/<p class='wgd-term-siehe'>.+?<\/p>/g, "");

    // replacements
    result = result.replace(/<a href='.+?'.*?>(.+?)<\/a>/g, (...args) => {
      if (/class='wgd-term-sigle'|k10plus\.de/.test(args[0])) {
        return args[1];
      }
      return `<u>${args[1]}</u>`;
    });
    result = result.replace(/<abbr.+?>(.+?)<\/abbr>/g, (...args) => args[1]);
    result = result.replace(/ class='wgd-term-(nur-)?lang'/g, " style='background-color: #eee'");
    result = result.replace(/<q>(.+?)<\/q>/g, (...args) => `„${args[1]}“`);
    result = result.replace(/<q class='wgd-(?:distanzierung|paraphrase)'>(.+?)<\/q>/g, (...args) => `‚${args[1]}‘`);
    result = result.replace(/<p class='wgd-term-bsp-label'>(.+?)<\/p>/g, (...args) => `<p>${args[1]}</p>`);
    result = result.replace(/<p class='wgd-term-bsp'>(.+?)<\/p>/g, (...args) => `<p style='margin-left: 24pt'>${args[1]}</p>`);
    result = result.replace(/<span class='wgd-term-wird-zu'>&gt;<\/span>/g, `${"\u00A0".repeat(3)}<b>&gt;</b>${"\u00A0".repeat(3)}`);
    result = result.replace(/<div class='wgd-term-lit'>(.+?)<\/div>/g, (...args) => {
      const p = args[1].replace(/<u>(.+?)<\/u>/g, (...a) => a[1]);
      return `<p><i>${p}</i></p>`;
    });
    result = result.replace(/<div.+?class='wgd-term-lit-titel'><b.+?>(.+?)<\/b>(.+?)<\/div>/g, (...args) => `<p><b>${args[1]}</b></p>\n<p>${args[2]}</p>`);

    // wrap into HTML
    result = `<!doctype html>
<head lang="de">
<meta charset='utf-8'>
<title>Terminologisches Kerninventar</title>
</head>
<body>
${result}
</body>
</html>
`;
    return result;
  },
};
