"use strict";

const hints = {
  // glean hints data
  async glean () {
    // purge old hints
    for (const v of Object.values(xml.data.files)) {
      v.hints = [];
    }
    // get external file data
    await new Promise(resolve => {
      Promise.all([
        hints.fillDiasystems(),
        hints.fillLiterature(),
        hints.fillVariants(),
      ]).then(() => resolve(true));
    });
    // glean hints data
    hints.parseData();
    hints.parseFiles();
    // clean-up and sorting
    for (const data of Object.values(xml.data.files)) {
      for (let i = data.hints.length - 1; i >= 0; i--) {
        const current = data.hints[i];
        const matches = data.hints.filter(x => x.line === current.line && x.ident === current.ident);
        if (matches.length > 1) {
          data.hints.splice(i, 1);
        }
      }
      data.hints.sort((a, b) => {
        if (a.line === b.line &&
            a.type !== b.type) {
          const x = [ a.type, b.type ];
          x.sort();
          if (x[0] === a.type) {
            return -1;
          }
          return 1;
        }
        return a.line - b.line;
      });
    }
  },

  // regular expression for leading articles
  artReg: /^(das|de[mnrs]|die|eine?[mnrs]?) /i,

  // SEMANTIC_TYPE: corresponding semantic types
  // ("Cluster" and "Kontext" are excluded)
  semCorrTypes: {
    Gegensatz: "Gegensatz",
    Hyperonym: "Hyponym",
    Hyponym: "Hyperonym",
    Synonym: "Synonym",
  },

  // hints that can be derived from already present file data
  // (no parsing of XML files needed)
  parseData () {
    for (const [ file, data ] of Object.entries(xml.data.files)) {
      for (const i of data.links) {
        // LINK_DUPLICATE
        if (i.scope === "Verweise") {
          for (const x of data.links) {
            if (x === i) {
              break;
            }
            if (x.scope === "Verweise" &&
                x.lemma.file === i.lemma.file &&
                x.lemma.spelling === i.lemma.spelling &&
                (!x.verweistext && !i.verweistext || x.verweistext === i.verweistext)) {
              hints.add(data.hints, file, {
                line: i.line,
                linkCount: 0,
                scope: "Verweise",
                textErr: [
                  {
                    text: "identischer Verweis bereits in Wortinformationen",
                    type: "hint_text",
                  },
                  `<Verweisziel>${i.verweisziel}</Verweisziel>`,
                ],
                textHint: [],
                type: "link_duplicate",
              });
            }
          }
        }
        // LINK_ERROR: target not found
        if (i.lemma.file && /#/.test(i.verweisziel)) {
          const target = i.verweisziel.split("#")[1];
          if (!xml.data.files[i.lemma.file].targets.includes(target)) {
            hints.add(data.hints, file, {
              line: i.line,
              linkCount: 0,
              scope: i.scope,
              textErr: [
                {
                  text: "Sprungziel nicht gefunden",
                  type: "hint_text",
                },
                `<Verweisziel>${i.verweisziel}</Verweisziel>`,
              ],
              textHint: [],
              type: "link_error",
            });
          }
        }
        // LINK_ERROR: <Verweisziel> does not match <Verweistext>
        // (only regards multi lemma articles)
        if (i.lemma.file &&
            i.verweistext &&
            i.verweistext !== i.verweisziel &&
            !/^-|-$/.test(i.verweistext) &&
            !/#/.test(i.verweisziel)) {
          const targetData = xml.data.files[i.lemma.file];
          if (targetData.hlJoined.length > 1 ||
              targetData.nl.length) {
            let bogus = true;
            for (let text of i.verweistext.split("/")) {
              if (i.verweisziel === text) {
                bogus = false;
                break;
              }
              if (!hints.artReg.test(i.verweisziel)) {
                text = text.replace(hints.artReg, "");
              }
              let { source: regText } = hints.lemmas[i.verweisziel].reg;
              regText = regText.substring(0, regText.length - 1);
              const reg = new RegExp(regText, "i");
              if (reg.test(text) &&
                  text.length <= i.verweisziel.length + 2) {
                bogus = false;
                break;
              }
            }
            if (bogus) {
              hints.add(data.hints, file, {
                line: i.line,
                linkCount: 0,
                scope: i.scope,
                textErr: [
                  {
                    text: "Verweistext passt nicht zum Verweisziel",
                    type: "hint_text",
                  },
                  `<Verweistext>${i.verweistext}</Verweistext>\n<Verweisziel>${i.verweisziel}</Verweisziel>`,
                ],
                textHint: [],
                type: "link_error",
              });
            }
          }
        }
        // LINK_ERROR: lemma not found
        if (!i.lemma.file) {
          if (hints.lemmas[i.verweisziel]) {
            hints.add(data.hints, file, {
              line: i.line,
              linkCount: 0,
              scope: i.scope,
              textErr: [
                {
                  text: "Wortfeldartikel falsch verlinkt",
                  type: "hint_text",
                },
                `<Verweisziel>${i.verweisziel}</Verweisziel>`,
              ],
              textHint: [
                {
                  text: `<Verweisziel>Wortfeld-${i.verweisziel}</Verweisziel>`,
                  type: "copy",
                },
              ],
              type: "link_error",
            });
          } else {
            hints.add(data.hints, file, {
              line: i.line,
              linkCount: 0,
              scope: i.scope,
              textErr: [
                {
                  text: "Lemma nicht gefunden",
                  type: "hint_text",
                },
                `<Verweisziel>${i.verweisziel}</Verweisziel>`,
              ],
              textHint: [
                {
                  text: "",
                  type: "comment_link",
                },
              ],
              type: "link_error",
            });
          }
        // LINK_ERROR: link text is missing
        } else if (/#/.test(i.verweisziel) &&
            !i.verweistext) {
          hints.add(data.hints, file, {
            line: i.line,
            linkCount: 0,
            scope: i.scope,
            textErr: [
              {
                text: "Verweistext nicht angegeben",
                type: "hint_text",
              },
              `<Verweistext/>\n<Verweisziel>${i.verweisziel}</Verweisziel>`,
            ],
            textHint: [
              {
                text: `<Verweistext>${i.lemma.spelling}</Verweistext>`,
                type: "copy",
              },
            ],
            type: "link_error",
          });
        // LINK_ERROR: <Verweisziel> contains a sub lemma
        } else if (i.lemma.spelling === i.verweisziel &&
            xml.data.files[i.lemma.file].nl.includes(i.verweisziel)) {
          const targetData = xml.data.files[i.lemma.file];
          hints.add(data.hints, file, {
            line: i.line,
            linkCount: 0,
            scope: i.scope,
            textErr: [
              {
                text: "Nebenlemma anstelle von Hauptlemma",
                type: "hint_text",
              },
              `<Verweisziel>${i.verweisziel}</Verweisziel>`,
            ],
            textHint: [
              {
                text: `<Verweisziel>${targetData.hl[0]}#${targetData.nlTargets[i.verweisziel]}</Verweisziel>`,
                type: "copy",
              },
            ],
            type: "link_error",
          });
        // SEMANTIC_TYPE: propose to add semantic types
        } else if (i.type.length) {
          // hint for the same article
          const typeJoined = i.type.sort().join();
          for (const x of data.links) {
            if (i.lemma.file === x.lemma.file &&
                i.lemma.spelling === x.lemma.spelling &&
                hints.semCorrTypes[i.type[0]] &&
                typeJoined !== x.type.sort().join()) {
              let hintText = "keine Typisierung";
              if (x.type.length) {
                hintText = `<Verweis Typ="${x.type.join(" ")}">`;
              }
              const verweistext = x.verweistext ? `<Verweistext>${x.verweistext}</Verweistext>` : "<Verweistext/>";
              hints.add(data.hints, file, {
                line: x.line,
                linkCount: 0,
                scope: x.scope,
                textErr: [
                  {
                    text: hintText,
                    type: "hint_text",
                  },
                  {
                    text: `${verweistext}\n<Verweisziel>${x.verweisziel}</Verweisziel>`,
                    type: "context",
                  },
                ],
                textHint: [
                  {
                    text: `<Verweis Typ="${typeJoined}">`,
                    type: "copy",
                  },
                ],
                type: "semantic_type",
              });
            }
          }
          // hint for a corresponding article
          const target = xml.data.files[i.lemma.file];
          if (target.nl.includes(i.lemma.spelling)) {
            // don't propose semantic types for sub lemmas
            continue;
          }
          const semCorr = new Set();
          for (const x of i.type) {
            if (hints.semCorrTypes[x]) {
              semCorr.add(hints.semCorrTypes[x]);
            }
          }
          if (!semCorr.size) {
            // size can be 0 as types like "Cluster" have no corresponding type
            continue;
          }
          for (const x of target.links) {
            if (x.lemma.file === file &&
                data.hl.includes(x.lemma.spelling) &&
                !semCorrCorrect(data.hl, semCorr, x.type)) {
              let hintText = "keine Typisierung";
              if (x.type.length) {
                hintText = `<Verweis Typ="${x.type.join(" ")}">`;
              }
              const verweistext = x.verweistext ? `<Verweistext>${x.verweistext}</Verweistext>` : "<Verweistext/>";
              hints.add(target.hints, i.lemma.file, {
                line: x.line,
                linkCount: 0,
                scope: x.scope,
                textErr: [
                  {
                    text: hintText,
                    type: "hint_text",
                  },
                  {
                    text: `${verweistext}\n<Verweisziel>${x.verweisziel}</Verweisziel>`,
                    type: "context",
                  },
                ],
                textHint: [
                  {
                    text: `<Verweis Typ="${[ ...semCorr ].sort().join(" ")}">`,
                    type: "copy",
                  },
                ],
                type: "semantic_type",
              });
            }
          }
        }
      }
      // ARTICLE_ID: hint erroneous article ID
      const hl = [];
      for (let i of data.hlJoined) {
        [ i ] = i.split("/");
        i = shared.hClear(i);
        i = i.replace(/[\s’]/g, "_");
        hl.push(i);
      }
      const fa = data.fa ? "Wortfeldartikel_" : "";
      const base = `WGd-${fa}${hl.join("-")}-`;
      const reg = new RegExp(`^${base}([0-9])$`);
      if (!reg.test(data.id)) {
        const numMatch = data.id.match(/[0-9]$/);
        let num = "1";
        if (numMatch) {
          [ num ] = numMatch;
        }
        hints.add(data.hints, file, {
          line: 3,
          linkCount: 0,
          scope: "Artikel",
          textErr: [
            {
              text: "ID formal falsch",
              type: "hint_text",
            },
            data.id,
          ],
          textHint: [
            {
              text: base + num,
              type: "copy",
            },
          ],
          type: "article_id",
        });
      }
      // ARTICLE_FILE: hint erroneous file name
      const fileName = articleFileName(fa, hl);
      if (file !== fileName) {
        hints.add(data.hints, file, {
          line: 0,
          linkCount: 0,
          scope: "Artikel",
          textErr: [
            {
              text: "Dateiname formal falsch",
              type: "hint_text",
            },
            file,
          ],
          textHint: [
            {
              text: fileName,
              type: "copy",
            },
          ],
          type: "article_file",
        });
      }
    }
    // ARTICL_ID: find duplicates
    const files = Object.keys(xml.data.files);
    files.sort((a, b) => {
      const { files: data } = xml.data;
      if (data[a].status > data[b].status) {
        return 1;
      } else if (data[a].status < data[b].status) {
        return -1;
      }
      return 0;
    });
    const allIDs = [];
    for (const file of files) {
      const { id } = xml.data.files[file];
      const duplicate = allIDs.find(i => i.id === id);
      if (duplicate) {
        hints.add(xml.data.files[file].hints, file, {
          line: 3,
          linkCount: 0,
          scope: "Artikel",
          textErr: [
            {
              text: `ID bereits vergeben in „${duplicate.file}“`,
              type: "hint_text",
            },
            id,
          ],
          textHint: [],
          type: "article_id",
        });
      }
      allIDs.push({
        file,
        id,
      });
    }
    // SEMANTIC_TYPE: check whether corresponding semantic types are correct or not
    //   hl = array (main lemmas of current article)
    //   semCorr = set (correlating semantics)
    //   type = array (semantic types in target article)
    function semCorrCorrect (hl, semCorr, type) {
      // in case an article has more than one lemma and the same number of semantic
      // types is required, we may assume that each of the article's main lemmas has
      // a specific lexical relation to the corresponding lemma; therefore one hit is enough;
      // example from "Großbürger/Kleinbürger": "Großbürger" is a synonym to "Bourgeois",
      // but "Kleinbürger" is a contrast to "Bourgeois", therefore in "Bourgois" a link to
      // "Großbürger" or "Kleinbürger" must only contain one of the possible lexical relations
      if (hl.length > 1 && hl.length === semCorr.size) {
        for (const i of type) {
          if (semCorr.has(i)) {
            return true;
          }
        }
      }
      // one hint is also enough in corresponding cases when the link target is a multi lemma article
      // and its links contain more than one semantic type; example: "Bourgeois" links to
      // "Großbürger" or "Kleinbürger" => the lexical relation may be synonym or contrast
      if (type.length > semCorr.size) {
        for (const i of semCorr) {
          if (type.includes(i)) {
            return true;
          }
        }
      }
      // otherwise the semantics should be equal
      if ([ ...semCorr ].sort().join() === type.sort().join()) {
        return true;
      }
      // the semantics are not equal => print a proposal
      return false;
    }
    // ARTICLE_FILE: create correct file name
    //   fa = string
    //   hl = array
    function articleFileName (fa, hl) {
      const rep = new Map([
        [ /[\s’']/g, "_" ],
        [ /Ä/g, "Ae" ],
        [ /ä/g, "ae" ],
        [ /[ÈÉ]/g, "E" ],
        [ /[èé]/g, "e" ],
        [ /Ö/g, "Oe" ],
        [ /ö/g, "oe" ],
        [ /Ü/g, "Ue" ],
        [ /ü/g, "ue" ],
        [ /ß/g, "ss" ],
      ]);
      let name = fa + hl.join("-");
      for (const [ k, v ] of rep) {
        name = name.replace(k, v);
      }
      name += ".xml";
      return name;
    }
  },

  // parse XML files
  parseFiles () {
    for (const [ file, content ] of Object.entries(xml.files)) {
      const doc = new DOMParser().parseFromString(content, "text/xml");
      // XML not well-formed
      if (doc.querySelector("parsererror")) {
        xml.updateErrors.push({
          file,
          err: "XML not well-formed",
        });
        continue;
      }
      try {
        hints.checkEZ(file, doc, content);
        hints.checkSW(file, doc, content);
        hints.checkTR(file, doc, content);
        hints.checkVE(file, doc, content);
        hints.checkSprache(file, doc, content);
        hints.checkDiasystems(file, doc, content);
        hints.checkLiterature(file, doc, content);
        hints.collectComments(file, doc, content);
      } catch (err) {
        xml.updateErrors.push({
          file,
          err: `${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`,
        });
      }
    }
  },

  // EZ_STICHWORT, EZ_LINK
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkEZ (file, doc, content) {
    const data = xml.data.files[file];
    const scopes = [
      "Wortgeschichte_kompakt erwaehntes_Zeichen",
      "Wortgeschichte erwaehntes_Zeichen",
    ];
    const currentArtLemmas = data.fa ? data.faLemmas : data.hl.concat(data.nl);
    forX: for (const i of doc.querySelectorAll(scopes.join(", "))) {
      if (i.getAttribute("Sprache") &&
          i.getAttribute("Sprache") !== "dt") {
        continue;
      }
      // EZ_STICHWORT: current article deals with this very word => markup should be <Stichwort>
      const textOri = i.textContent.trim();
      const text = textOri.replace(/\s/g, " ");
      for (const lemma of currentArtLemmas) {
        if (hints.lemmas[lemma].reg.test(text)) {
          hints.add(data.hints, file, {
            line: xml.getLineNumber({
              doc,
              ele: i,
              file: content,
            }),
            linkCount: 0,
            scope: hints.detectScope(i),
            textErr: [ `<erwaehntes_Zeichen>${textOri}</erwaehntes_Zeichen>` ],
            textHint: [ `<Stichwort>${textOri}</Stichwort>` ],
            type: "ez_stichwort",
          });
          continue forX;
        }
      }
      // EZ_LINK: link to existing article
      if (i.closest("Lesart") ||
          i.closest("Ueberschrift") ||
          i.closest("Verweis") ||
          i.closest("Verweis_extern")) {
        continue;
      }
      for (const [ lemma, values ] of Object.entries(hints.lemmas)) {
        if (currentArtLemmas.includes(lemma) ||
            !values.reg.test(text)) {
          continue;
        }
        for (const x of values.xml) {
          // count how often the lemma was already linked
          const linkCount = hints.getLinkCount(data.links, x, lemma);
          // detect target
          const target = hints.detectTarget(x, lemma);
          // detect whether the lemma was already linked in the current block
          if (linkCount && hints.detectVerweisInBlock(i, target)) {
            continue;
          }
          // add hint
          hints.add(data.hints, file, {
            line: xml.getLineNumber({
              doc,
              ele: i,
              file: content,
            }),
            linkCount,
            scope: hints.detectScope(i),
            textErr: [ `<erwaehntes_Zeichen>${textOri}</erwaehntes_Zeichen>` ],
            textHint: [
              {
                text: `<Verweisziel>${target}</Verweisziel>`,
                type: "copy",
              },
            ],
            type: "ez_link",
          });
        }
        break;
      }
    }
  },

  // STICHWORT_EZ
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkSW (file, doc, content) {
    const data = xml.data.files[file];
    const scopes = [
      "Wortgeschichte_kompakt Stichwort",
      "Wortgeschichte Stichwort",
    ];
    const currentArtLemmas = data.fa ? data.faLemmas : data.hl.concat(data.nl);
    const regExp = [];
    for (const lemma of currentArtLemmas) {
      const { source } = hints.lemmas[lemma].reg;
      const reg = new RegExp(source.substring(0, source.length - 1), "i");
      regExp.push(reg);
    }
    for (const i of doc.querySelectorAll(scopes.join(", "))) {
      if (i.getAttribute("Sprache") &&
          i.getAttribute("Sprache") !== "dt") {
        continue;
      }
      // STICHWORT_EZ: current article does not deal with this word => markup should be <erwaehntest_Zeichen>
      let text = i.textContent.trim();
      if (/^-|-$/.test(text)) {
        continue;
      }
      const textOri = text;
      text = text.replace(/\s/g, " ");
      text = text.replace(/[()]/g, "");
      const textNoArt = text.replace(hints.artReg, "");
      let matches = false;
      for (const reg of regExp) {
        if (reg.test(text) ||
            reg.test(textNoArt)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: hints.detectScope(i),
          textErr: [ `<Stichwort>${textOri}</Stichwort>` ],
          textHint: [ `<erwaehntes_Zeichen>${textOri}</erwaehntes_Zeichen>` ],
          type: "stichwort_ez",
        });
      }
    }
  },

  // TR_ERROR, TR_SUPERFLUOUS, TR_LINK
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkTR (file, doc, content) {
    const data = xml.data.files[file];
    for (const i of doc.querySelectorAll("Textreferenz")) {
      const target = i.getAttribute("Ziel");
      const text = i.textContent;
      const scope = hints.detectScope(i);
      // TR_ERROR: target was not found (check everywhere)
      if (!data.targets.includes(target)) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope,
          textErr: [
            {
              text: `@xml:id="${target}" nicht im Text der Wortgeschichte`,
              type: "hint_text",
            },
            `<Textreferenz Ziel="${target}">${text}</Textreferenz>`,
          ],
          textHint: [],
          type: "tr_error",
        });
        continue;
      }
      if (scope !== "Verweise") {
        continue;
      // TR_SUPERFLUOUS: linked text is lemma of the current article (check <Verweise> only)
      } else if (data.hl.includes(text) ||
          data.nl.includes(text)) {
        const type = data.hl.includes(text) ? "Hauptlemma" : "Nebenlemma";
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope,
          textErr: [
            {
              text: `Textreferenz verlinkt ${type} des Artikels`,
              type: "hint_text",
            },
            `<Textreferenz Ziel="${target}">${text}</Textreferenz>`,
          ],
          textHint: [],
          type: "tr_superfluous",
        });
      // TR_LINK: replace <Textreferenz> with <Verweis> (check <Verweise> only)
      } else if (hints.lemmas[text]) {
        for (const x of hints.lemmas[text].xml) {
          const newTarget = hints.detectTarget(x, text);
          hints.add(data.hints, file, {
            line: xml.getLineNumber({
              doc,
              ele: i,
              file: content,
            }),
            linkCount: 0,
            scope,
            textErr: [ `<Textreferenz Ziel="${target}">${text}</Textreferenz>` ],
            textHint: [
              `<Verweistext>${text}</Verweistext>`,
              {
                text: `<Verweisziel>${newTarget}</Verweisziel>`,
                type: "copy",
              },
            ],
            type: "tr_link",
          });
        }
      }
    }
  },

  // WWW_ERROR, WWW_LINK
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkVE (file, doc, content) {
    const data = xml.data.files[file];
    for (const i of doc.querySelectorAll("Verweis_extern")) {
      // WWW_ERROR: <Verweistext> missing
      const text = i?.querySelector("Verweistext")?.textContent;
      if (!text) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: hints.detectScope(i),
          textErr: [ "<Verweis_extern> ohne <Verweistext>" ],
          textHint: [],
          type: "www_error",
        });
        continue;
      }
      // WWW_ERROR: <URL> missing
      const url = i?.querySelector("URL")?.textContent;
      if (!url) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: hints.detectScope(i),
          textErr: [ "<Verweis_extern> ohne <URL>" ],
          textHint: [],
          type: "www_error",
        });
        continue;
      }
      // WWW_ERROR: link has @Typ="Cluster"
      if (i.getAttribute("Typ") === "Cluster") {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: hints.detectScope(i),
          textErr: [
            {
              text: "Attribut @Typ überflüssig",
              type: "hint_text",
            },
            '<Verweis_extern Typ="Cluster">',
          ],
          textHint: [],
          type: "www_error",
        });
      }
      // WWW_LINK: propose to link to existing article
      const dwds = url.match(/dwds\.de\/wb\/(.+?)(?=#|$)/);
      if (dwds) {
        const lemma = decodeURIComponent(dwds[1]);
        // ignore link
        //   - if it doesn't link to one of the available lemmas or
        //   - if the linked lemma is part of the current article
        //     (in cases like that the external reference is definitley correct)
        //   - if the link is part of the meanings structure
        if (!hints.lemmas[lemma] ||
          data.hl.includes(lemma) ||
          data.nl.includes(lemma) ||
          i.closest("Nachweise")) {
          continue;
        }
        for (const x of hints.lemmas[lemma].xml) {
          // count how often the lemma was already linked
          const linkCount = hints.getLinkCount(data.links, x, lemma);
          // detect target
          const target = hints.detectTarget(x, lemma);
          // detect whether the lemma was already linked in the current block
          if (linkCount && hints.detectVerweisInBlock(i, target)) {
            continue;
          }
          // add hint
          hints.add(data.hints, file, {
            line: xml.getLineNumber({
              doc,
              ele: i,
              file: content,
            }),
            linkCount,
            scope: hints.detectScope(i),
            textErr: [ `<URL>${url}</URL>` ],
            textHint: [
              {
                text: `<Verweisziel>${target}</Verweisziel>`,
                type: "copy",
              },
            ],
            type: "www_link",
          });
        }
      }
    }
  },

  // SPRACHE_SUPERFLUOUS: @Sprache is superfluous
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkSprache (file, doc, content) {
    const data = xml.data.files[file];
    // text marked as German
    for (const i of doc.querySelectorAll('[Sprache="dt"]')) {
      if (!i.parentNode.closest("[Sprache]")) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: hints.detectScope(i),
          textErr: [
            {
              text: "Attribut @Sprache überflüssig",
              type: "hint_text",
            },
            `<${i.nodeName} Sprache="dt">`,
            {
              text: '@Sprache="dt" ist hier impliziert.',
              type: "context",
            },
          ],
          textHint: [],
          type: "sprache_superfluous",
        });
      }
    }
    // a tag has the same @Sprache as the parent <Absatz>
    // (<Absatz> can only be found in quotations)
    for (const i of doc.querySelectorAll("Absatz[Sprache]")) {
      const lang = i.getAttribute("Sprache");
      for (const x of i.querySelectorAll("[Sprache]")) {
        const langX = x.getAttribute("Sprache");
        if (langX === lang) {
          hints.add(data.hints, file, {
            line: xml.getLineNumber({
              doc,
              ele: x,
              file: content,
            }),
            linkCount: 0,
            scope: hints.detectScope(x),
            textErr: [
              {
                text: "Attribut @Sprache überflüssig",
                type: "hint_text",
              },
              `<${x.nodeName} Sprache="${langX}">`,
              {
                text: `@Sprache="${langX}" ist hier wegen <Absatz Sprache="${langX}"> impliziert.`,
                type: "context",
              },
            ],
            textHint: [],
            type: "sprache_superfluous",
          });
        }
      }
    }
  },

  // DIASYSTEMIC_VALUE
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkDiasystems (file, doc, content) {
    const data = xml.data.files[file];
    for (const lesarten of doc.querySelectorAll("Lesarten")) {
      for (const n of lesarten.childNodes) {
        if (n.nodeName !== "Lesart") {
          continue;
        }
        iterateNodes(n, n, getDiaValues(n));
      }
    }
    function getDiaValues (lesart) {
      const diaValues = {};
      for (const d of lesart.querySelectorAll("Diasystematik")) {
        if (d.closest("Lesart") !== lesart) {
          continue;
        }
        for (const x of d.children) {
          const { nodeName: system } = x;
          const value = x.textContent.trim();
          if (!diaValues[system]) {
            diaValues[system] = new Set();
          }
          diaValues[system].add(value);
        }
      }
      return diaValues;
    }
    function iterateNodes (nodes, lesart, diaValues) {
      for (const n of nodes.childNodes) {
        if (n.nodeType === Node.ELEMENT_NODE &&
            n.nodeName === "Lesart") {
          iterateNodes(n, n, getDiaValues(n));
        } else if (n.nodeType === Node.ELEMENT_NODE &&
            !/Abkuerzung|Diasystematik|Textreferenz/.test(n.nodeName)) {
          iterateNodes(n, lesart, diaValues);
        } else if (n.nodeType === Node.TEXT_NODE) {
          const text = n.nodeValue.trim();
          if (!text) {
            continue;
          }
          for (const [ k, v ] of Object.entries(hints.diasystems)) {
            for (const x of v) {
              if (x.test(text) &&
                  !diaValues?.[k]?.has(x.source)) {
                diaValues?.[k]?.add(x.source);
                hints.add(data.hints, file, {
                  line: xml.getLineNumber({
                    doc,
                    ele: lesart,
                    file: content,
                  }),
                  linkCount: 0,
                  scope: "Bedeutungsgerüst",
                  textErr: [],
                  textHint: [ k + " > " + x.source ],
                  type: "diasystemic_value",
                });
              }
            }
          }
        }
      }
    }
  },

  // LITERATURE_ERROR, LITERATURE_MISSING
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  checkLiterature (file, doc, content) {
    const data = xml.data.files[file];
    for (const i of doc.querySelectorAll("Literaturtitel")) {
      const id = i.getAttribute("xml:id");
      const ziel = i.getAttribute("Ziel");
      if (!ziel.includes(id)) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: "Literatur",
          textErr: [
            {
              text: "Tag formal fehlerhaft",
              type: "hint_text",
            },
            `<Literaturtitel xml:id="${id}"/>`,
          ],
          textHint: [],
          type: "literature_error",
        });
      }
      if (!hints.literature.has(id)) {
        hints.add(data.hints, file, {
          line: xml.getLineNumber({
            doc,
            ele: i,
            file: content,
          }),
          linkCount: 0,
          scope: "Literatur",
          textErr: [
            {
              text: "Literaturtitel existiert nicht",
              type: "hint_text",
            },
            `<Literaturtitel xml:id="${id}"/>`,
          ],
          textHint: [],
          type: "literature_missing",
        });
      }
    }
  },

  // COMMENT
  //   file = string (XML file name)
  //   doc = document
  //   content = string
  collectComments (file, doc, content) {
    const data = xml.data.files[file];
    const iterator = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT);
    let node;
    let idx = -1;
    while ((node = iterator.nextNode())) {
      idx++;
      hints.add(data.hints, file, {
        line: xml.getLineNumber({
          doc,
          ele: node,
          file: content,
          idx,
        }),
        linkCount: 0,
        scope: hints.detectScope(node),
        textErr: [],
        textHint: [ `<!--${node.nodeValue}-->` ],
        type: "comment",
      });
    }
  },

  // detect scope
  //   node = element node | comment node
  detectScope (node) {
    let parent = node;
    while ((parent = parent.parentNode)) {
      if (parent.nodeName === "Lesarten") {
        return "Bedeutungsgerüst";
      } else if (parent.nodeName === "Literatur") {
        return "Literatur";
      } else if (parent.nodeName === "Verweise") {
        return "Verweise";
      } else if (parent.nodeName === "Wortgeschichte") {
        return "Wortgeschichte";
      } else if (parent.nodeName === "Wortgeschichte_kompakt") {
        return "Kurz gefasst";
      } else if (parent.nodeName === "Belegreihe") {
        return "Belegauswahl";
      } else if (parent.nodeName === "Artikel") {
        return "Artikel";
      }
    }
    // this should never happen
    return "";
  },

  // detect link target
  //   file = string (XML file name)
  //   lemma = string
  detectTarget (file, lemma) {
    const data = xml.data.files[file];
    // main lemma
    let target = lemma;
    // sub lemma
    if (data.nl.includes(lemma)) {
      target = data.hl[0] + "#" + data.nlTargets[lemma];
    // lemma is title of field article
    } else if (!data.hl.includes(lemma)) {
      target = "Wortfeld-" + lemma;
    }
    return target;
  },

  // detect whether there is already a matching internal link in the same block
  //   ele = node
  //   target = string (string of <Verweisziel>)
  detectVerweisInBlock (ele, target) {
    let container;
    for (const b of [ "Textblock", "Blockzitat", "Liste" ]) {
      container = ele.closest(b);
      if (container) {
        break;
      }
    }
    const verweise = container.querySelectorAll("Verweis");
    for (const v of verweise) {
      if (v.querySelector("Verweisziel").textContent === target) {
        return true;
      }
    }
    return false;
  },

  // count how often a certain link is already present within the article's text
  //   links = array
  //   file = string (XML file name)
  //   lemma = string
  getLinkCount (links, file, lemma) {
    let count = 0;
    for (const i of links) {
      if (i.scope !== "Verweise" &&
          i.lemma.file === file &&
          shared.hClear(i.lemma.spelling) === lemma) {
        count++;
      }
    }
    return count;
  },

  // add a hint
  //   h = array (target array for hints)
  //   file = string (XML file name)
  //   obj = object (hints object)
  add (h, file, obj) {
    let ident = file + obj.type + obj.scope;
    for (const i of obj.textErr.concat(obj.textHint)) {
      if (typeof i === "string") {
        ident += i;
      } else {
        ident += i.text;
      }
    }
    const hash = shared.crypto.createHash("sha1").update(ident).digest("hex");
    obj.ident = hash.substring(0, 10);
    h.push(obj);
  },

  // available diasystemic values
  //   [DIASYSTEM] = array (filled with regular expressions)
  diasystems: {},

  // read diasystemic values
  async fillDiasystems () {
    // it's better to fill these values every time,
    // in case they were updated while the app was running
    hints.diasystems = {};
    // check whether Diasystematik.rnc exists or not
    const path = shared.path.join(xml.gitDir, "share", "rnc", "Diasystematik.rnc");
    const exists = await shared.ipc.invoke("exists", path);
    if (!exists) {
      return false;
    }
    // read systems and values
    const file = await shared.fsp.readFile(path, { encoding: "utf8" });
    const systems = [ "Gebrauchszeitraum", "Regiolekt", "Register", "Sachgebiet", "Soziolekt" ];
    for (const s of systems) {
      hints.diasystems[s] = [];
      const reg = new RegExp(`${s} = element ${s} {(.+?)}`, "s");
      const [ values ] = file.match(reg);
      for (const v of values.matchAll(/'(.+?)'/g)) {
        hints.diasystems[s].push(new RegExp(v[1]));
      }
    }
    return true;
  },

  // available literature titles (IDs)
  literature: new Set(),

  // read IDs of literature titles
  async fillLiterature () {
    // it's better to fill these values every time,
    // in case they were updated while the app was running
    hints.literature = new Set();
    // check whether Literaturliste.xml exists or not
    const path = shared.path.join(xml.gitDir, "share", "Literaturliste.xml");
    const exists = await shared.ipc.invoke("exists", path);
    if (!exists) {
      return false;
    }
    // read IDs
    const file = await shared.fsp.readFile(path, { encoding: "utf8" });
    for (const i of file.matchAll(/<Fundstelle xml:id="(.+?)">/g)) {
      hints.literature.add(i[1]);
    }
    return true;
  },

  // spelling variants for lemmas
  //   [WORD] = array (filled with variants)
  variants: {},

  // lemmas and regular expressions for all flections
  //   [LEMMA] = object
  //     xml   = set (XML file names)
  //     reg   = RegExp
  lemmas: {},

  // fill the object hints.variants and hints.lemmas
  async fillVariants () {
    // load known variants from cache
    const path = shared.path.join(shared.info.userData, "variants.json");
    if (!Object.keys(hints.variants).length) {
      const exists = await shared.ipc.invoke("exists", path);
      if (exists) {
        const file = await shared.fsp.readFile(path, { encoding: "utf8" });
        if (!Object.keys(hints.variants).length) {
          hints.variants = JSON.parse(file);
        }
      }
    }
    // it's better to fill these values every time,
    // in case they were updated while the app was running
    hints.lemmas = {};
    // collect missing words and populate lemma list
    const artBestimmt = [ "der", "die", "das", "des", "dem", "den" ];
    const artUnbestimmt = [ "ein", "eine", "eines", "einer", "einem", "einen" ];
    const noLookup = [ "an", "auf", "aus", "bei", "bis", "durch", "für", "gegen", "hinter", "in", "mit", "nach", "neben", "oder", "über", "um", "und", "unter", "von", "vor", "zu", "zwischen" ];
    const missing = [];
    for (const [ file, data ] of Object.entries(xml.data.files)) {
      for (let lemma of data.hl.concat(data.nl)) {
        lemma = shared.hClear(lemma);
        if (!hints.lemmas[lemma]) {
          hints.lemmas[lemma] = {
            xml: new Set(),
            reg: null,
          };
        }
        hints.lemmas[lemma].xml.add(file);
        for (const word of lemma.split(" ")) {
          if (!hints.variants[word] &&
              !artBestimmt.includes(word) &&
              !artUnbestimmt.includes(word) &&
              !noLookup.includes(word) &&
              !missing.includes(word)) {
            missing.push(word);
          }
        }
      }
    }
    // download missing variants (chunks of 50 words)
    const promises = [];
    let save = false;
    for (let i = 0, len = missing.length; i < len; i += 50) {
      const lookup = [];
      for (let j = i, len = i + 50; j < len; j++) {
        if (!missing[j]) {
          break;
        }
        // no variants for single letters or words with apostrophe
        if (/^[0-9]|’/.test(missing[j]) ||
            missing[j].length < 3) {
          hints.variants[missing[j]] = [ missing[j] ];
          save = true;
          continue;
        }
        // other words
        lookup.push(missing[j]);
      }
      if (!lookup.length) {
        break;
      }
      // download missing words
      const url = `https://www.deutschestextarchiv.de/demo/cab/query?a=expand.eqlemma&fmt=json&clean=1&pretty=1&raw=1&q=${encodeURIComponent(lookup.join(" "))}`;
      promises.push(shared.fetch(url));
    }
    const [ ...results ] = await Promise.all(promises);
    for (const data of results) {
      if (!data.ok) {
        continue;
      }
      let json;
      try {
        json = JSON.parse(data.text);
      } catch {
        continue;
      }
      for (const t of json.body[0].tokens) {
        const { text: word } = t;
        const variants = [];
        variants.push(word);
        const wordIsLower = /^[a-zäöü]/.test(word);
        for (const v of t.eqlemma) {
          if (!v.hi) {
            continue;
          }
          const variant = v.hi.trim();
          const variantIsLower = /^[a-zäöü]/.test(variant);
          if (wordIsLower === variantIsLower &&
              !/['-.:,;]/.test(variant) &&
              !variants.includes(variant)) {
            variants.push(variant);
          }
        }
        hints.variants[word] = variants;
        save = true;
      }
    }
    // make RegExp for lemma list
    for (const [ lemma, data ] of Object.entries(hints.lemmas)) {
      const vari = [];
      for (const word of lemma.split(" ")) {
        if (artBestimmt.includes(word)) {
          vari.push(`(?:${artBestimmt.join("|")})`);
        } else if (artUnbestimmt.includes(word)) {
          vari.push(`(?:${artUnbestimmt.join("|")})`);
        } else if (noLookup.includes(word)) {
          vari.push(word);
        } else {
          vari.push(`(?:${hints.variants[word].join("|")})`);
        }
      }
      data.reg = new RegExp(`^${vari.join(" ")}$`);
    }
    // save completed variants to cache file
    if (save) {
      try {
        shared.fsp.writeFile(path, JSON.stringify(hints.variants));
      } catch {}
    }
  },
};