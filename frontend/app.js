// Frontend des lignes d'influence + charges mobiles HL-93.
// - calcul de la ligne d'influence (appel API)
// - balade interactive du véhicule de référence (camion / tandem) avec flèches
// - effet live (interpolation en JS) + balayage automatique (max, via API)

const $ = (id) => document.getElementById(id);
let chart = null;
let envChart = null;
let distEnvChart = null; // graphe d'enveloppe de la charge répartie
let lastResult = null; // dernière ligne d'influence {x, y, meta}
let lastEnvelope = null; // dernière enveloppe de charge répartie (POST /distributed-envelope)
let catalog = null; // catalogue HL-93 (GET /vehicles)

const LABELS = { R: "Réaction", M: "Moment", V: "Effort tranchant" };

// Unités : aucun libellé n'est codé en dur. Le système choisi sélectionne les
// valeurs par défaut des champs ; les unités d'affichage viennent du catalogue
// (GET /vehicles?unit_system=...), donc identiques à celles du moteur.
const UNIT_DEFAULTS = {
  SI: {
    spans: "15, 10, 15", dx: "1", target_x: "0",
    force: "kN", length: "m", w_dc: "10", w_dw: "3",
  },
  US: {
    spans: "50, 30, 50", dx: "2.5", target_x: "0",
    force: "kip", length: "ft", w_dc: "1.0", w_dw: "0.3",
  },
};
const unitSystem = () => $("unit-system").value;
const forceUnit = () =>
  catalog ? catalog.force_unit : UNIT_DEFAULTS[unitSystem()].force;
const lengthUnit = () =>
  catalog ? catalog.length_unit : UNIT_DEFAULTS[unitSystem()].length;
const effectUnit = (q) =>
  q === "M" ? `${forceUnit()}·${lengthUnit()}` : forceUnit();

// --------------------------------------------------------------------------- //
// Utilitaires unités / parsing
// --------------------------------------------------------------------------- //
function parseList(text) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}

function apiBase() {
  return $("api").value.replace(/\/+$/, "");
}

// --------------------------------------------------------------------------- //
// Math charges mobiles (identique au moteur Python) — pour l'effet "live"
// --------------------------------------------------------------------------- //
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

function currentAxleLayout() {
  // Retourne [{offset, load}] selon le véhicule et l'espacement choisis.
  const v = $("vehicle").value;
  if (!catalog) return [];
  if (v === "tandem") {
    return catalog.tandem.axles.map((a) => ({ ...a }));
  }
  const a = catalog.truck.axles; // [front, mid(4.3), rear]
  const rear = Number($("rear-spacing").value);
  return [
    { offset: 0.0, load: a[0].load },
    { offset: a[1].offset, load: a[1].load },
    { offset: a[1].offset + rear, load: a[2].load },
  ];
}

function loadEffect(lead, axles, impact) {
  if (!lastResult) return 0;
  const { x, y } = lastResult;
  const L = x[x.length - 1];
  let total = 0;
  for (const ax of axles) {
    const pos = lead + ax.offset;
    if (pos < -1e-9 || pos > L + 1e-9) continue;
    total += ax.load * interp(x, y, pos);
  }
  return impact ? total * (1 + catalog.im) : total;
}

// --------------------------------------------------------------------------- //
// Math charge répartie (identique à engine/distributed_loads.integrate_il)
// effet = w · ∫η dx. sign 0 = toute la poutre ; +1 = ∫η⁺ ; -1 = ∫η⁻.
// --------------------------------------------------------------------------- //
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
      if (s0 > 0) { total += 0.5 * y0 * (xr - x0); raw.push([x0, xr]); }
      else { total += 0.5 * y1 * (x1 - xr); raw.push([xr, x1]); }
    }
  }
  if (sign === 0) return { integral: total, zones: [[x[0], x[x.length - 1]]] };
  const zones = [];
  for (const z of raw) {
    if (zones.length && Math.abs(z[0] - zones[zones.length - 1][1]) <= 1e-9) {
      zones[zones.length - 1][1] = z[1]; // fusion des intervalles jointifs
    } else {
      zones.push([z[0], z[1]]);
    }
  }
  return { integral: total, zones };
}

