"use strict";

const tooltip = {
  // tooltip timeout
  timeout: undefined,

  // skip timeout, show tooltip immediately
  noTimeout: false,

  // initialize tooltip
  //   basis = node | undefined
  init (basis = document) {
    basis.querySelectorAll("[title]").forEach(i => {
      i.dataset.tooltip = i.title;
      i.removeAttribute("title");
      i.addEventListener("mouseover", function () {
        clearTimeout(tooltip.timeout);
        const timeout = tooltip.noTimeout ? 0 : 500;
        tooltip.timeout = setTimeout(() => {
          tooltip.noTimeout = false;
          tooltip.on(this);
        }, timeout);
      });
      i.addEventListener("mouseout", () => tooltip.off());
    });
  },

  // show tooltip
  //   ele = node (on which the mouse hovers)
  on (ele) {
    let tip = document.querySelector("#tooltip");

    // create tooltip (if needed)
    if (!tip) {
      const div = document.createElement("div");
      div.id = "tooltip";
      tip = div;
      document.body.appendChild(div);
    }

    // Wide tooltip?
    if (ele.dataset.tooltip.length > 150) {
      tip.classList.add("wide");
    } else {
      tip.classList.remove("wide");
    }

    // fill tooltip
    tip.innerHTML = ele.dataset.tooltip;

    // position tooltip
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    const rect = ele.getBoundingClientRect();
    let top = rect.bottom + 5;
    if (top + height > window.innerHeight - 20) {
      top = rect.top - 5 - height;
    }
    tip.style.top = top + "px";
    let left = rect.left + Math.round(rect.width / 2) - Math.round(tip.offsetWidth / 2);
    if (ele.nodeName === "P") {
      ({ left } = rect);
    } else if (left + width > window.innerWidth - 10) {
      left = rect.right - width;
    } else if (left < 10) {
      ({ left } = rect);
    }
    tip.style.left = left + "px";
    tip.style.zIndex = ++overlay.zIndex;
    tip.classList.add("visible");
  },

  // Tooltip ausblenden
  off () {
    clearTimeout(tooltip.timeout);
    const tip = document.querySelector("#tooltip");
    if (!tip) {
      return;
    }
    tip.addEventListener("transitionend", function () {
      if (!this.parentNode) {
        return;
      }
      this.parentNode.removeChild(this);
    }, { once: true });
    tip.classList.remove("visible");
  },

  // insert titel for search help
  addLongHelp () {
    const help = {
      "clusters-preview-help-modulate": `
        <p>Bei der Berechnung der Cluster wird so getan, als wären die rot eingefärbten Verweise, die in der Modulierung zur Ergänzung vorgeschlagen werden, bereits gesetzt.</p>
        <p>Die Verweise werden mit einem Gewicht von 3 Punkten ergänzt, was der Punktzahl eines Verweises in den Wortinformationen entspricht.</p>
      `,
      "clusters-preview-help-type": `
        <p>Alle Verweise, die ein Typ-Attribut mit dem Wert „Cluster“ haben, werden für die Berechnung der Vorschau ignoriert.</p>
        <p>Mit dieser Option können Sie also bereits vorgenommene Modulierungen temporär zurücksetzen.</p>
      `,
      "prefs-help-data": `
        Die Einstellungen können exportiert werden, um sie auf einem anderen Rechner wieder zu importieren. Sie umfassen auch die in der Ansicht <i>Hinweise</i> gesetzten Markierungen. Vom Export ausgenommen sind die Git-Konfiguration und der Pfad zu den Zeitstrahldaten.
      `,
      "prefs-help-data-cache": `
        Beim Programmstart und immer dann, wenn Sie auf <i>Update</i> drücken, werden die XML-Dateien analysiert. Mit den dabei zusammengetragenen Daten arbeitet die App. Da das Erstellen der Daten sehr rechenintensiv ist, wird das Ergebnis in einem Cache gespeichert, den Sie mit dieser Funktion zurücksetzen können.
      `,
      "prefs-help-html-cache": `
        Die Dateien, die im Vorschaufenster von der Seite zdl.org heruntergeladen werden, werden in einem Cache gespeichert, um wiederholte Aufrufe zu beschleunigen. Sollte die Vorschauansicht fehlerhaft sein, bietet es sich an, diesen HTML-Cache zu leeren.
      `,
      "prefs-help-data-marks": `
        Mit dieser Funktion können Sie alle Markierungen löschen, die Sie in der Ansicht <i>Hinweise</i> vorgenommen haben.
      `,
      "prefs-help-data-zeitstrahl": `
        <p>Die Zeitstrahldaten werden für den Export der Datei Artikel.json (Funktionen&nbsp;&gt; Artikel.json), einer für die Webseite unverzichtbaren Datendatei, verwendet. Anders als die übrigen Inhalte können Zeitstrahldaten nicht von QS berechnet werden. Exportieren Sie die Datei ohne Zeitstrahldaten, kann auf der Webseite kein Zeitstrahl angezeigt werden.</p>
        <p>Die Zeitstrahldaten liegen auf dem Netzlaufwerk. Unter Windows wäre das <b>W:\\Software\\<wbr>Entwicklungsumgebung WGd\\<wbr>wgd.local\\<wbr>scr\\<wbr>Zeitstrahl\\<wbr>data\\<wbr>data.json</b>.</p>
      `,
      "prefs-help-data-zdl": `
        Wird der Pfad zum ZDL-Repository angegeben, kann dies die Benutzung der Funktionen <i>Publikation &gt; Artikelübersicht</i> und <i>Publikation &gt; Terminologie</i> erleichtern. Die App schlägt beim Exportieren der jeweiligen Dateien dann den korrekten Pfad vor.
      `,
      "search-help": `
        <p>Suchwörter sind durch <b>Leerzeichen</b> getrennt. Beim Suchen werden die einzelnen Wörter durch ein <b>logisches Und</b> miteinander verknüpft:<span class="example">alternative Fakten<br>= Suche nach „alternative“ UND „Fakten“.</span></p>
        <p>Taucht in einem Suchwort ein <b>Großbuchstabe</b> auf, wird bei der Suche für dieses Wort zwischen Groß- und Kleinschreibung unterschieden.</p>
        <p>Taucht im Suchausdruck eine <b>Spitzklammer</b> auf (&lt; oder &gt;), werden neben dem Text auch die Tags durchsucht.</p>
        <p>Als <b>Phrase</b> können mehrere Wörter mithilfe von nicht-typo\u00ADgraphi\u00ADschen Anführungs\u00ADzeichen gesucht werden:<span class="example">"alternative Fakten"<br>${"\u00A0".repeat(3)}oder<br>'alternative Fakten'<br>= Suche nach der Phrase „alternative Fakten“.</span></p>
        <p>Man kann auch mit <b>regulären Ausdrücken</b> suchen:<span class="example">/alternativen? fakt(en)?/i<br>= Phrasensuche, „alternativen“ mit oder ohne „n“, „fakt“ oder „fakten“, Groß- und Kleinschreibung irrelevant (wegen des optionalen i-Schalters hinter dem schließenden /).</span></p>
      `,
    };
    for (const [ id, title ] of Object.entries(help)) {
      const a = document.getElementById(id);
      a.title = title;
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        const [ section, id ] = this.getAttribute("href").substring(1).split("-");
        modules.ipc.invoke("help", {
          id,
          section,
        });
      });
      a.addEventListener("focus", function () {
        tooltip.noTimeout = true;
        this.dispatchEvent(new Event("mouseover"));
      });
      a.addEventListener("blur", function () {
        this.dispatchEvent(new Event("mouseout"));
      });
    }
  },
};
