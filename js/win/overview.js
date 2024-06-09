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
        xsl: "artikel.tt",
      });
      if (!result) {
        return false;
      }
      tt = overview.tt;
    }

    // fill in articles
    const content = overview.make(noNew);
    const page = tt.replace("{{RESULT}}", content);

    // return page if called via CLI
    if (cli) {
      return page;
    }

    // save file
    const options = {
      title: "artikel.tt speichern",
      defaultPath: modules.path.join(shared.info.documents, "artikel.tt"),
      filters: [
        {
          name: "TemplateToolkit",
          extensions: [ "tt" ],
        },
      ],
    };
    if (prefs.data.zdl) {
      options.defaultPath = modules.path.join(prefs.data.zdl, "root", "wb", "WGd", "artikel.tt");
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

      // publication year
      const [ year ] = file.published.split("-");

      // title
      const lemmas = {
        hl: [],
        nl: [],
      };
      for (const [ k, v ] of Object.entries(lemmas)) {
        for (const i of file[k + "Joined"]) {
          v.push(shared.hidxPrint(i));
        }
      }
      let title = lemmas.hl.join("&nbsp;· ");
      if (lemmas.nl.length) {
        title += ` (${lemmas.nl.join("&nbsp;· ")})`;
      }

      // article link
      const link = encodeURIComponent(shared.hidxClear(file.hl[0]));

      // push entry
      entries.push({
        year: parseInt(year, 10),
        date: file.published,
        title,
        link,
        fa: file.fa,
      });
    }

    // sort entries
    shared.sortModeForLemmas = true;
    entries.sort((a, b) => {
      // sort by year
      if (a.year !== b.year) {
        return b.year - a.year;
      }

      // sort by date
      if (a.date !== b.date) {
        const x = [ a.date, b.date ];
        x.sort();
        if (x[0] === a.date) {
          return 1;
        }
        return -1;
      }

      // sort by title
      return shared.sort(a.title, b.title);
    });
    shared.sortModeForLemmas = false;

    // make and return HTML code
    const base = "[% base %]wb/wortgeschichten/";
    let html = "";
    const years = {
      last: 0,
      count: 0,
    };

    html = indent(2) + "<ul>";
    for (const entry of entries) {
      // add new section
      // TODO for now, do not print the publication year (this is for political reasons only)
      if (entry.year !== years.last) {
        // if (html) {
        //   html += indent(4) + "</ul>";
        //   html += indent(2) + "</section>";
        // }

        if (years.count === 2) {
          break;
        }
        years.count++;
        years.last = entry.year;

        // html += indent(2) + "<section>";
        // html += indent(4) + `<h3>${entry.year}</h3>`;
        // html += indent(4) + "<ul>";
      }

      // add entry
      // const date = entry.date.match(/(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<date>[0-9]{2})/);
      const wfa = entry.fa ? ' class="wgd-wfa"' : "";

      // html += indent(6) + `<li><a href="${base + entry.link}" title="publiziert am ${date.groups.date.replace(/^0/, "")}. ${date.groups.month.replace(/^0/, "")}. ${date.groups.year}"${wfa}>${entry.title}</a></li>`;
      html += indent(6) + `<li><a href="${base + entry.link}"${wfa}>${entry.title}</a></li>`;
    }
    html += indent(2) + "</ul>";

    return html;

    // return a new line with a proper indent
    function indent (n) {
      return "\n" + " ".repeat(n);
    }
  },
};