// --------------------------------------------------------------------------- //
// Plugin Chart.js : flèches des essieux sur la poutre
// --------------------------------------------------------------------------- //
const axleArrowPlugin = {
  id: "axleArrows",
  afterDraw(c) {
    const axles = c.$axles || [];
    if (!axles.length) return;
    const { ctx, chartArea, scales } = c;
    const yZero = scales.y.getPixelForValue(0);
    const top = chartArea.top + 14;
    ctx.save();
    ctx.strokeStyle = "#dc2626";
    ctx.fillStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const a of axles) {
      const px = scales.x.getPixelForValue(a.x);
      if (px < chartArea.left - 1 || px > chartArea.right + 1) continue;
      // tige verticale (du haut vers l'axe y=0)
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, yZero);
      ctx.stroke();
      // pointe de flèche vers le bas (charge descendante)
      ctx.beginPath();
      ctx.moveTo(px, yZero);
      ctx.lineTo(px - 5, yZero - 11);
      ctx.lineTo(px + 5, yZero - 11);
      ctx.closePath();
      ctx.fill();
      // étiquette de charge
      ctx.fillText(`${a.load} ${forceUnit()}`, px, top - 3);
    }
    ctx.restore();
  },
};

// --------------------------------------------------------------------------- //
// Plugin Chart.js : ombrage des zones chargées par la charge répartie
// chart.$loadedZones = [{ range: [x0, x1], color: "rgba(...)" }, ...]
// --------------------------------------------------------------------------- //
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

// --------------------------------------------------------------------------- //
// Calcul de la ligne d'influence
// --------------------------------------------------------------------------- //
function buildPayload() {
  const spans = parseList($("spans").value);
  if (spans.length === 0 || spans.some((v) => !(v > 0))) {
    throw new Error("Travées invalides : entrez des longueurs positives.");
  }
  const supportsRaw = $("supports").value.trim();
  const payload = {
    spans,
    quantity: $("quantity").value,
    target_x: Number($("target_x").value),
    dx: Number($("dx").value),
    unit_system: unitSystem(),
  };
  if (supportsRaw.length > 0) payload.supports = parseList(supportsRaw);
  return payload;
}

async function compute(evt) {
  if (evt) evt.preventDefault();
  $("error").textContent = "";
  $("info").textContent = "";
  let payload;
  try {
    payload = buildPayload();
  } catch (e) {
    $("error").textContent = e.message;
    return;
  }

  try {
    const resp = await fetch(`${apiBase()}/influence-line`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
      throw new Error(detail);
    }
    lastResult = data;
    drawInfluence(data);
    setupVehiclePanel(data);
    setupDistributedPanel(data);
    $("export").disabled = false;
    const m = data.meta;
    const lu = lengthUnit();
    $("info").textContent =
      `${LABELS[m.quantity]} en x=${m.target_x} ${lu} · ${m.n_elements} éléments · ` +
      `${m.n_ddl} DDL · appuis: ${m.support_positions.join(", ")} ${lu}`;
  } catch (e) {
    $("error").textContent = `Erreur : ${e.message}`;
  }
}

function drawInfluence(data) {
  const points = data.x.map((xv, i) => ({ x: xv, y: data.y[i] }));
  const supportPoints = data.meta.support_positions.map((sx) => ({
    x: sx,
    y: 0,
  }));
  const m = data.meta;

  const cfg = {
    type: "line",
    data: {
      datasets: [
        {
          label: `LI ${m.quantity} (x=${m.target_x} ${lengthUnit()})`,
          data: points,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.15)",
          fill: true,
          pointRadius: 1.5,
          tension: 0,
        },
        {
          label: "Appuis",
          data: supportPoints,
          borderColor: "#b91c1c",
          backgroundColor: "#b91c1c",
          showLine: false,
          pointStyle: "triangle",
          pointRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: `Portée x [${lengthUnit()}]` },
        },
        y: { title: { display: true, text: `LI ${m.quantity}(x)` } },
      },
      plugins: { legend: { position: "top" } },
    },
    plugins: [axleArrowPlugin, loadedZonesPlugin],
  };

  if (chart) chart.destroy();
  chart = new Chart($("chart"), cfg);
}

// --------------------------------------------------------------------------- //
// Panneau véhicule : configuration + interactions
// --------------------------------------------------------------------------- //
function setupVehiclePanel(data) {
  if (!catalog) return;
  $("vehicle-panel").hidden = false;
  const L = data.x[data.x.length - 1];
  const lead = $("lead-pos");
  lead.min = 0;
  lead.max = L;
  lead.step = Math.min(0.1, data.meta ? 0.1 : 0.1);
  if (Number(lead.value) > L) lead.value = 0;
  toggleRearSpacing();
  updateVehicle();
  // masquer l'ancien balayage (la LI a changé)
  $("max-readout").hidden = true;
  $("envelope-panel").hidden = true;
}

