// Frontend des lignes d'influence + charges mobiles HL-93.
// - calcul de la ligne d'influence (appel API)
// - balade interactive du véhicule de référence (camion / tandem) avec flèches
// - effet live (interpolation en JS) + balayage automatique (max, via API)

const $ = (id) => document.getElementById(id);
let chart = null;
let envChart = null;
let lastResult = null; // dernière ligne d'influence {x, y, meta}
let catalog = null; // catalogue HL-93 (GET /vehicles)

const LABELS = { R: "Réaction", M: "Moment", V: "Effort tranchant" };
const effectUnit = (q) => (q === "M" ? "kN·m" : "kN");

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
      ctx.fillText(`${a.load} kN`, px, top - 3);
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
    $("export").disabled = false;
    const m = data.meta;
    $("info").textContent =
      `${LABELS[m.quantity]} en x=${m.target_x} m · ${m.n_elements} éléments · ` +
      `${m.n_ddl} DDL · appuis: ${m.support_positions.join(", ")} m`;
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
          label: `LI ${m.quantity} (x=${m.target_x} m)`,
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
        x: { type: "linear", title: { display: true, text: "Portée x [m]" } },
        y: { title: { display: true, text: `LI ${m.quantity}(x)` } },
      },
      plugins: { legend: { position: "top" } },
    },
    plugins: [axleArrowPlugin],
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
    // placer le véhicule à la position la plus défavorable
    $("lead-pos").value = data.max.lead_pos;
    updateVehicle();
  } catch (e) {
    $("error").textContent = `Erreur : ${e.message}`;
  }
}

function showEnvelope(data) {
  const mx = data.max;
  const ro = $("max-readout");
  ro.hidden = false;
  ro.textContent =
    `Effet maximal : ${mx.value.toFixed(2)} ${data.unit}\n` +
    `Position de l'essieu de tête : ${mx.lead_pos.toFixed(2)} m\n` +
    `Essieux : ${mx.axle_positions
      .map((a) => `${a.load} kN @ ${a.x.toFixed(2)} m`)
      .join("  ·  ")}`;

  // graphe effet vs position
  $("envelope-panel").hidden = false;
  const pts = data.positions.map((p, i) => ({ x: p, y: data.effects[i] }));
  const cfg = {
    type: "line",
    data: {
      datasets: [
        {
          label: `Effet (${data.unit})`,
          data: pts,
          borderColor: "#059669",
          backgroundColor: "rgba(5,150,105,0.12)",
          fill: true,
          pointRadius: 0,
          tension: 0,
        },
        {
          label: "Maximum",
          data: [{ x: mx.lead_pos, y: mx.value }],
          borderColor: "#dc2626",
          backgroundColor: "#dc2626",
          showLine: false,
          pointRadius: 6,
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
          title: { display: true, text: "Position essieu de tête [m]" },
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
// Export CSV de la ligne d'influence
// --------------------------------------------------------------------------- //
function exportCsv() {
  if (!lastResult) return;
  const rows = ["x,y"];
  lastResult.x.forEach((xv, i) => rows.push(`${xv},${lastResult.y[i]}`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const m = lastResult.meta;
  a.href = url;
  a.download = `LI_${m.quantity}_x${m.target_x}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --------------------------------------------------------------------------- //
// Initialisation
// --------------------------------------------------------------------------- //
async function loadCatalog() {
  try {
    const resp = await fetch(`${apiBase()}/vehicles`);
    if (resp.ok) catalog = await resp.json();
  } catch (e) {
    // backend pas encore lancé : le catalogue sera rechargé au 1er calcul
  }
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!catalog) await loadCatalog();
  compute();
});
$("export").addEventListener("click", exportCsv);
$("vehicle").addEventListener("change", () => {
  toggleRearSpacing();
  updateVehicle();
});
$("rear-spacing").addEventListener("input", updateVehicle);
$("impact").addEventListener("change", updateVehicle);
$("lead-pos").addEventListener("input", updateVehicle);
$("sweep").addEventListener("click", sweep);

loadCatalog();
