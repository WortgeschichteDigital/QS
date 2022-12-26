"use strict";

const viewXml = {
  // last content state of this view
  contentState: {
    // hash
    filterState: "",
    // date of last XML update
    xmlDate: "",
  },

  // populate the view
  //   type = string ("switched": view switched | "updated": XML files updated)
  async populate (type) {
    await xml.updateWait();
    if (win.view !== "xml") {
      return;
    }
    // get current content state
    // (restore scroll position in case the state is unchanged)
    const filterState = win.getFilterState();
    if (filterState === viewXml.contentState.filterState &&
        xml.data.date === viewXml.contentState.xmlDate) {
      win.viewScrollTopReset(type);
      return;
    }
    // glean data
    const data = [];
    for (const [ file, values ] of Object.entries(xml.data.files)) {
      data.push({
        authors: values.authors,
        dir: values.dir,
        domains: values.domains,
        file,
        path: values.dir + "/" + file,
        published: values.published,
        status: "" + values.status,
      });
    }
    // filter data
    const dataF = bars.filtersGetData();
    // dataS.ascending = boolean, .ignore = boolean, .type = alpha | time
    const dataS = win.sortingGetData();
    const regPath = new RegExp(shared.escapeRegExp(dataS.filter), "i");
    for (let i = data.length - 1; i >= 0; i--) {
      if (dataF["select-authors"] && !data[i].authors.includes(dataF["select-authors"]) ||
          dataF["select-domains"] && !data[i].domains.includes(dataF["select-domains"]) ||
          dataF["select-status"] && data[i].status !== dataF["select-status"] ||
          !regPath.test(data[i].path)) {
        data.splice(i, 1);
      }
    }
    // sort data
    win.sortingApply(dataS, data);
    // make table
    const statusIcons = [
      {
        icon: "status-unchanged.svg",
        title: "Datei unverändert",
      },
      {
        icon: "status-changed.svg",
        title: "Datei geändert",
      },
      {
        icon: "status-untracked.svg",
        title: "Datei neu",
      },
    ];
    const teaserOpen = [
      {
        event: "Teaser",
        icon: "preview.svg",
        title: "Teaser anzeigen",
      },
      {
        event: "Open",
        icon: "open-file.svg",
        title: "Datei im Editor öffnen",
      },
    ];
    let tab = document.createElement("table");
    for (const i of data) {
      const tr = document.createElement("tr");
      tab.appendChild(tr);
      tr.dataset.file = i.file;
      tr.dataset.status = i.status;
      // status
      const status = document.createElement("td");
      tr.appendChild(status);
      const statusImg = document.createElement("img");
      status.appendChild(statusImg);
      statusImg.src = `img/win/${statusIcons[i.status].icon}`;
      statusImg.width = "30";
      statusImg.height = "30";
      statusImg.alt = "";
      statusImg.title = statusIcons[i.status].title;
      // file
      const file = document.createElement("td");
      tr.appendChild(file);
      const pv = document.createElement("a");
      file.appendChild(pv);
      pv.dataset.event = "Pv";
      pv.href = "#";
      pv.title = "Datei in der Vorschau öffnen";
      const pvDir = document.createElement("span");
      pv.appendChild(pvDir);
      pvDir.textContent = i.dir + "/";
      pv.appendChild(document.createTextNode(i.file));
      // time
      if (dataS.type === "time") {
        const td = document.createElement("td");
        tr.appendChild(td);
        td.classList.add("time");
        const published = i.published.split("-");
        td.textContent = `${published[2]}.\u00A0${published[1]}.\u00A0${published[0]}`;
      }
      // teaser & open
      for (let j = 0; j < 2; j++) {
        const td = document.createElement("td");
        tr.appendChild(td);
        const a = document.createElement("a");
        td.appendChild(a);
        a.classList.add("icon");
        a.dataset.event = teaserOpen[j].event;
        a.href = "#";
        a.title = teaserOpen[j].title;
        const img = document.createElement("img");
        a.appendChild(img);
        img.src = `img/win/${teaserOpen[j].icon}`;
        img.width = "30";
        img.height = "30";
        img.alt = "";
      }
    }
    // add tooltips
    tooltip.init(tab);
    // append events
    tab.querySelectorAll("tr a").forEach(i => {
      i.addEventListener("click", async function (evt) {
        evt.preventDefault();
        await xml.updateWait();
        if (win.view !== "xml") {
          return;
        }
        viewXml["fun" + this.dataset.event](this);
      });
    });
    // print placeholder in case no XML file made it through
    if (!data.length) {
      tab = win.nothingToShow();
    }
    // insert table
    const xmlSec = document.querySelector("#xml");
    xmlSec.replaceChild(tab, xmlSec.firstChild);
    // restore scroll position (if applicable)
    if (filterState === viewXml.contentState.filterState) {
      // restore scroll position only in case the filter state is identical
      win.viewScrollTopReset(type);
    } else {
      window.scrollTo(0, 0);
    }
    viewXml.contentState.filterState = filterState;
    viewXml.contentState.xmlDate = xml.data.date;
  },

  // open file in preview window
  //   a = node (clicked link)
  funPv (a) {
    const tr = a.closest("tr");
    win.openPv(tr.dataset.file);
  },

  // resources/wortgeschichten-teaser.xsl
  funTeaserXsl: "",

  // show teaser
  //   a = node | string (clicked link or file name)
  async funTeaser (a) {
    let fileName = "";
    if (typeof a === "string") {
      fileName = a;
    } else {
      fileName = a.closest("tr").dataset.file;
    }
    // load XSL (if needed)
    const result = await win.loadXsl({
      obj: viewXml,
      key: "funTeaserXsl",
      xsl: "wortgeschichten-teaser.xsl",
    });
    if (!result) {
      return;
    }
    // extract summary (Kurz gefasst)
    const fileContent = xml.files[fileName];
    if (!fileContent) {
      shared.error(`Dateidaten für „${fileName}“ nicht gefunden`);
      return;
    }
    const doc = new DOMParser().parseFromString(fileContent, "text/xml");
    const xslt = new DOMParser().parseFromString(viewXml.funTeaserXsl, "application/xml");
    const processor = new XSLTProcessor();
    processor.importStylesheet(xslt);
    const processedDoc = processor.transformToDocument(doc);
    // collect tags
    const tags = [];
    doc.querySelectorAll("Wortgeschichte_kompakt *").forEach(i => {
      const name = i.nodeName;
      if (!tags.includes(name)) {
        tags.push(name);
      }
    });
    tags.sort(shared.sort);
    // display summary (Kurz gefasst)
    document.querySelector("#summary h1 span").textContent = fileName;
    document.querySelector("#summary p").innerHTML = processedDoc.querySelector("p").innerHTML;
    const code = document.querySelector("#summary code");
    code.replaceChildren();
    for (const i of tags) {
      if (code.hasChildNodes()) {
        code.appendChild(document.createTextNode(" "));
      }
      code.appendChild(document.createTextNode(`<${i}>`));
    }
    overlay.show("summary");
  },

  // open file in default editor
  //   a = node (clicked link)
  funOpen (a) {
    const tr = a.closest("tr");
    win.openEditor(tr.dataset.file);
  },
};