function toggleRearSpacing() {
  const isTruck = $("vehicle").value === "truck";
  $("rear-spacing-label").style.display = isTruck ? "flex" : "none";
}

function updateVehicle() {
  if (!lastResult) return;
  const lead = Number($("lead-pos").value);
  const impact = $("impact").checked;
  const axles = currentAxleLayout();
  $("lead-val").textContent = lead.toFixed(1);
  $("rear-spacing-val").textContent = Number($("rear-spacing").value).toFixed(1);

  // flèches : positions absolues des essieux sur la poutre
  const L = lastResult.x[lastResult.x.length - 1];
  const onBeam = axles
    .map((a) => ({ x: lead + a.offset, load: a.load }))
    .filter((a) => a.x >= -1e-9 && a.x <= L + 1e-9);
  if (chart) {
    chart.$axles = onBeam;
    chart.update("none");
  }

  // effet live
  const e = loadEffect(lead, axles, impact);
  const q = lastResult.meta.quantity;
  $("effect-val").textContent = `${e.toFixed(2)} ${effectUnit(q)}`;
}

async function sweep() {
  if (!lastResult) return;
  $("error").textContent = "";
  const payload = {
    ...buildPayload(),
    vehicle: $("vehicle").value,
    rear_spacing: Number($("rear-spacing").value),
    impact: $("impact").checked,
  };
  try {
    const resp = await fetch(`${apiBase()}/vehicle-envelope`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
      throw new Error(detail);
    }
    showEnvelope(data);
    // placer le véhicule à la position la plus défavorable (gouvernante)
    $("lead-pos").value = data.governing.lead_pos;
    updateVehicle();
  } catch (e) {
    $("error").textContent = `Erreur : ${e.message}`;
  }
}

function showEnvelope(data) {
  const mx = data.max;
  const mn = data.min;
  const u = data.unit;
  const lu = lengthUnit();
  const ro = $("max-readout");
  ro.hidden = false;
  ro.textContent =
    `Effet maximal : ${mx.value.toFixed(2)} ${u} ` +
    `(essieu de tête à ${mx.lead_pos.toFixed(2)} ${lu})\n` +
    `Effet minimal : ${mn.value.toFixed(2)} ${u} ` +
    `(essieu de tête à ${mn.lead_pos.toFixed(2)} ${lu})\n` +
    `Gouvernant : ${data.governing.value.toFixed(2)} ${u} ` +
    `à ${data.governing.lead_pos.toFixed(2)} ${lu}`;

  // graphe effet vs position
  $("envelope-panel").hidden = false;
  const pts = data.positions.map((p, i) => ({ x: p, y: data.effects[i] }));
  const cfg = {
    type: "line",
    data: {
      datasets: [
        {
          label: `Effet (${u})`,
          data: pts,
          borderColor: "#059669",
          backgroundColor: "rgba(5,150,105,0.12)",
          fill: true,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: `Max : ${mx.value.toFixed(1)} ${u}`,
          data: [{ x: mx.lead_pos, y: mx.value }],
          borderColor: "#dc2626",
          backgroundColor: "#dc2626",
          showLine: false,
          pointStyle: "triangle",
          pointRadius: 8,
        },
        {
          label: `Min : ${mn.value.toFixed(1)} ${u}`,
          data: [{ x: mn.lead_pos, y: mn.value }],
          borderColor: "#2563eb",
          backgroundColor: "#2563eb",
          showLine: false,
          pointStyle: "rectRot",
          pointRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: `Position essieu de tête [${lu}]` },
        },
        y: { title: { display: true, text: `Effet [${data.unit}]` } },
      },
      plugins: { legend: { position: "top" } },
    },
  };
  if (envChart) envChart.destroy();
  envChart = new Chart($("envelope-chart"), cfg);
}

// --------------------------------------------------------------------------- //
// Panneau charge répartie DC/DW : effet live + ombrage des zones chargées
// --------------------------------------------------------------------------- //
function setupDistributedPanel(data) {
  $("distributed-panel").hidden = false;
  $("dist-max-readout").hidden = true;
  $("dist-envelope-panel").hidden = true;
  $("dist-export").disabled = true;
  lastEnvelope = null;
  updateDistributed();
}

