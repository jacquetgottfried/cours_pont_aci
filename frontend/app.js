// Frontend « Ponts à poutres » — lignes d'influence (poutre) + tablier (dalle).
//
// Un seul fichier, sans build : ouverture directe (file://), Chart.js via CDN.
// Tout est encapsulé dans une IIFE (aucune fuite globale). Organisation :
//   helpers DOM · constantes · état · unités · client API · maths (miroir moteur) ·
//   graphes (plugins + fabrique) · CSV · contrôleurs (poutre/véhicule/réparti/dalle) ·
//   unités & onglets · init.
(() => {
  "use strict";

  // ------------------------------------------------------------------------- //
  // 1. Helpers DOM
  // ------------------------------------------------------------------------- //
  const $ = (id) => document.getElementById(id);
  const val = (id) => $(id).value;
  const num = (id) => Number($(id).value);
  const isChecked = (id) => $(id).checked;
  const setText = (id, text) => {
    $(id).textContent = text;
  };
  const show = (id, on = true) => {
    $(id).hidden = !on;
  };
  const enable = (id, on = true) => {
    $(id).disabled = !on;
  };
  const parseList = (text) =>
    text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number);

  // ------------------------------------------------------------------------- //
  // 2. Constantes (couleurs, défauts par système, libellés)
  // ------------------------------------------------------------------------- //
  const COLORS = {
    line: "#2563eb",
    lineFill: "rgba(37,99,235,0.15)",
    support: "#b91c1c",
    axle: "#dc2626",
    max: "#dc2626",
    min: "#2563eb",
    full: "#6b7280",
    governing: "#b45309",
    effect: "#059669",
    effectFill: "rgba(5,150,105,0.12)",
    zonePos: "rgba(5,150,105,0.16)",
    zoneNeg: "rgba(220,38,38,0.12)",
    zoneNeutral: "rgba(5,150,105,0.12)",
  };

  // Le système choisi sélectionne les valeurs par défaut des champs (pas de
  // conversion numérique, cf. 05/D6). Les unités d'affichage viennent du catalogue.
  const UNIT_DEFAULTS = {
    SI: {
      spans: "15, 10, 15", dx: "1", target_x: "0",
      force: "kN", length: "m", w_dc: "10", w_dw: "3",
      rear: { min: 4.3, max: 9.0, default: 4.3, step: 0.1 },
    },
    US: {
      spans: "50, 30, 50", dx: "2.5", target_x: "0",
      force: "kip", length: "ft", w_dc: "1.0", w_dw: "0.3",
      rear: { min: 14.0, max: 30.0, default: 14.0, step: 0.5 },
    },
  };

  const DECK_DEFAULTS = {
    SI: { s: "2.4", oh: "1.0", dx: "0.1", wdc: "7.0", wdw: "1.2" },
    US: { s: "8", oh: "3.25", dx: "0.25", wdc: "0.15", wdw: "0.025" },
  };

  const LABELS = { R: "Réaction", M: "Moment", V: "Effort tranchant" };

  // ------------------------------------------------------------------------- //
  // 3. État applicatif
  // ------------------------------------------------------------------------- //
  const state = {
    result: null, // dernière ligne d'influence {x, y, meta}
    catalog: null, // catalogue HL-93 (GET /vehicles)
    deckCatalog: null, // roue de calcul du tablier (GET /deck-catalog)
    envM: null, // dernière enveloppe répartie de moment (M)
    envV: null, // dernière enveloppe répartie d'effort tranchant (V)
  };
  // Registre des graphes par identifiant de <canvas> : un seul graphe par canvas,
  // l'ancien est détruit automatiquement par `renderChart`.
  const charts = {};

  // ------------------------------------------------------------------------- //
  // 4. Unités (jamais codées en dur ; viennent du catalogue ou des défauts)
  // ------------------------------------------------------------------------- //
  const unitSystem = () => val("unit-system");
  const forceUnit = () =>
    state.catalog?.force_unit ?? UNIT_DEFAULTS[unitSystem()].force;
  const lengthUnit = () =>
    state.catalog?.length_unit ?? UNIT_DEFAULTS[unitSystem()].length;
  const effectUnit = (q) =>
    q === "M" ? `${forceUnit()}·${lengthUnit()}` : forceUnit();
  // Largeur de bande E : unité réglementaire (pouces US, mm SI), pas l'unité système.
  const stripUnit = () => (unitSystem() === "US" ? "in" : "mm");

  // ------------------------------------------------------------------------- //
  // 5. Client API (centralise fetch + extraction d'erreur)
  // ------------------------------------------------------------------------- //
  // Met en forme le `detail` d'une erreur HTTP : chaîne (400 métier) ou liste de
  // validations Pydantic (422). Évite d'afficher du JSON brut à l'utilisateur.
  function errorDetail(data) {
    const d = data && data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d.map((e) => e.msg || JSON.stringify(e)).join(" ; ");
    }
    return d ? JSON.stringify(d) : "erreur inconnue";
  }

  // Adresse de l'API (outil local) — fixe ; à changer ici si le backend change de port.
  const API_BASE = "http://127.0.0.1:8000";

  const api = {
    base: () => API_BASE,
    async get(path, params = {}) {
      const qs = new URLSearchParams(params).toString();
      const resp = await fetch(`${this.base()}${path}${qs ? `?${qs}` : ""}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(errorDetail(data));
      return data;
    },
    async postJSON(path, body) {
      const resp = await fetch(`${this.base()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(errorDetail(data));
      return data;
    },
  };

  // ------------------------------------------------------------------------- //
  // 6. Maths (identiques au moteur Python) — pour les effets « live »
  // ------------------------------------------------------------------------- //
  // Interpolation linéaire avec gestion du saut d'effort tranchant (x dédoublé) :
  // au point de coupure, on retient la valeur la plus défavorable (max |.|).
  function interp(x, y, q) {
    const n = x.length;
    if (q <= x[0]) return y[0];
    if (q >= x[n - 1]) return y[n - 1];
    let best = null;
    for (let i = 0; i < n - 1; i++) {
      const x0 = x[i], x1 = x[i + 1];
      if (x1 === x0) continue;
      if (x0 <= q && q <= x1) {
        const t = (q - x0) / (x1 - x0);
        const v = y[i] + t * (y[i + 1] - y[i]);
        if (best === null || Math.abs(v) > Math.abs(best)) best = v;
      }
    }
    return best === null ? 0 : best;
  }

  // Intégrale d'une ligne d'influence : effet = w · ∫η dx.
  // sign 0 = toute la poutre ; +1 = ∫η⁺ ; -1 = ∫η⁻. Renvoie l'intégrale et les zones.
  function integrateIl(x, y, sign) {
    let total = 0;
    const raw = [];
    for (let i = 0; i < x.length - 1; i++) {
      const x0 = x[i], x1 = x[i + 1];
      const dxs = x1 - x0;
      if (dxs <= 1e-9) continue; // segment dédoublé (saut d'effort tranchant)
      const y0 = y[i], y1 = y[i + 1];
      if (sign === 0) {
        total += 0.5 * (y0 + y1) * dxs;
        continue;
      }
      const s0 = sign * y0, s1 = sign * y1;
      if (s0 >= 0 && s1 >= 0) {
        const area = 0.5 * (y0 + y1) * dxs;
        total += area;
        if (Math.abs(area) > 1e-9) raw.push([x0, x1]);
      } else if (s0 <= 0 && s1 <= 0) {
        // rien du bon côté
      } else {
        const xr = x0 - (y0 * dxs) / (y1 - y0); // passage par zéro
        if (s0 > 0) {
          total += 0.5 * y0 * (xr - x0);
          raw.push([x0, xr]);
        } else {
          total += 0.5 * y1 * (x1 - xr);
          raw.push([xr, x1]);
        }
      }
    }
    if (sign === 0) {
      return { integral: total, zones: [[x[0], x[x.length - 1]]] };
    }
    const zones = [];
    for (const z of raw) {
      const last = zones[zones.length - 1];
      if (last && Math.abs(z[0] - last[1]) <= 1e-9) {
        last[1] = z[1]; // fusion des intervalles jointifs
      } else {
        zones.push([z[0], z[1]]);
      }
    }
    return { integral: total, zones };
  }

  // Disposition des essieux [{offset, load}] selon véhicule + espacement choisis.
  function currentAxleLayout() {
    if (!state.catalog) return [];
    if (val("vehicle") === "tandem") {
      return state.catalog.tandem.axles.map((a) => ({ ...a }));
    }
    const a = state.catalog.truck.axles; // [avant, milieu(4.3), arrière]
    const rear = num("rear-spacing");
    return [
      { offset: 0.0, load: a[0].load },
      { offset: a[1].offset, load: a[1].load },
      { offset: a[1].offset + rear, load: a[2].load },
    ];
  }

  // Effet d'un convoi sur la ligne d'influence courante : (1+IM)·Σ P·η(x).
  function loadEffect(lead, axles, impact) {
    if (!state.result) return 0;
    const { x, y } = state.result;
    const L = x[x.length - 1];
    let total = 0;
    for (const ax of axles) {
      const pos = lead + ax.offset;
      if (pos < -1e-9 || pos > L + 1e-9) continue;
      total += ax.load * interp(x, y, pos);
    }
    return impact ? total * (1 + state.catalog.im) : total;
  }

  // ------------------------------------------------------------------------- //
  // 7. Graphes : plugins Chart.js + fabrique
  // ------------------------------------------------------------------------- //
  // Flèches des essieux (charges descendantes) sur la poutre. chart.$axles = [{x,load}].
  const axleArrowPlugin = {
    id: "axleArrows",
    afterDraw(c) {
      const axles = c.$axles || [];
      if (!axles.length) return;
      const { ctx, chartArea, scales } = c;
      const yZero = scales.y.getPixelForValue(0);
      const top = chartArea.top + 14;
      ctx.save();
      ctx.strokeStyle = COLORS.axle;
      ctx.fillStyle = COLORS.axle;
      ctx.lineWidth = 2;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      for (const a of axles) {
        const px = scales.x.getPixelForValue(a.x);
        if (px < chartArea.left - 1 || px > chartArea.right + 1) continue;
        ctx.beginPath(); // tige verticale (du haut vers l'axe y=0)
        ctx.moveTo(px, top);
        ctx.lineTo(px, yZero);
        ctx.stroke();
        ctx.beginPath(); // pointe vers le bas
        ctx.moveTo(px, yZero);
        ctx.lineTo(px - 5, yZero - 11);
        ctx.lineTo(px + 5, yZero - 11);
        ctx.closePath();
        ctx.fill();
        ctx.fillText(`${a.load} ${forceUnit()}`, px, top - 3);
      }
      ctx.restore();
    },
  };

  // Ombrage des zones chargées. chart.$loadedZones = [{range:[x0,x1], color}].
  const loadedZonesPlugin = {
    id: "loadedZones",
    beforeDatasetsDraw(c) {
      const zones = c.$loadedZones || [];
      if (!zones.length) return;
      const { ctx, chartArea, scales } = c;
      ctx.save();
      for (const z of zones) {
        const a = scales.x.getPixelForValue(z.range[0]);
        const b = scales.x.getPixelForValue(z.range[1]);
        ctx.fillStyle = z.color;
        ctx.fillRect(a, chartArea.top, b - a, chartArea.bottom - chartArea.top);
      }
      ctx.restore();
    },
  };

  const toPoints = (xs, ys) => xs.map((x, i) => ({ x, y: ys[i] }));

  // Série « courbe ». fillColor n'est utilisé que si fill est vrai.
  function lineSeries(label, data, opts = {}) {
    const { color, fill = false, fillColor, dash, pointRadius = 0 } = opts;
    const ds = {
      label,
      data,
      borderColor: color,
      backgroundColor: fillColor || color,
      fill,
      pointRadius,
      tension: 0,
    };
    if (dash) ds.borderDash = dash;
    return ds;
  }

  // Série « marqueurs » (points seuls, sans ligne).
  function markerSeries(label, data, { color, style, radius = 8 }) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      showLine: false,
      pointStyle: style,
      pointRadius: radius,
    };
  }

  // Fabrique un graphe linéaire (détruit l'ancien graphe du même canvas).
  function renderChart(canvasId, datasets, opts = {}) {
    const { xLabel, yLabel, plugins = [] } = opts;
    charts[canvasId]?.destroy();
    charts[canvasId] = new Chart($(canvasId), {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { type: "linear", title: { display: true, text: xLabel } },
          y: { title: { display: true, text: yLabel } },
        },
        plugins: { legend: { position: "top" } },
      },
      plugins,
    });
    return charts[canvasId];
  }

  // ------------------------------------------------------------------------- //
  // 8. Export CSV
  // ------------------------------------------------------------------------- //
  function downloadCsv(filename, rows) {
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ------------------------------------------------------------------------- //
  // 9. Poutre longitudinale : ligne d'influence
  // ------------------------------------------------------------------------- //
  function buildPayload() {
    const spans = parseList(val("spans"));
    if (spans.length === 0 || spans.some((v) => !(v > 0))) {
      throw new Error("Travées invalides : entrez des longueurs positives.");
    }
    const payload = {
      spans,
      quantity: val("quantity"),
      target_x: num("target_x"),
      dx: num("dx"),
      unit_system: unitSystem(),
    };
    const supportsRaw = val("supports").trim();
    if (supportsRaw.length > 0) payload.supports = parseList(supportsRaw);
    return payload;
  }

  async function computeBeam(evt) {
    if (evt) evt.preventDefault();
    setText("error", "");
    setText("info", "");
    let payload;
    try {
      payload = buildPayload();
    } catch (e) {
      setText("error", e.message);
      return;
    }
    try {
      const data = await api.postJSON("/influence-line", payload);
      state.result = data;
      drawInfluence(data);
      setupVehiclePanel(data);
      setupDistributedPanel();
      enable("export", true);
      const m = data.meta;
      const lu = lengthUnit();
      setText(
        "info",
        `${LABELS[m.quantity]} en x=${m.target_x} ${lu} · ${m.n_elements} éléments · ` +
          `${m.n_ddl} DDL · appuis: ${m.support_positions.join(", ")} ${lu}`
      );
    } catch (e) {
      setText("error", `Erreur : ${e.message}`);
    }
  }

  function drawInfluence(data) {
    const m = data.meta;
    const lu = lengthUnit();
    const supports = m.support_positions.map((sx) => ({ x: sx, y: 0 }));
    renderChart(
      "chart",
      [
        lineSeries(`LI ${m.quantity} (x=${m.target_x} ${lu})`, toPoints(data.x, data.y), {
          color: COLORS.line,
          fill: true,
          fillColor: COLORS.lineFill,
          pointRadius: 1.5,
        }),
        markerSeries("Appuis", supports, {
          color: COLORS.support,
          style: "triangle",
          radius: 8,
        }),
      ],
      {
        xLabel: `Portée x [${lu}]`,
        yLabel: `LI ${m.quantity}(x)`,
        plugins: [axleArrowPlugin, loadedZonesPlugin],
      }
    );
  }

  // ------------------------------------------------------------------------- //
  // 10. Charges mobiles HL-93 : configuration + interactions
  // ------------------------------------------------------------------------- //
  function setupVehiclePanel(data) {
    if (!state.catalog) return;
    show("vehicle-panel", true);
    const L = data.x[data.x.length - 1];
    const lead = $("lead-pos");
    lead.min = 0;
    lead.max = L;
    lead.step = 0.1;
    if (Number(lead.value) > L) lead.value = 0;
    toggleRearSpacing();
    updateVehicle();
    show("max-readout", false); // la LI a changé : ancien balayage masqué
    show("envelope-panel", false);
  }

  function toggleRearSpacing() {
    $("rear-spacing-label").style.display =
      val("vehicle") === "truck" ? "flex" : "none";
  }

  function updateVehicle() {
    if (!state.result) return;
    const lead = num("lead-pos");
    const axles = currentAxleLayout();
    setText("lead-val", lead.toFixed(1));
    setText("rear-spacing-val", num("rear-spacing").toFixed(1));

    // Flèches : positions absolues des essieux présents sur la poutre.
    const L = state.result.x[state.result.x.length - 1];
    const onBeam = axles
      .map((a) => ({ x: lead + a.offset, load: a.load }))
      .filter((a) => a.x >= -1e-9 && a.x <= L + 1e-9);
    const c = charts.chart;
    if (c) {
      c.$axles = onBeam;
      c.update("none");
    }

    const e = loadEffect(lead, axles, isChecked("impact"));
    setText("effect-val", `${e.toFixed(2)} ${effectUnit(state.result.meta.quantity)}`);
  }

  async function sweepVehicle() {
    if (!state.result) return;
    setText("error", "");
    try {
      const data = await api.postJSON("/vehicle-envelope", {
        ...buildPayload(),
        vehicle: val("vehicle"),
        rear_spacing: num("rear-spacing"),
        impact: isChecked("impact"),
      });
      showEnvelope(data);
      // placer le véhicule à la position la plus défavorable (gouvernante)
      $("lead-pos").value = data.governing.lead_pos;
      updateVehicle();
    } catch (e) {
      setText("error", `Erreur : ${e.message}`);
    }
  }

  function showEnvelope(data) {
    const { max: mx, min: mn, unit: u } = data;
    const lu = lengthUnit();
    show("max-readout", true);
    setText(
      "max-readout",
      `Effet maximal : ${mx.value.toFixed(2)} ${u} ` +
        `(essieu de tête à ${mx.lead_pos.toFixed(2)} ${lu})\n` +
        `Effet minimal : ${mn.value.toFixed(2)} ${u} ` +
        `(essieu de tête à ${mn.lead_pos.toFixed(2)} ${lu})\n` +
        `Gouvernant : ${data.governing.value.toFixed(2)} ${u} ` +
        `à ${data.governing.lead_pos.toFixed(2)} ${lu}`
    );

    show("envelope-panel", true);
    renderChart(
      "envelope-chart",
      [
        lineSeries(`Effet (${u})`, toPoints(data.positions, data.effects), {
          color: COLORS.effect,
          fill: true,
          fillColor: COLORS.effectFill,
        }),
        markerSeries(`Max : ${mx.value.toFixed(1)} ${u}`, [{ x: mx.lead_pos, y: mx.value }], {
          color: COLORS.max,
          style: "triangle",
          radius: 8,
        }),
        markerSeries(`Min : ${mn.value.toFixed(1)} ${u}`, [{ x: mn.lead_pos, y: mn.value }], {
          color: COLORS.min,
          style: "rectRot",
          radius: 8,
        }),
      ],
      { xLabel: `Position essieu de tête [${lu}]`, yLabel: `Effet [${u}]` }
    );
  }

  // ------------------------------------------------------------------------- //
  // 11. Charges réparties DC/DW : effet live + enveloppes M & V
  // ------------------------------------------------------------------------- //
  function setupDistributedPanel() {
    show("distributed-panel", true);
    show("dist-max-readout", false);
    show("dist-envelope-panel", false);
    show("dist-shear-panel", false);
    enable("dist-export", false);
    state.envM = null;
    state.envV = null;
    updateDistributed();
  }

  function setLoadedZones(zones) {
    const c = charts.chart;
    if (c) {
      c.$loadedZones = zones;
      c.update("none");
    }
  }

  function updateDistributed() {
    if (!state.result) return;
    const wdc = num("w-dc") || 0;
    const wdw = num("w-dw") || 0;
    const w = wdc + wdw;
    const { x, y } = state.result;
    const u = effectUnit(state.result.meta.quantity);

    if (val("dist-view") === "permanent") {
      const { integral, zones } = integrateIl(x, y, 0);
      const dc = wdc * integral, dw = wdw * integral, total = w * integral;
      setText(
        "dist-effect-val",
        `${total.toFixed(2)} ${u}  (DC ${dc.toFixed(1)} + DW ${dw.toFixed(1)}, toute la poutre)`
      );
      setLoadedZones(zones.map((r) => ({ range: r, color: COLORS.zoneNeutral })));
    } else {
      const pos = integrateIl(x, y, 1);
      const neg = integrateIl(x, y, -1);
      setText(
        "dist-effect-val",
        `max ${(w * pos.integral).toFixed(2)} ${u}  ·  min ${(w * neg.integral).toFixed(2)} ${u}`
      );
      setLoadedZones([
        ...pos.zones.map((r) => ({ range: r, color: COLORS.zonePos })),
        ...neg.zones.map((r) => ({ range: r, color: COLORS.zoneNeg })),
      ]);
    }
  }

  const fetchDistributedEnvelope = (quantity) =>
    api.postJSON("/distributed-envelope", {
      ...buildPayload(),
      quantity, // l'enveloppe répartie est indépendante de la grandeur affichée
      w_dc: num("w-dc") || 0,
      w_dw: num("w-dw") || 0,
    });

  async function distributedSweep() {
    if (!state.result) return;
    setText("error", "");
    try {
      // Enveloppes de dimensionnement : moment fléchissant (M) ET effort tranchant (V).
      const [mData, vData] = await Promise.all([
        fetchDistributedEnvelope("M"),
        fetchDistributedEnvelope("V"),
      ]);
      state.envM = mData;
      state.envV = vData;
      showDistributedEnvelopes(mData, vData);
      enable("dist-export", true);
    } catch (e) {
      setText("error", `Erreur : ${e.message}`);
    }
  }

  function showDistributedEnvelopes(mData, vData) {
    const lu = lengthUnit();
    const worst = (pts) =>
      pts.length
        ? pts.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a))
        : null;
    const govLine = (name, d) => {
      const g = d.governing;
      return (
        `${name} — gouvernant : ${g.value.toFixed(2)} ${d.unit} ` +
        `à x=${g.position.toFixed(2)} ${lu} (chargement ${g.sign > 0 ? "+" : "−"})`
      );
    };

    // Synthèse texte : moment (mi-travée / appui) + effort tranchant.
    const lines = [govLine("Moment fléchissant", mData)];
    const mmid = worst(mData.midspan_points);
    const msup = worst(mData.support_points);
    if (mmid) {
      lines.push(
        `  · max à mi-travée : ${mmid.value.toFixed(2)} ${mData.unit} ` +
          `(x=${mmid.position.toFixed(2)} ${lu})`
      );
    }
    if (msup) {
      lines.push(
        `  · max sur appui : ${msup.value.toFixed(2)} ${mData.unit} ` +
          `(x=${msup.position.toFixed(2)} ${lu})`
      );
    }
    lines.push(govLine("Effort tranchant", vData));
    show("dist-max-readout", true);
    setText("dist-max-readout", lines.join("\n"));

    // Deux graphes : moment (marqueurs mi-travée/appui) et effort tranchant (gouvernant).
    show("dist-envelope-panel", true);
    show("dist-shear-panel", true);
    drawEnvelopeChart("dist-envelope-chart", mData, "moment");
    drawEnvelopeChart("dist-shear-chart", vData, "shear");
  }

  function drawEnvelopeChart(canvasId, data, kind) {
    const u = data.unit;
    const lu = lengthUnit();
    const series = (arr) => toPoints(data.positions, arr);
    const points = (list) => list.map((p) => ({ x: p.position, y: p.value }));
    const datasets = [
      lineSeries(`Enveloppe max (${u})`, series(data.max), { color: COLORS.max }),
      lineSeries(`Enveloppe min (${u})`, series(data.min), { color: COLORS.min }),
      lineSeries(`Permanent (${u})`, series(data.full), { color: COLORS.full, dash: [6, 4] }),
    ];
    if (kind === "moment") {
      datasets.push(
        markerSeries("Max mi-travée", points(data.midspan_points), {
          color: COLORS.max,
          style: "triangle",
          radius: 7,
        }),
        markerSeries("Max sur appui", points(data.support_points), {
          color: COLORS.min,
          style: "rectRot",
          radius: 7,
        })
      );
    } else {
      // effort tranchant : on marque le point gouvernant (souvent près d'un appui).
      datasets.push(
        markerSeries("Gouvernant", [{ x: data.governing.position, y: data.governing.value }], {
          color: COLORS.governing,
          style: "star",
          radius: 9,
        })
      );
    }
    renderChart(canvasId, datasets, {
      xLabel: `Position de la section x [${lu}]`,
      yLabel: `Effet [${u}]`,
    });
  }

  function exportDistributedCsv() {
    const m = state.envM;
    const v = state.envV;
    if (!m || !v) return;
    const lu = lengthUnit();
    // M et V partagent les mêmes sections : un seul CSV avec les deux enveloppes.
    const rows = [
      `x [${lu}],M_max [${m.unit}],M_min [${m.unit}],M_full [${m.unit}],` +
        `V_max [${v.unit}],V_min [${v.unit}],V_full [${v.unit}]`,
      ...m.positions.map(
        (p, i) =>
          `${p},${m.max[i]},${m.min[i]},${m.full[i]},${v.max[i]},${v.min[i]},${v.full[i]}`
      ),
    ];
    downloadCsv(`ENV_DC_DW_${unitSystem()}.csv`, rows);
  }

  function exportCsv() {
    if (!state.result) return;
    const lu = lengthUnit();
    const m = state.result.meta;
    // En-tête avec unité : un CSV en ft ne doit pas être confondu avec un CSV en m.
    const rows = [
      `x [${lu}],y`,
      ...state.result.x.map((xv, i) => `${xv},${state.result.y[i]}`),
    ];
    downloadCsv(`LI_${m.quantity}_x${m.target_x}_${unitSystem()}.csv`, rows);
  }

  // ------------------------------------------------------------------------- //
  // 12. Tablier (dalle) : méthode de la bande équivalente (AASHTO)
  // ------------------------------------------------------------------------- //
  async function loadDeckCatalog() {
    try {
      state.deckCatalog = await api.get("/deck-catalog", { unit_system: unitSystem() });
    } catch (e) {
      // backend pas lancé : rechargé au 1er calcul
    }
    applyDeckLabels();
  }

  function applyDeckLabels() {
    const c = state.deckCatalog;
    if (!c) return;
    setText(
      "deck-wheel-info",
      `Roue de calcul : P = ${c.P} ${c.force_unit} · gage = ${c.gage} ${c.length_unit}` +
        ` · recul au bord ${c.edge_offset} ${c.length_unit}`
    );
  }

  async function computeDeck(evt) {
    if (evt) evt.preventDefault();
    setText("deck-error", "");
    try {
      const data = await api.postJSON("/deck-design", {
        n_girders: num("deck-n"),
        spacing: num("deck-s"),
        overhang: num("deck-oh"),
        dx: num("deck-dx"),
        w_dc: num("deck-wdc") || 0,
        w_dw: num("deck-wdw") || 0,
        gamma_dc: num("deck-gdc"),
        gamma_dw: num("deck-gdw"),
        gamma_ll: num("deck-gll"),
        mpf: num("deck-mpf"),
        impact: isChecked("deck-im"),
        unit_system: unitSystem(),
      });
      renderDeckTable(data);
      drawDeckIL("deck-il-pos", "deck-il-pos-panel", data.influence_lines.positive, "moment positif");
      drawDeckIL("deck-il-neg", "deck-il-neg-panel", data.influence_lines.negative, "moment négatif");
    } catch (e) {
      setText("deck-error", `Erreur : ${e.message}`);
    }
  }

  function renderDeckTable(data) {
    const s = data.sections;
    const ue = data.unit_line; // kN·m/m | kip·ft/ft
    const su = stripUnit(); // in | mm
    const f = (v) => v.toFixed(2);
    const rows = [
      ["Positif (mi-baie)", s.positive],
      ["Négatif (sur longeron)", s.negative],
      ["Porte-à-faux", s.overhang],
    ];
    const head =
      `<thead><tr><th>Section</th><th>M<sub>DC</sub> (${ue})</th>` +
      `<th>M<sub>DW</sub> (${ue})</th><th>M<sub>LL+IM</sub> (${ue})</th>` +
      `<th>E (${su})</th><th>M<sub>u</sub> (${ue})</th></tr></thead>`;
    const body = rows
      .map(
        ([label, sec]) =>
          `<tr><td>${label}</td><td>${f(sec.M_DC)}</td><td>${f(sec.M_DW)}</td>` +
          `<td>${f(sec.M_LL)}</td><td>${f(sec.E)}</td>` +
          `<td class="mu">${f(sec.Mu)}</td></tr>`
      )
      .join("");
    $("deck-table").innerHTML = `${head}<tbody>${body}</tbody>`;
    show("deck-results-panel", true);

    const oh = s.overhang;
    const lu = lengthUnit();
    setText(
      "deck-overhang-note",
      `Porte-à-faux : console isostatique (sans ligne d'influence). ` +
        `M_bande = ${oh.M_strip.toFixed(2)} ${data.unit_effort} ` +
        `(roue à X = ${oh.X.toFixed(2)} ${lu}, E = ${oh.E.toFixed(1)} ${su}).`
    );
  }

  function drawDeckIL(canvasId, panelId, il, label) {
    show(panelId, true);
    const lu = lengthUnit();
    const supports = il.support_positions.map((sx) => ({ x: sx, y: 0 }));
    const c = renderChart(
      canvasId,
      [
        lineSeries(`LI ${label}`, toPoints(il.x, il.y), {
          color: COLORS.line,
          fill: true,
          fillColor: COLORS.lineFill,
        }),
        markerSeries("Longerons", supports, {
          color: COLORS.support,
          style: "triangle",
          radius: 8,
        }),
      ],
      {
        xLabel: `Position transversale [${lu}]`,
        yLabel: "LI M(x)",
        plugins: [axleArrowPlugin, loadedZonesPlugin],
      }
    );
    c.$axles = il.wheels; // roues placées au cas gouvernant
    c.$loadedZones = il.dead_zones.map((r) => ({ range: r, color: COLORS.zoneNeutral }));
    c.update("none");
  }

  // ------------------------------------------------------------------------- //
  // 13. Unités (catalogue, libellés, bornes) & onglets
  // ------------------------------------------------------------------------- //
  async function loadCatalog() {
    try {
      state.catalog = await api.get("/vehicles", { unit_system: unitSystem() });
    } catch (e) {
      // backend pas encore lancé : le catalogue sera rechargé au 1er calcul
    }
    applyUnitLabels();
  }

  // Met à jour TOUS les libellés d'unité depuis le système courant / le catalogue.
  function applyUnitLabels() {
    const lu = lengthUnit();
    const fu = forceUnit();
    document.querySelectorAll(".ulen").forEach((el) => (el.textContent = lu));
    document.querySelectorAll(".uload").forEach((el) => (el.textContent = `${fu}/${lu}`));
    const c = state.catalog;
    if (!c) return;
    setText("opt-truck", `Camion de calcul (${c.truck.axles.map((a) => a.load).join(" / ")} ${fu})`);
    setText("opt-tandem", `Tandem (${c.tandem.axles.map((a) => a.load).join(" / ")} ${fu})`);
    // Curseur d'espacement arrière : bornes officielles du catalogue (système courant).
    resetRearSpacing(c.truck.rear_spacing);
  }

  // Réinitialise le curseur d'espacement arrière aux bornes du système courant.
  // Bornes de secours (UNIT_DEFAULTS) pour ne JAMAIS envoyer une valeur SI en US,
  // même si le catalogue n'a pas pu être chargé.
  function resetRearSpacing(bounds) {
    const b = bounds || UNIT_DEFAULTS[unitSystem()].rear;
    const slider = $("rear-spacing");
    slider.min = b.min;
    slider.max = b.max;
    slider.step = b.step ?? (unitSystem() === "SI" ? 0.1 : 0.5);
    if (Number(slider.value) < b.min || Number(slider.value) > b.max) {
      slider.value = b.default;
    }
    setText("rear-spacing-val", Number(slider.value).toFixed(1));
  }

  // Bascule SI <-> US : réinitialise les champs aux défauts (PAS de conversion
  // numérique, cf. 05/D6), recharge les catalogues, puis relance un calcul propre.
  async function onUnitSystemChange() {
    const d = UNIT_DEFAULTS[unitSystem()];
    $("spans").value = d.spans;
    $("dx").value = d.dx;
    $("target_x").value = d.target_x;
    $("supports").value = "";
    $("quantity").value = "R";
    $("w-dc").value = d.w_dc;
    $("w-dw").value = d.w_dw;
    // Espacement arrière : reset immédiat aux bornes du système (secours si le
    // catalogue ne se charge pas), affiné ensuite par applyUnitLabels.
    resetRearSpacing();
    // Dalle : réinitialiser aussi aux défauts du système.
    const dd = DECK_DEFAULTS[unitSystem()];
    $("deck-s").value = dd.s;
    $("deck-oh").value = dd.oh;
    $("deck-dx").value = dd.dx;
    $("deck-wdc").value = dd.wdc;
    $("deck-wdw").value = dd.wdw;
    state.catalog = null;
    state.deckCatalog = null;
    await loadCatalog();
    await loadDeckCatalog();
    computeBeam();
  }

  function activateTab(name) {
    document.querySelectorAll(".tab").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === name)
    );
    document.querySelectorAll(".tabpane").forEach((p) => {
      const on = p.id === `tab-${name}`;
      p.classList.toggle("active", on);
      p.hidden = !on;
    });
    if (name === "dalle" && !state.deckCatalog) loadDeckCatalog();
  }

  // ------------------------------------------------------------------------- //
  // 14. Initialisation : câblage des écouteurs + 1er chargement du catalogue
  // ------------------------------------------------------------------------- //
  function wireEvents() {
    $("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.catalog) await loadCatalog();
      computeBeam();
    });
    $("export").addEventListener("click", exportCsv);
    $("unit-system").addEventListener("change", onUnitSystemChange);
    $("vehicle").addEventListener("change", () => {
      toggleRearSpacing();
      updateVehicle();
    });
    $("rear-spacing").addEventListener("input", updateVehicle);
    $("impact").addEventListener("change", updateVehicle);
    $("lead-pos").addEventListener("input", updateVehicle);
    $("sweep").addEventListener("click", sweepVehicle);
    $("w-dc").addEventListener("input", updateDistributed);
    $("w-dw").addEventListener("input", updateDistributed);
    $("dist-view").addEventListener("change", updateDistributed);
    $("dist-sweep").addEventListener("click", distributedSweep);
    $("dist-export").addEventListener("click", exportDistributedCsv);
    $("deck-form").addEventListener("submit", computeDeck);
    document.querySelectorAll(".tab").forEach((b) =>
      b.addEventListener("click", () => activateTab(b.dataset.tab))
    );
  }

  function init() {
    wireEvents();
    loadCatalog();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
