
import bars from "./bars.mjs";
import git from "./git.mjs";
import misc from "./misc.mjs";
import prefs from "./prefs.mjs";
import viewHints from "./viewHints.mjs";

import dialog from "../dialog.mjs";
import shared from "../shared.mjs";

export { xml as default };

const xml = {
  // XML file data
  //   branch             = ""  master | preprint
  //   date               = ""  date of analysis, full ISO date: YYYY-MM-DDTHH:MM:SS.MMMM
  //   files              = {}
  //     [FILENAME]       = {}
  //       authors        = []  article authors
  //       diasys         = []  diasystemic information
  //         category     = ""
  //         value        = ""
  //         lemma        = ""  "hlJoined" this value pertains to
  //       dir            = ""  articles | ignore
  //       domains        = []  topic domains of this article
  //       fa             = |   article is field article
  //       faLemmas       = []  lemmas this field article deals with
  //       hash           = ""  SHA1 hash, derived from XML file content
  //       hints          = []  all hints regarding this file
  //         ident        = ""  identifier hash (10 hex digits, sometimes not unique)
  //         line         = 1   line number
  //         linkCount    = 1   link count, > 0 means: 'there are already links to the proposed destination';
  //                              the analysis is limited to the current block (i.e. <Wortgeschichte> etc.)
  //         scope        = ""  Artikel | Bedeutungsgerüst | Belegauswahl | Kurz gefasst |
  //                              Literatur | Verweise | Wortgeschichte
  //         textErr      = []  text that triggered the hint;
  //                              the slots contain either strings or objects; objects have this structure:
  //                                text = text to be printed
  //                                type = information on how to handle the text; used types:
  //                                  comment_link = show how to enclose links to missing lemmas in comments
  //                                  context      = this is contextual information
  //                                  copy         = enable fast copy of text
  //                                  hint_text    = specification for this type of error
  //         textHint     = []  proposal into which "textErr" should be changed;
  //                              the structure is the same as "textErr"
  //         type         = ""  hint type; available types
  //                              article_file        = correct XML file name
  //                              article_heading     = ensure that "Kurz gefasst" has a heading
  //                              article_id          = correct article ID
  //                              comment             = value of comment node
  //                              diasystemic_value   = add diasystemic value
  //                              ez_link             = <erwaehntes_Zeichen>: link to matching article
  //                              ez_stichwort        = <erwaehntes_Zeichen>: change tag to <Stichwort>
  //                              hidx_missing        = @hidx is missing on <Verweisziel> or <Schreibung>
  //                              link_duplicate      = erase duplicate link in <Verweise>
  //                              link_error          = correct internal link
  //                              literature_error    = correct literature tag
  //                              literature_missing  = add missing literature title
  //                              quotation_date      = the citation contains a date of the day which does not match
  //                                                    the quotation's date in <Datum>
  //                              quotation_helterskelter = the quotation is out of chronological order
  //                              quotation_referror  = the cited ID is not a quotation (but something else)
  //                              quotation_superfluous = unused quotation cited
  //                              quotcluster_helterskelter = a cluster of quotations in the article text is not in chronological order
  //                              revision_future     = the revision date is in the future
  //                              revision_helterskelter = the revision date is out of order
  //                              revision_samedate   = there is more than one revision for the same date
  //                              semantic_link       = there is no link to a certain file that has a corresponding link,
  //                                                    which points to this file and has a semantic type attached to it
  //                              semantic_type       = add semantic type
  //                              sprache_superfluous = @Sprache is superfluous
  //                              stichwort_ez        = <Stichwort>: change tag to <erwaehntes_Zeichen>
  //                              tr_error            = correct internal reference
  //                              tr_link             = replace internal reference with link to article
  //                              tr_superfluous      = remove internal reference
  //                              www_error           = correct external link
  //                              www_link            = change external link into internal
  //       hl             = []  //Artikel/Lemma[@Typ = "Hauptlemma"]/Schreibung;
  //                              field articles have the string " (Wortfeld)" attached to them;
  //                              the @hidx is also suffixed in parens: " (n)" (n = number)
  //       hlJoined       = []  same as "hl", but the spellings of each lemma are joined with a slash
  //       id             = ""  //Artikel/@xml:id
  //       links          = []  //Verweis
  //         lemma        = {}  lemma the link points to
  //           file       = ""  XML file name
  //           spelling   = ""  spelling of the lemma as in "hl" or "nl"
  //         line         = 1   line number
  //         points       = 1   cluster points for this link
  //         scope        = ""  Kurz gefasst | Verweise | Wortgeschichte
  //         type         = []  semantic types attached to this link
  //         verweistext  = ""  original text content of //Verweis/Verweistext
  //         verweisziel  = ""  original content of //Verweis/Verweisziel
  //       published      = ""  date the article was published (YYYY-MM-DD),
  //                              derived from the first occurence of //Revision/Datum
  //       nl             = []  //Artikel/Lemma[@Typ = "Nebenlemma"]/Schreibung;
  //                              the @hidx is suffixed in parens: " (n)" (n = number)
  //       nlJoined       = []  same as "nl", but the spellings of each lemma are joined with a slash
  //         [NEBENLEMMA] = ""  //Artikel/Lemma[@Typ = "Nebenlemma"]/Textreferenz/@Ziel
  //       status         = 1   file status
  //                              0 = file is known and unchanged
  //                              1 = file is known, but changed
  //                              2 = file is new, which either means the file is located in "ignore"
  //                                  and there is no file in "articles" or the file is untracked by Git
  //       targets        = []  //Wortgeschichte//*/@xml:id
  data: {
    branch: "",
    date: "",
    files: {},
  },

  // XML file content
  //   [FILENAME] = string (complete XML file)
  files: {},

  // load cache file
  async loadCache () {
    let json;
    try {
      const path = await bridge.ipc.invoke("path-join", shared.info.userData, `xml-cache-${xml.data.branch}.json`);
      const content = await bridge.ipc.invoke("file-read", path);
      json = JSON.parse(content);
    } catch {
      // the cache file might not exist yet which is fine
      return;
    }
    xml.data = json;
  },

  // remove cache files and rebuild xml data
  //   active = true | undefined (clear was initiated by user)
  async resetCache (active = false) {
    await xml.updateWait();
    xml.updating = true;

    // get branch list
    const branches = await git.commandExec("git branch --list");
    const branchList = branches.split("\n");
    branchList.forEach((i, n) => {
      branchList[n] = i.replace(/^[ *]+/g, "");
    });

    // remove cache files
    const promises = [];
    for (const branch of branchList) {
      promises.push(async function () {
        const path = await bridge.ipc.invoke("path-join", shared.info.userData, `xml-cache-${branch}.json`);
        const exists = await bridge.ipc.invoke("exists", path);
        if (!exists) {
          return;
        }
        try {
          await bridge.ipc.invoke("file-unlink", path);
        } catch {}
      }(branch));
    }
    await Promise.all(promises);

    // reset variables
    xml.data.files = {};
    xml.files = {};

    // start update operation
    await xml.update();
    if (active &&
        !xml.updateErrors.length) {
      dialog.open({
        type: "alert",
        text: "Der Cache wurde geleert und für den aktuellen Branch neu aufgebaut.",
      });
    }
  },

  // execute update operation
  //   xmlFiles = object | undefined (filled in case a file is requested by a preview window)
  async update (xmlFiles = null) {
    const statsStart = new Date();
    xml.updating = true;
    xml.updateErrors = [];
    const update = document.getElementById("fun-update");
    if (update.classList.contains("active")) {
      return;
    }

    // animate button
    update.classList.add("active");
    const img = update.firstChild;
    img.src = "img/view-refresh.svg";
    img.classList.add("rotate");

    // detect current branch, update header, load cached data
    const branch = await git.branchCurrentPrint();
    if (xml.data.branch !== branch) {
      xml.data.branch = branch;
      await xml.loadCache();
    }

    // detect changed and untracked files
    let changed = await git.commandExec("git ls-files --modified");
    if (changed === false) {
      reset(false);
      return;
    }
    changed = changed.split("\n");
    let untracked = await git.commandExec("git ls-files --others --exclude-standard");
    if (untracked === false) {
      reset(false);
      return;
    }
    untracked = untracked.split("\n");

    // start worker
    const response = await bridge.ipc.invoke("xml-worker-work", {
      data: xml.data,
      files: xml.files,
      gitDir: git.config.dir,
      changed,
      untracked,
      newAppVersion: prefs.data["app-version"] !== shared.info.version,
      xmlFiles,
    });
    if (!response) {
      shared.error("Einlesen der XML-Dateidaten gescheitert");
      reset(false);
      return;
    }
    xml.data = response.data;
    xml.files = response.files;
    xml.updateErrors = response.updateErrors;

    // finish up
    reset(true);
    function reset (success) {
      // update list of possible filter values
      bars.filtersUpdate();

      // update current view
      misc.viewPopulate("updated");

      // reset button
      update.classList.remove("active");
      img.src = "img/view-refresh-white.svg";
      img.classList.remove("rotate");

      // errors that occured during the update process
      xml.showUpdateErrors();

      // clean marks
      if (success) {
        viewHints.cleanUpMarks();
      }

      // finish up
      xml.updating = false;
      prefs.stats("update", statsStart);
    }
  },

  // update procedure is running
  updating: false,

  // list of errors that occured during the update process
  updateErrors: [],

  // show errors that occured during the update process
  showUpdateErrors () {
    if (!xml.updateErrors.length) {
      return;
    }
    const errorList = [];
    for (const i of xml.updateErrors) {
      delete xml.data.files[i.file];
      delete xml.files[i.file];
      errorList.push(`• <i>${i.file}:</i> ${shared.errorString(i.err.replace(/\n/g, " "))}`);
    }
    dialog.open({
      type: "alert",
      text: `${xml.updateErrors.length === 1 ? "Es ist ein" : "Es sind"} <b class="warn">Fehler</b> aufgetreten!\n${errorList.join("<br>")}`,
    });
  },

  // stall operations while the update procdure is still running
  async updateWait () {
    if (!xml.updating) {
      return;
    }
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (!xml.updating) {
          clearInterval(interval);
          resolve(true);
        }
      }, 25);
    });
  },
};
