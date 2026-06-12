// Frontend des lignes d'influence : saisie -> appel API -> tracé Chart.js.

const $ = (id) => document.getElementById(id);
let chart = null;
let lastResult = null;

const LABELS = { R: "Réaction", M: "Moment", V: "Effort tranchant" };

function parseList(text) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(Number);
}

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
  evt.preventDefault();
  $("error").textContent = "";
  $("info").textContent = "";
  let payload;
  try {
    payload = buildPayload();
  } catch (e) {
    $("error").textContent = e.message;
    return;
  }

  const base = $("api").value.replace(/\/+$/, "");
  try {
    const resp = await fetch(`${base}/influence-line`, {
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
    draw(data);
    $("export").disabled = false;
    const m = data.meta;
    $("info").textContent =
      `${LABELS[m.quantity]} en x=${m.target_x} m · ${m.n_elements} éléments · ` +
      `${m.n_ddl} DDL · appuis: ${m.support_positions.join(", ")} m`;
  } catch (e) {
    $("error").textContent = `Erreur : ${e.message}`;
  }
}

function draw(data) {
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
          pointRadius: 2,
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
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Portée x [m]" },
        },
        y: { title: { display: true, text: `LI ${m.quantity}(x)` } },
      },
      plugins: { legend: { position: "top" } },
    },
  };

  if (chart) chart.destroy();
  chart = new Chart($("chart"), cfg);
}

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

$("form").addEventListener("submit", compute);
$("export").addEventListener("click", exportCsv);
