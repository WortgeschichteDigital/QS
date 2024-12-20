"use strict";

const viewHints = {
  // hint types
  types: {
    article_file: "Dateiname korrigieren",
    article_heading: "Überschrift korrigieren",
    article_id: "Artikel-ID korrigieren",
    comment: "XML-Kommentar",
    diasystemic_value: "Diasystematik ergänzen",
    ez_link: "Objektsprache mit Artikel verlinken",
    ez_stichwort: "Stichwort falsch ausgezeichnet",
    hidx_missing: "Homographen-Index ergänzen",
    link_duplicate: "Duplikat entfernen",
    link_error: "Artikel-Link korrigieren",
    literature_error: "Literatur-Tag korrigieren",
    literature_missing: "Literaturtitel ergänzen",
    quotation_date: "Belegdatum korrigieren",
    quotation_helterskelter: "Beleg in falscher Reihenfolge",
    quotation_referror: "Belegreferenz kein Beleg",
    quotation_superfluous: "Beleg nicht zitiert",
    quotcluster_helterskelter: "Belegreferenzen in falscher Reihenfolge",
    revision_future: "Revisionsdatum in der Zukunft",
    revision_helterskelter: "Revision in falscher Reihenfolge",
    revision_samedate: "mehrere Revisionen am selben Tag",
    semantic_link: "semantischen Artikel-Link ergänzen",
    semantic_type: "Semantik ergänzen",
    sprache_superfluous: "Sprach-Attribut entfernen",
    stichwort_ez: "Objektsprache falsch ausgezeichnet",
    tr_error: "Textreferenz korrigieren",
    tr_link: "Textreferenz mit Artikel verlinken",
    tr_superfluous: "Textreferenz entfernen",
    www_error: "Externen Link korrigieren",
    www_link: "Externen Link mit Artikel verlinken",
  },

  // intersection observer for hints
  // (the last hint is observed if there are more to display)
  observer: new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      }
      viewHints.print();
    });
  }),

  // current hints data
  data: {
    hints: [],
    files: new Set(),
    filesPrinted: new Set(),
    filesPrintedBefore: new Set(),
  },

  // last content state of this view
  contentState: {
    // hash
    filterState: "",
    // date of last XML update
    xmlDate: "",
  },

  // populate the view
  //   type = string (switched | updated)
  async populate (type) {
    await xml.updateWait();
    if (win.view !== "hints") {
      return;
    }

    // get current content state
    // (restore scroll position in case the state is unchanged)
    const filterState = win.getFilterState();
    if (filterState === viewHints.contentState.filterState &&
        xml.data.date === viewHints.contentState.xmlDate) {
      win.viewScrollTopReset(type);
      bars.resultsHints();
      return;
    }

    // memorize scroll position
    const { scrollY } = window;

    // clear hints area
    const cont = document.querySelector("#hints");
    cont.replaceChildren();

    // collect relevant hints
    viewHints.collect();

    // no hints to be displayed
    const { data } = viewHints;
    if (!data.hints.length) {
      cont.appendChild(win.nothingToShow());
      bars.resultsHints();
      viewHints.contentState.filterState = filterState;
      viewHints.contentState.xmlDate = xml.data.date;
      return;
    }

    // sort hints
    win.sortingApply(win.sortingGetData(), data.hints);

    // prepare file lists
    data.files.clear();
    data.filesPrintedBefore = new Set([ ...data.filesPrinted ]);
    data.filesPrinted.clear();
    data.hints.forEach(i => data.files.add(i.file));

    // print first chunk of hints and reset scroll position
    viewHints.print();
    if (filterState === viewHints.contentState.filterState) {
      // restore scroll position only in case the filter state is identical
      while (data.filesPrinted.size < data.filesPrintedBefore.size &&
          data.filesPrinted.size < data.files.size) {
        viewHints.print();
      }
      if (type === "updated") {
        window.scrollTo(0, scrollY);
      } else {
        win.viewScrollTopReset(type);
      }
    } else {
      window.scrollTo(0, 0);
    }
    viewHints.contentState.filterState = filterState;
    viewHints.contentState.xmlDate = xml.data.date;

    // handle results bar
    bars.resultsHints();
  },

  // collect hints
  collect () {
    // get filter data
    const dataF = bars.filtersGetData();
    dataF["select-status"] = parseInt(dataF["select-status"], 10);
    const dataS = win.sortingGetData();
    const regPath = new RegExp(shared.escapeRegExp(dataS.filter), "i");
    let hintTypes = [];
    for (const [ k, v ] of Object.entries(dataF)) {
      if (!/^filters-hints/.test(k) || !v) {
        continue;
      }
      switch (k.replace(/^filters-hints-/, "")) {
        case "links_error":
          hintTypes = hintTypes.concat([
            "link_duplicate",
            "link_error",
            "tr_error",
            "tr_superfluous",
            "www_error",
          ]);
          break;
        case "links_suggestion":
          hintTypes = hintTypes.concat([
            "ez_link",
            "tr_link",
            "www_link",
          ]);
          break;
        case "tagging_error":
          hintTypes = hintTypes.concat([
            "ez_stichwort",
            "hidx_missing",
            "literature_error",
            "sprache_superfluous",
            "stichwort_ez",
          ]);
          break;
        case "tagging_diasystems":
          hintTypes = hintTypes.concat([ "diasystemic_value" ]);
          break;
        case "tagging_semantics":
          hintTypes = hintTypes.concat([
            "semantic_link",
            "semantic_type",
          ]);
          break;
        case "quotations_error":
          hintTypes = hintTypes.concat([
            "quotation_date",
            "quotation_helterskelter",
            "quotation_referror",
            "quotation_superfluous",
            "quotcluster_helterskelter",
          ]);
          break;
        case "general":
          hintTypes = hintTypes.concat([
            "article_file",
            "article_heading",
            "article_id",
            "literature_missing",
            "revision_future",
            "revision_helterskelter",
            "revision_samedate",
          ]);
          break;
        case "comment":
          hintTypes = hintTypes.concat([ "comment" ]);
          break;
      }
    }

    // collect hints
    viewHints.data.hints = [];
    for (const [ file, data ] of Object.entries(xml.data.files)) {
      // filter XML files
      if (dataF["select-authors"] && !data.authors.includes(dataF["select-authors"]) ||
          dataF["select-domains"] && !data.domains.includes(dataF["select-domains"]) ||
          dataF["select-status"] && data.status !== dataF["select-status"] ||
          !regPath.test(data.dir + "/" + file)) {
        continue;
      }
      for (const hint of data.hints) {
        // filter hint type and special filters
        if (!hintTypes.includes(hint.type) ||
            hint.linkCount && dataF["filters-hints-links_suggestion_filter"] ||
            hint.type === "comment" && dataF["filters-hints-comment_filter"] && !commentAuthorText(hint.textHint[0])) {
          continue;
        }
        // filter by mark
        const mark = prefs.data?.marks?.[hint.ident];
        if (!mark && !dataF["filters-marks-unchecked"] ||
            mark === 1 && !dataF["filters-marks-checked_okay"] ||
            mark === 2 && !dataF["filters-marks-checked_error"]) {
          continue;
        }
        // push hint
        viewHints.data.hints.push({
          dir: data.dir,
          file,
          hint,
          published: data.published,
        });
      }
    }

    // reduce comment text
    function commentAuthorText (text) {
      let t = text.match(/<!--(.+?)-->/s)[1];
      t = t.replace(/<.+?>/g, "").trim();
      return t;
    }
  },

  // print hints
  print () {
    const cont = document.querySelector("#hints");

    // remove last hint from intersection observer entries
    if (cont.lastChild) {
      viewHints.observer.unobserve(cont.lastChild);
    }

    // prepare printing
    const { filesPrinted } = viewHints.data;
    let start = 0;
    for (let i = 0, len = viewHints.data.hints.length; i < len; i++) {
      if (!filesPrinted.has(viewHints.data.hints[i].file)) {
        start = i;
        break;
      }
    }

    // print next 50 hints
    const asideIcons = [
      {
        file: viewHints.markIcons,
        fun: "toggleMark",
        title: "Markierung ändern",
      },
      {
        file: [ "context.svg" ],
        fun: "popupContext",
        title: "Kontext anzeigen",
      },
    ];
    let lastFile = "";
    for (let f = start, len = viewHints.data.hints.length; f < len; f++) {
      const i = viewHints.data.hints[f];

      // HEADING
      if (i.file !== lastFile) {
        if (f - start + 1 >= 50) {
          break;
        }
        filesPrinted.add(i.file);
        // create heading
        cont.appendChild(win.makeListHeading(i.file));
        // update variables
        lastFile = i.file;
      }

      // BLOCK
      const div = document.createElement("div");
      cont.appendChild(div);
      div.classList.add("hint-block");
      div.dataset.file = i.file;
      div.dataset.ident = i.hint.ident;
      div.dataset.line = i.hint.line;

      // ASIDE
      // (line, mark, context)
      const aside = document.createElement("div");
      div.appendChild(aside);
      aside.classList.add("aside");
      const line = document.createElement("div");
      aside.appendChild(line);
      line.classList.add("line");
      line.innerHTML = `Zeile <b>${i.hint.line}</b>`;
      const icons = document.createElement("div");
      aside.appendChild(icons);
      icons.classList.add("icons");
      for (const icon of asideIcons) {
        const a = document.createElement("a");
        icons.appendChild(a);
        a.classList.add("icon");
        a.dataset.fun = icon.fun;
        a.href = "#";
        a.title = icon.title;
        let imgN = 0;
        if (icon.fun === "toggleMark") {
          imgN = prefs.data?.marks?.[i.hint.ident] || 0;
        }
        const img = document.createElement("img");
        a.appendChild(img);
        img.src = `img/win/${icon.file[imgN]}`;
        img.width = "36";
        img.height = "36";
        img.alt = "";
        a.addEventListener("click", function (evt) {
          evt.preventDefault();
          const hint = this.closest("[data-file]").dataset;
          viewHints[this.dataset.fun]({
            ele: this,
            file: hint.file,
            ident: hint.ident,
            line: parseInt(hint.line, 10),
          });
        });
      }

      // HINT
      const hint = document.createElement("div");
      div.appendChild(hint);
      hint.classList.add("hint");

      // general hint message
      const h2 = document.createElement("h2");
      hint.appendChild(h2);
      const a = document.createElement("a");
      h2.appendChild(a);
      a.dataset.type = i.hint.type;
      a.href = "#";
      a.textContent = viewHints.types[i.hint.type];
      a.title = "Erläuterung im Handbuch öffnen";
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        modules.ipc.invoke("help", {
          id: this.dataset.type,
          section: "hinweise",
        });
      });

      // erroneous text
      if (i.hint.textErr.length) {
        const textE = document.createElement("div");
        hint.appendChild(textE);
        textE.classList.add("text-erroneous");
        viewHints.fillText(textE, i.hint.textErr);
      }

      // correct text
      if (i.hint.textHint.length) {
        const textH = document.createElement("div");
        hint.appendChild(textH);
        viewHints.fillText(textH, i.hint.textHint);
        if (i.hint.textErr.length) {
          textH.classList.add("text-correct");
        } else {
          textH.classList.add("text-hint");
        }
      }

      // link count
      if (i.hint.linkCount) {
        const count = document.createElement("div");
        hint.appendChild(count);
        count.classList.add("repeated");
        count.textContent = `Schon ${i.hint.linkCount}\u00A0⨉ verlinkt!`;
      }

      // scope
      const scope = document.createElement("div");
      hint.appendChild(scope);
      scope.classList.add("scope");
      scope.textContent = i.hint.scope;
    }

    // initialize tooltips
    tooltip.init(cont);

    // let's have some doomscrolling
    if (filesPrinted.size !== viewHints.data.files.size) {
      viewHints.observer.observe(cont.lastChild);
    }
  },

  // fill in hint texts
  //   cont = node
  //   text = array
  fillText (cont, text) {
    for (const i of text) {
      const p = document.createElement("p");
      cont.appendChild(p);
      if (typeof i === "string") {
        appendText(i, p);
      } else {
        if (i.type === "context") {
          p.classList.add("context");
          const context = document.createElement("p");
          cont.insertBefore(context, p);
          context.classList.add("context");
          context.innerHTML = "<i>Kontext:</i> ";
        } else if (i.type === "copy") {
          p.title = "Klick zum Kopieren";
          p.addEventListener("click", function () {
            const range = new Range();
            range.setStartBefore(this.firstChild);
            range.setEndAfter(this.lastChild);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            navigator.clipboard.writeText(sel.toString())
              .then(() => shared.feedback("copied"))
              .catch(() => shared.feedback("error"));
          });
        } else if (i.type === "hint_text") {
          p.classList.add("hint-text");
        }
        appendText(i.text, p);
        if (i.type === "comment_link") {
          p.classList.add("no-select");
          const a = document.createElement("a");
          p.appendChild(a);
          a.classList.add("comment-link");
          a.href = "#";
          a.textContent = "Auskommentieren?";
          a.addEventListener("click", function (evt) {
            evt.preventDefault();
            viewHints.popupComment(this);
          });
        }
      }
    }

    // prepare text (replace special tokens, highlight, line breaks)
    function appendText (text, p) {
      // prepare text
      let t = viewSearch.textMaskChars(text);
      if (/&lt;/.test(t) &&
          /&gt;/.test(t)) {
        t = shared.xmlColorCode(t);
      }
      // highligh attributs outside of tags
      t = t.replace(/(@[a-zA-Z:]+=?)(&quot;.+?&quot;)?/g, (m, p1, p2) => {
        if (!p2) {
          return `<span class="xml-attr-key">${m}</span>`;
        }
        return `<span class="xml-attr-key">${p1}</span><span class="xml-attr-val">${p2}</span>`;
      });
      t = t.replace(/\n/g, "<br>");

      // append text
      if (/ {2}/.test(t)) {
        p.classList.add("pre");
      }
      p.innerHTML = t;
    }
  },

  // mark icons
  markIcons: [ "mark-unchecked-small.svg", "button-yes.svg", "button-no.svg" ],

  // toggle a hint's mark
  //   ident = string (identification hash)
  toggleMark ({ ident }) {
    if (!prefs.data.marks) {
      prefs.data.marks = {};
    }
    let state = prefs.data.marks?.[ident] || 0;
    if (state === 2) {
      state = 0;
    } else {
      state++;
    }
    if (state) {
      prefs.data.marks[ident] = state;
    } else {
      delete prefs.data.marks[ident];
    }
    document.querySelectorAll(`.hint-block[data-ident="${ident}"] a[data-fun="toggleMark"] img`).forEach(i => {
      i.src = `img/win/${viewHints.markIcons[state]}`;
    });
  },

  // erase marks for hints that no longer exist
  cleanUpMarks () {
    if (!prefs.data.marks) {
      return;
    }
    const idents = new Set();
    for (const data of Object.values(xml.data.files)) {
      for (const hint of data.hints) {
        idents.add(hint.ident);
      }
    }
    for (const ident of Object.keys(prefs.data.marks)) {
      if (!idents.has(ident)) {
        delete prefs.data.marks[ident];
      }
    }
  },

  // erase all marks
  eraseMarks () {
    prefs.data.marks = {};
    prefs.save();
    shared.feedback("okay");
    // force an update of the view by resetting the content state
    viewHints.contentState.xmlDate = "";
    if (win.view === "hints") {
      viewHints.populate("updated");
    }
  },

  // navigation: last index shown
  // (reset on scroll and on resize)
  navIdx: -1,

  // navigation: last index actually shown
  // (this variable is never reset on scroll or on resize)
  navLastIdx: -1,

  // navigation: jump to next/previous hint
  //  down = boolean
  nav (down) {
    const hints = document.querySelectorAll(".hint-block");
    if (!hints.length) {
      return;
    }

    const barBottom = document.querySelector("#sorting").getBoundingClientRect().bottom;
    const h1Height = document.querySelector("#hints h1").offsetHeight;
    const top = barBottom + h1Height;
    if (viewHints.navIdx === -1) {
      for (let i = 0, len = hints.length; i < len; i++) {
        const rect = hints[i].getBoundingClientRect();
        if (rect.top >= top) {
          if (down && rect.top === top) {
            viewHints.navIdx = ++i;
          } else if (down) {
            viewHints.navIdx = i;
          } else {
            viewHints.navIdx = --i;
          }
          break;
        }
      }
    } else if (down) {
      viewHints.navIdx++;
    } else {
      viewHints.navIdx--;
    }

    if (viewHints.navIdx === hints.length) {
      viewHints.navIdx = hints.length - 1;
      shared.feedback("reached-bottom");
      return;
    } else if (viewHints.navIdx < 0) {
      viewHints.navIdx = -1;
      shared.feedback("reached-top");
      return;
    }

    if (down && viewHints.navIdx === viewHints.navLastIdx) {
      viewHints.navIdx++;
    }
    viewHints.navLastIdx = viewHints.navIdx;
    const ele = hints[viewHints.navIdx];
    const rect = ele.getBoundingClientRect();
    window.scrollTo({
      top: window.scrollY + rect.top - top,
      left: 0,
      behavior: "smooth",
    });

    // highlight the result and show feedback
    shared.highlightBlock(ele);
    if (!down && viewHints.navIdx === 0) {
      shared.feedback("reached-top");
    } else if (down && viewHints.navIdx === hints.length - 1) {
      shared.feedback("reached-bottom");
    }
  },

  // popup: show help on how to add comments to a non existing link
  //   caller = node (clicked link)
  popupComment (caller) {
    const content = document.createElement("div");
    content.innerHTML = `<p>Unkommentierter Verweis:</p>
<code><span class="xml-tag">&lt;Verweis&gt;
  &lt;Verweistext&gt;&lt;erwaehntes_Zeichen&gt;</span>Lemma<span class="xml-tag">&lt;/erwaehntes_Zeichen&gt;&lt;/Verweistext&gt;
  &lt;Verweisziel&gt;</span>Lemma<span class="xml-tag">&lt;/Verweisziel&gt;
&lt;/Verweis&gt;</span></code>
<p>Auskommentierter Verweis:</p>
<code><span class="xml-comment">&lt;!--&lt;Verweis&gt;
  &lt;Verweistext&gt;--&gt;</span><span class="xml-tag">&lt;erwaehntes_Zeichen&gt;</span>Lemma<span class="xml-tag">&lt;/erwaehntes_Zeichen&gt;</span><span class="xml-comment">&lt;!--&lt;/Verweistext&gt;
  &lt;Verweisziel&gt;Lemma&lt;/Verweisziel&gt;
&lt;/Verweis&gt;--&gt;</span></code>`;
    viewHints.popupShow(caller, content, "comment");
  },

  // popup: show extended XML context for a certain hint
  //   ele = node (clicked link)
  //   file = string (XML file name)
  //   ident = string (identification hash)
  //   line = number
  popupContext ({ ele, file, ident, line }) {
    const data = xml.data.files[file];
    const hint = data.hints.find(i => i.ident === ident && i.line === line);
    if (!hint.line) {
      dialog.open({
        type: "alert",
        text: "Zu diesem Hinweis gibt es keinen Kontext.",
      });
      return;
    } else if (!xml.files[file]) {
      shared.error(`Dateidaten für „${file}“ nicht gefunden`);
      return;
    }

    // DETECT LINES
    const fileCont = xml.files[file].split("\n");

    // Numbers in "lines" are zero based!
    const lines = [];

    // special cases: article_id, literature_error, literature_missing
    if (/article_id|literature_(error|missing)/.test(hint.type)) {
      lines.push(hint.line - 1);

    // special case: comment outside of text or link lists
    } else if (hint.type === "comment" &&
        !/Belegauswahl|Kurz gefasst|Verweise|Wortgeschichte/.test(hint.scope)) {
      const startIndex = /<!--/.exec(fileCont[hint.line - 1]).index;
      let l = 0;
      for (let i = hint.line - 1, len = fileCont.length; i < len; i++) {
        const m = /-->/.exec(fileCont[i]);
        if (m && (i !== hint.line - 1 || m.index > startIndex)) {
          l = i;
          break;
        }
      }
      for (let i = hint.line - 1; i <= l; i++) {
        lines.push(i);
      }

    // special case: diasystemic_value
    } else if (hint.type === "diasystemic_value") {
      const exSub = [];
      let sub = 0;
      let end = 0;
      for (let i = hint.line, len = fileCont.length; i < len; i++) {
        if (/<\/Lesart>/.test(fileCont[i])) {
          if (sub) {
            sub--;
            for (let j = exSub.at(-1) + 1; j <= i; j++) {
              exSub.push(j);
            }
            continue;
          }
          end = i;
          break;
        }
        if (/<Lesart/.test(fileCont[i])) {
          sub++;
          exSub.push(i);
        }
      }
      for (let i = hint.line - 1; i <= end; i++) {
        if (exSub.includes(i)) {
          continue;
        }
        lines.push(i);
      }

    // scope "Verweise"
    } else if (hint.scope === "Verweise") {
      // detect start and end of the surrounding <Verweise>
      const blockBorders = [];
      for (let i = hint.line - 1; i > 0; i--) {
        if (/<Verweise/.test(fileCont[i])) {
          blockBorders.push(i);
          break;
        }
      }
      for (let i = hint.line - 1, len = fileCont.length; i < len; i++) {
        if (/<\/Verweise>/.test(fileCont[i])) {
          blockBorders.push(i);
          break;
        }
      }
      // get node block
      const nodeType = fileCont[hint.line - 1].match(/<([a-zA-Z_!-]+)/);
      let regEnd = new RegExp(`</${nodeType[1]}>`);
      if (nodeType === "!--") {
        regEnd = /-->/;
      }
      let end = 0;
      for (let i = hint.line - 1, len = fileCont.length; i < len; i++) {
        const line = fileCont[i];
        if (regEnd.test(line)) {
          end = i;
          break;
        }
      }
      for (let i = hint.line - 1; i <= end; i++) {
        lines.push(i);
      }
      if (!lines.includes(blockBorders[0])) {
        lines.unshift(blockBorders[0]);
      }
      if (!lines.includes(blockBorders[1])) {
        lines.push(blockBorders[1]);
      }

    // everything else
    } else {
      let start = 0;
      for (let i = hint.line - 1; i >= 0; i--) {
        const line = fileCont[i];
        if (/<(Absatz|Belegreihe|Blockzitat|Liste|Textblock)/.test(line)) {
          start = i;
          break;
        }
      }
      let end = 0;
      for (let i = hint.line - 1, len = fileCont.length; i < len; i++) {
        const line = fileCont[i];
        if (/<\/(Absatz|Belegreihe|Blockzitat|Liste|Textblock)>/.test(line)) {
          end = i;
          break;
        }
      }
      for (let i = start; i <= end; i++) {
        lines.push(i);
      }
    }

    // PREPARE HIGHLIGHTING
    const words = [];
    for (const i of hint.textErr) {
      if (typeof i === "string" || i.type === "context") {
        const text = i.type === "context" ? i.text : i;
        for (const m of text.matchAll(/<[^/].+?>(.+?)<\/.+?>/g)) {
          if (!words.includes(m[1])) {
            words.push(m[1]);
          }
        }
      }
    }
    if (hint.type === "diasystemic_value") {
      const value = hint.textHint[0].match(/> (.+)/)[1];
      words.push(value);
    }
    const regExp = [];
    for (let i = 0, len = words.length; i < len; i++) {
      let reg;
      if (hint.type === "diasystemic_value") {
        reg = new RegExp(words[i], "g");
      } else {
        reg = new RegExp("(?<=>)" + shared.escapeRegExp(viewSearch.textMaskChars(words[i])) + "(?=<)", "g");
      }
      regExp.push({
        high: reg,
        search: reg,
        termN: i,
      });
    }

    // MAKE TABLE
    const showBlankLines = lines.at(-1) - lines[0] + 1 === lines.length;
    let trimWhitespace = -1;
    for (let i = 0, len = lines.length; i < len; i++) {
      const m = fileCont[lines[i]].match(/^\s+/);
      if (m && (trimWhitespace === -1 || m[0].length < trimWhitespace)) {
        trimWhitespace = m[0].length;
      }
    }

    // make table
    const table = document.createElement("table");
    let lastLine = 0;
    let commentOpen = false;
    for (let i = 0, len = lines.length; i < len; i++) {
      // prepare code
      const line = lines[i];
      let code = fileCont[line];
      if (!showBlankLines && !code.trim()) {
        continue;
      }
      if (code.length >= trimWhitespace) {
        code = code.substring(trimWhitespace);
      }
      code = viewSearch.textMaskChars(code);
      code = shared.xmlColorCode(code, false);
      if (regExp.length) {
        code = viewSearch.textHighlight(code, regExp).text;
      }
      code = viewSearch.textWbr(code);
      if (/--&gt;(?!<\/span>)/.test(code)) {
        commentOpen = false;
        code = code.replace(/.+--&gt;(?!<\/span>)/g, m => `<span class="xml-comment">${m}</span>`);
      }
      let commentOpenSet = false;
      if (/(?<!<span class="xml-comment">)&lt;!--/.test(code)) {
        commentOpen = true;
        commentOpenSet = true;
        code = code.replace(/(?<!<span class="xml-comment">)&lt;!--.+/g, m => `<span class="xml-comment">${m}</span>`);
      }
      if (commentOpen && !commentOpenSet) {
        code = `<span class="xml-comment">${code}</span>`;
      }

      // print ellipsis
      if (lastLine && line > lastLine + 1) {
        const tr = document.createElement("tr");
        table.appendChild(tr);
        const td = document.createElement("td");
        tr.appendChild(td);
        td.setAttribute("colspan", "2");
        td.textContent = "...";
      }
      lastLine = line;

      // print line number
      const tr = document.createElement("tr");
      table.appendChild(tr);
      const th = document.createElement("th");
      tr.appendChild(th);
      th.textContent = line + 1;
      if (line + 1 === hint.line) {
        th.classList.add("hint-line");
      }

      // print code
      const td = document.createElement("td");
      tr.appendChild(td);
      td.innerHTML = code;
    }

    // SHOW POPUP
    const content = document.createElement("div");
    const p = document.createElement("p");
    content.appendChild(p);
    const hintText = hint.textErr.find(i => i.type === "hint_text");
    let text = `<b>${viewHints.types[hint.type]}</b>`;
    if (hintText) {
      text += `<i>${hintText.text}</i>`;
    }
    p.innerHTML = text;
    const scrollCont = document.createElement("div");
    content.appendChild(scrollCont);
    scrollCont.classList.add("scrollable");
    scrollCont.appendChild(table);
    viewHints.popupShow(ele, content, "context");

    // REMOVE TOOLTIP
    ele.dispatchEvent(new Event("mouseout"));
  },

  // popup: ID of the last hints popup
  popupID: 0,

  // popup: show hints popup
  //   caller = node (clicked link)
  //   content = node
  //   type = string (comment | context | lemmas)
  popupShow (caller, content, type) {
    // close existing popup of same type
    viewHints.popupClose({
      type,
    });

    // create new popup
    const popup = document.createElement("div");
    caller.closest("div, section").appendChild(popup);
    popup.classList.add("hints-popup");
    popup.dataset.id = ++viewHints.popupID;
    popup.style.zIndex = document.querySelectorAll(".hints-popup").length + 1;

    // close icon
    const a = document.createElement("a");
    popup.appendChild(a);
    a.href = "#";
    a.addEventListener("click", function (evt) {
      evt.preventDefault();
      viewHints.popupClose({
        id: this.parentNode.dataset.id,
      });
    });
    const img = document.createElement("img");
    a.appendChild(img);
    img.src = "img/win/close.svg";
    img.width = "30";
    img.height = "30";
    img.alt = "";

    // append content
    popup.appendChild(content);

    // position popup
    const popupHeight = popup.offsetHeight;
    if (type === "lemmas" ||
        popupHeight > window.innerHeight / 2) {
      popup.classList.add("fixed", type + "-popup");
    } else {
      popup.classList.add("absolute", type + "-popup");
      const callerRect = caller.getBoundingClientRect();
      const callerTop = caller.offsetTop;
      if (callerRect.top + callerRect.height + popupHeight + window.scrollY + 10 > document.body.scrollHeight) {
        popup.style.top = callerTop - popupHeight - 10 + "px";
      } else {
        popup.style.top = callerTop + callerRect.height + 10 + "px";
      }
      popup.style.left = caller.offsetLeft + "px";
    }

    // show popup
    popup.classList.add("visible");

    // scroll to line in question
    const scrollCont = popup.querySelector(".scrollable");
    if (scrollCont && scrollCont.offsetHeight !== scrollCont.scrollHeight) {
      const row = scrollCont.querySelector(".hint-line").parentNode.previousSibling;
      if (row) {
        scrollCont.scrollTop = row.offsetTop;
      }
    }
  },

  // closes existing hints popup
  //   id = string (ID of the popup that should be closed)
  //   type = string (type of the popup that should be closed
  popupClose ({ id = "", type = "" }) {
    const close = [];
    for (const i of document.querySelectorAll(".hints-popup")) {
      if (!i.classList.contains("visible")) {
        continue;
      }
      if (id && i.dataset.id === id ||
          type && i.classList.contains(type + "-popup") ||
          !id && !type) {
        close.push(i);
      }
    }
    for (const i of close) {
      i.addEventListener("transitionend", function () {
        this.parentNode.removeChild(this);
      }, { once: true });
      i.classList.remove("visible");
    }
  },

  // export hints that can be used for a safe replacement
  async exportHints () {
    // populate export list
    const safe = [
      "quotation_date",
      "quotcluster_helterskelter",
    ];
    const exportList = [];
    for (const i of viewHints.data.hints) {
      // Is this hint safe?
      if (!safe.includes(i.hint.type)) {
        continue;
      }

      // create safe replacement entry
      exportList.push({
        file: i.file,
        line: i.hint.line,
        textCur: i.hint.textErr[0],
        textRep: i.hint.textHint[0]?.text || i.hint.textHint[0],
      });
    }

    // nothing to export
    if (!exportList.length) {
      dialog.open({
        type: "alert",
        text: "Es werden keine Hinweise angezeigt, die durch eine sichere Ersetzung behoben werden können.",
      });
      return;
    }

    // export list
    const options = {
      title: "Hinweise speichern",
      defaultPath: modules.path.join(shared.info.userData, "safe-replacements.json"),
      filters: [
        {
          name: "JSON",
          extensions: [ "json" ],
        },
      ],
    };
    const result = await modules.ipc.invoke("file-dialog", false, options);
    if (result.canceled || !result.filePath) {
      return;
    }
    try {
      await modules.fsp.writeFile(result.filePath, JSON.stringify(exportList, null, " ".repeat(2)));
    } catch (err) {
      shared.error(`${err.name}: ${err.message} (${shared.errorReduceStack(err.stack)})`);
    }
  },
};