function setLoadedZones(zones) {
  if (chart) {
    chart.$loadedZones = zones;
    chart.update("none");
  }
}

function updateDistributed() {
  if (!lastResult) return;
  const wdc = Number($("w-dc").value) || 0;
  const wdw = Number($("w-dw").value) || 0;
  const w = wdc + wdw;
  const { x, y } = lastResult;
  const u = effectUnit(lastResult.meta.quantity);

  if ($("dist-view").value === "permanent") {
    const { integral, zones } = integrateIl(x, y, 0);
    const dc = wdc * integral, dw = wdw * integral, total = w * integral;
    $("dist-effect-val").textContent =
      `${total.toFixed(2)} ${u}  (DC ${dc.toFixed(1)} + DW ${dw.toFixed(1)}, toute la poutre)`;
    setLoadedZones(zones.map((r) => ({ range: r, color: "rgba(5,150,105,0.12)" })));
  } else {
    const pos = integrateIl(x, y, 1);
    const neg = integrateIl(x, y, -1);
    const maxT = w * pos.integral, minT = w * neg.integral;
    $("dist-effect-val").textContent =
      `max ${maxT.toFixed(2)} ${u}  ·  min ${minT.toFixed(2)} ${u}`;
    setLoadedZones([
      ...pos.zones.map((r) => ({ range: r, color: "rgba(5,150,105,0.16)" })),
      ...neg.zones.map((r) => ({ range: r, color: "rgba(220,38,38,0.12)" })),
    ]);
  }
}

async function distributedSweep() {
  if (!lastResult) return;
  $("error").textContent = "";
  const payload = {
    ...buildPayload(),
    w_dc: Number($("w-dc").value) || 0,
    w_dw: Number($("w-dw").value) || 0,
  };
  try {
    const resp = await fetch(`${apiBase()}/distributed-envelope`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : JSON.stringify(data.detail);
      throw new Error(detail);
    }
    lastEnvelope = data;
    showDistributedEnvelope(data);
    $("dist-export").disabled = false;
  } catch (e) {
    $("error").textContent = `Erreur : ${e.message}`;
  }
}

function showDistributedEnvelope(data) {
  const u = data.unit;
  const lu = lengthUnit();
  const g = data.governing;
  const worst = (pts) =>
    pts.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a));

  const ro = $("dist-max-readout");
  ro.hidden = false;
  const lines = [
    `Effet gouvernant : ${g.value.toFixed(2)} ${u} à x=${g.position.toFixed(2)} ${lu} ` +
      `(chargement ${g.sign > 0 ? "+" : "−"})`,
  ];
  if (data.midspan_points.length) {
    const m = worst(data.midspan_points);
    lines.push(
      `Effet max à mi-travée : ${m.value.toFixed(2)} ${u} (x=${m.position.toFixed(2)} ${lu})`
    );
  }
  if (data.support_points.length) {
    const s = worst(data.support_points);
    lines.push(
      `Effet max sur appui : ${s.value.toFixed(2)} ${u} (x=${s.position.toFixed(2)} ${lu})`
    );
  }
  ro.textContent = lines.join("\n");

  $("dist-envelope-panel").hidden = false;
  const series = (arr) => data.positions.map((p, i) => ({ x: p, y: arr[i] }));
  const pts = (list) => list.map((p) => ({ x: p.position, y: p.value }));
  const cfg = {
    type: "line",
    data: {
      datasets: [
        {
          label: `Enveloppe max (${u})`,
          data: series(data.max),
          borderColor: "#dc2626",
          backgroundColor: "rgba(220,38,38,0.10)",
          fill: false,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: `Enveloppe min (${u})`,
          data: series(data.min),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.10)",
          fill: false,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: `Permanent (${u})`,
          data: series(data.full),
          borderColor: "#6b7280",
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: "Max mi-travée",
          data: pts(data.midspan_points),
          borderColor: "#dc2626",
          backgroundColor: "#dc2626",
          showLine: false,
          pointStyle: "triangle",
          pointRadius: 7,
        },
        {
          label: "Max sur appui",
          data: pts(data.support_points),
          borderColor: "#2563eb",
          backgroundColor: "#2563eb",
          showLine: false,
          pointStyle: "rectRot",
          pointRadius: 7,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: `Position de la section x [${lu}]` },
        },
        y: { title: { display: true, text: `Effet [${u}]` } },
      },
      plugins: { legend: { position: "top" } },
    },
  };
  if (distEnvChart) distEnvChart.destroy();
  distEnvChart = new Chart($("dist-envelope-chart"), cfg);
}

