import {
  buildReport,
  filterOptions,
  formatAmountList,
  statusLabel,
} from "./report.js";

const banner = document.querySelector("#source-banner");
const notice = document.querySelector("#status-notice");
const reportRoot = document.querySelector("#report");
const freshness = document.querySelector("#freshness");
const countrySelect = document.querySelector("#country");
const statusSelect = document.querySelector("#status");
const refreshButton = document.querySelector("#refresh");
const clearButton = document.querySelector("#clear");

let loaded = null;

function setNotice(message, kind) {
  if (!message) {
    notice.hidden = true;
    notice.textContent = "";
    notice.className = "notice";
    return;
  }
  notice.hidden = false;
  notice.textContent = message;
  notice.className = kind === "failure" ? "failure notice" : "notice";
}

function selectedFilters() {
  return {
    country: countrySelect.value,
    status: statusSelect.value,
  };
}

function fillSelect(select, values, allLabel) {
  const current = select.value;
  select.replaceChildren(new Option(allLabel, ""));
  for (const value of values) {
    const label = select === statusSelect ? statusLabel(value) : value;
    select.append(new Option(label, value));
  }
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function renderLoading() {
  reportRoot.innerHTML = '<p class="empty">Loading report…</p>';
}

function renderFailure(message) {
  freshness.textContent = "Not loaded";
  reportRoot.innerHTML = `<p class="failure">Could not load the report. ${message} No figures are shown.</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderReport() {
  const filters = selectedFilters();
  const report = buildReport(loaded.records, filters);
  const filteredEmpty = report.applications === 0;
  const sourceEmpty = loaded.records.length === 0;
  if (sourceEmpty) {
    reportRoot.innerHTML = '<p class="empty">No applicant records are in the current source.</p>';
    return;
  }
  if (filteredEmpty) {
    reportRoot.innerHTML = '<p class="empty">No records match these filters. Clear filters to restore the full report.</p>';
    return;
  }

  const statusRows = report.statuses
    .map(
      (row) => `<tr><td>${escapeHtml(statusLabel(row.status))}</td><td>${row.applicants}</td><td>${row.applications}</td></tr>`,
    )
    .join("");
  const countryRows = report.countries
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.country)}</td>
        <td>${row.applicants}</td>
        <td>${row.applications}</td>
        <td>${formatAmountList(row.requested)}</td>
        <td>${formatAmountList(row.provided)}</td>
        <td>${formatAmountList(row.toFund)}</td>
        <td>${row.unknownAmountApplications}</td>
      </tr>`,
    )
    .join("");

  reportRoot.innerHTML = `
    <div class="kpis">
      <article class="kpi"><span>Distinct applicants</span><strong>${report.applicants}</strong><small>${report.applications} applications</small></article>
      <article class="kpi"><span>Requested</span><strong>${formatAmountList(report.requested)}</strong><small>Known amounts only</small></article>
      <article class="kpi"><span>Provided</span><strong>${formatAmountList(report.provided)}</strong><small>Known amounts only</small></article>
      <article class="kpi"><span>Amount to be funded</span><strong>${formatAmountList(report.toFund)}</strong><small>${report.unknownAmountApplications} applications have an unknown amount</small></article>
    </div>
    <section class="panel">
      <h2>Funding status</h2>
      <table>
        <thead><tr><th>Status</th><th>Applicants</th><th>Applications</th></tr></thead>
        <tbody>${statusRows}</tbody>
      </table>
    </section>
    <section class="panel">
      <h2>Funding by country</h2>
      <table>
        <thead><tr><th>Country</th><th>Applicants</th><th>Applications</th><th>Requested</th><th>Provided</th><th>To be funded</th><th>Unknown amounts</th></tr></thead>
        <tbody>${countryRows}</tbody>
      </table>
      <p class="definitions">Applicant counts by country can exceed the distinct-applicant total when one applicant has applications in more than one country. Application counts reconcile with the total in scope.</p>
    </section>
  `;
}

function render() {
  if (!loaded) return;
  banner.hidden = false;
  banner.textContent = loaded.label;
  freshness.textContent = `Last refreshed ${loaded.refreshedAt.toLocaleString()}`;
  const options = filterOptions(loaded.records);
  fillSelect(countrySelect, options.countries, "All countries");
  fillSelect(statusSelect, options.statuses, "All statuses");
  renderReport();
}

async function loadReport() {
  const hadData = Boolean(loaded);
  if (!hadData) {
    setNotice("");
    renderLoading();
    freshness.textContent = "Loading…";
  }
  try {
    const response = await fetch(`data/applicants.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`The source returned ${response.status}.`);
    const body = await response.json();
    if (!Array.isArray(body.records)) throw new Error("The source has no records array.");
    loaded = {
      records: body.records,
      label: body.label || "Source loaded.",
      refreshedAt: new Date(),
    };
    setNotice("");
    render();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (loaded) {
      setNotice(`Refresh failed: ${message} The figures below were not refreshed.`);
      freshness.textContent = `Last refreshed ${loaded.refreshedAt.toLocaleString()} — refresh failed`;
    } else {
      setNotice("");
      renderFailure(message);
    }
  }
}

countrySelect.addEventListener("change", renderReport);
statusSelect.addEventListener("change", renderReport);
clearButton.addEventListener("click", () => {
  countrySelect.value = "";
  statusSelect.value = "";
  if (loaded) renderReport();
});
refreshButton.addEventListener("click", () => {
  refreshButton.disabled = true;
  loadReport().finally(() => {
    refreshButton.disabled = false;
  });
});

loadReport();