function exportDistributedCsv() {
  if (!lastEnvelope) return;
  const d = lastEnvelope;
  const u = unitSystem();
  const lu = lengthUnit();
  const rows = [`x [${lu}],max [${d.unit}],min [${d.unit}],full [${d.unit}]`];
  d.positions.forEach((p, i) =>
    rows.push(`${p},${d.max[i]},${d.min[i]},${d.full[i]}`)
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ENV_${d.quantity}_${u}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------------------- //
// Export CSV de la ligne d'influence
// --------------------------------------------------------------------------- //
function exportCsv() {
  if (!lastResult) return;
  const u = unitSystem();
  const lu = lengthUnit();
  // En-tête avec unité : un CSV en ft ne doit pas être confondu avec un CSV en m.
  const rows = [`x [${lu}],y`];
  lastResult.x.forEach((xv, i) => rows.push(`${xv},${lastResult.y[i]}`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const m = lastResult.meta;
  a.href = url;
  a.download = `LI_${m.quantity}_x${m.target_x}_${u}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------------------- //
// Initialisation
// --------------------------------------------------------------------------- //
async function loadCatalog() {
  try {
    const resp = await fetch(
      `${apiBase()}/vehicles?unit_system=${encodeURIComponent(unitSystem())}`
    );
    if (resp.ok) catalog = await resp.json();
  } catch (e) {
    // backend pas encore lancé : le catalogue sera rechargé au 1er calcul
  }
  applyUnitLabels();
}

// Met à jour TOUS les libellés d'unité depuis le système courant / le catalogue.
// Aucune valeur d'unité n'est codée en dur ailleurs.
function applyUnitLabels() {
  const lu = lengthUnit();
  const fu = forceUnit();
  document.querySelectorAll(".ulen").forEach((el) => (el.textContent = lu));
  document.querySelectorAll(".uload").forEach((el) => (el.textContent = `${fu}/${lu}`));
  $("unit-hint").textContent =
    unitSystem() === "SI"
      ? "SI (longueurs en m, charges en kN)"
      : "US (longueurs en ft, charges en kip)";
  if (!catalog) return;
  const t = catalog.truck;
  const td = catalog.tandem;
  $("opt-truck").textContent =
    `Camion de calcul (${t.axles.map((a) => a.load).join(" / ")} ${fu})`;
  $("opt-tandem").textContent =
    `Tandem (${td.axles.map((a) => a.load).join(" / ")} ${fu})`;
  // Curseur d'espacement arrière : bornes du système courant.
  const rs = t.rear_spacing;
  const slider = $("rear-spacing");
  slider.min = rs.min;
  slider.max = rs.max;
  slider.step = unitSystem() === "SI" ? 0.1 : 0.5;
  if (Number(slider.value) < rs.min || Number(slider.value) > rs.max) {
    slider.value = rs.default;
  }
  $("rear-spacing-val").textContent = Number(slider.value).toFixed(1);
}

// Bascule SI <-> US : réinitialise les champs aux défauts de la nouvelle unité
// (PAS de conversion numérique : éviterait dx hors nœud), recharge le catalogue
// dans la nouvelle unité, puis relance un calcul propre.
async function onUnitSystemChange() {
  const d = UNIT_DEFAULTS[unitSystem()];
  $("spans").value = d.spans;
  $("dx").value = d.dx;
  $("target_x").value = d.target_x;
  $("supports").value = "";
  $("quantity").value = "R";
  $("w-dc").value = d.w_dc;
  $("w-dw").value = d.w_dw;
  catalog = null; // forcer le rechargement avec la nouvelle unité
  await loadCatalog();
  compute();
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!catalog) await loadCatalog();
  compute();
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
$("sweep").addEventListener("click", sweep);
$("w-dc").addEventListener("input", updateDistributed);
$("w-dw").addEventListener("input", updateDistributed);
$("dist-view").addEventListener("change", updateDistributed);
$("dist-sweep").addEventListener("click", distributedSweep);
$("dist-export").addEventListener("click", exportDistributedCsv);

loadCatalog();
