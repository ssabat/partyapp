const COMMITTED_STATUSES = new Set(["approved", "partially_funded"]);

export const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  partially_funded: "Partially funded",
  funded: "Funded",
  declined: "Declined",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function countryOf(record) {
  const value = record && record.country;
  if (value == null || String(value).trim() === "") return "Unknown";
  return String(value).trim();
}

export function statusOf(record) {
  const value = record && record.fundingStatus;
  if (value == null || String(value).trim() === "") return "Unknown";
  return String(value).trim();
}

export function currencyOf(record) {
  const value = record && record.currency;
  if (value == null || String(value).trim() === "") return "Unknown currency";
  return String(value).trim();
}

function isAmount(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function addAmount(map, currency, amount) {
  map.set(currency, (map.get(currency) || 0) + amount);
}

function amountsOf(map) {
  return [...map.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function formatAmount(amount, currency) {
  if (!isAmount(amount)) return "Unknown";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

export function formatAmountList(amounts) {
  if (!amounts || amounts.length === 0) return "None in scope";
  return amounts.map((entry) => formatAmount(entry.amount, entry.currency)).join(" · ");
}

export function filterOptions(records) {
  const list = Array.isArray(records) ? records : [];
  const countries = new Set();
  const statuses = new Set();
  for (const record of list) {
    countries.add(countryOf(record));
    statuses.add(statusOf(record));
  }
  return {
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
  };
}

export function buildReport(records, filters = {}) {
  const list = Array.isArray(records) ? records : [];
  const countryFilter = filters.country ? String(filters.country) : "";
  const statusFilter = filters.status ? String(filters.status) : "";
  const filtered = list.filter((record) => {
    if (countryFilter && countryOf(record) !== countryFilter) return false;
    if (statusFilter && statusOf(record) !== statusFilter) return false;
    return true;
  });

  const applicants = new Set();
  const statusApplications = new Map();
  const statusApplicants = new Map();
  const requested = new Map();
  const provided = new Map();
  const toFund = new Map();
  const countries = new Map();
  let unknownAmountApplications = 0;

  for (const record of filtered) {
    const applicantId = String(record.applicantId || "").trim() || "Unknown applicant";
    const status = statusOf(record);
    const country = countryOf(record);
    const currency = currencyOf(record);
    const requestedKnown = isAmount(record.requestedAmount);
    const providedKnown = isAmount(record.providedAmount);
    applicants.add(applicantId);

    statusApplications.set(status, (statusApplications.get(status) || 0) + 1);
    if (!statusApplicants.has(status)) statusApplicants.set(status, new Set());
    statusApplicants.get(status).add(applicantId);

    if (!requestedKnown || !providedKnown) unknownAmountApplications += 1;
    if (requestedKnown) addAmount(requested, currency, record.requestedAmount);
    if (providedKnown) addAmount(provided, currency, record.providedAmount);

    let remaining = null;
    if (requestedKnown && providedKnown && COMMITTED_STATUSES.has(status)) {
      remaining = record.requestedAmount - record.providedAmount;
      if (remaining > 0) addAmount(toFund, currency, remaining);
    }

    if (!countries.has(country)) {
      countries.set(country, {
        country,
        applicants: new Set(),
        applications: 0,
        requested: new Map(),
        provided: new Map(),
        toFund: new Map(),
        unknownAmountApplications: 0,
      });
    }
    const bucket = countries.get(country);
    bucket.applicants.add(applicantId);
    bucket.applications += 1;
    if (!requestedKnown || !providedKnown) bucket.unknownAmountApplications += 1;
    if (requestedKnown) addAmount(bucket.requested, currency, record.requestedAmount);
    if (providedKnown) addAmount(bucket.provided, currency, record.providedAmount);
    if (remaining != null && remaining > 0) addAmount(bucket.toFund, currency, remaining);
  }

  const countryRows = [...countries.values()]
    .map((bucket) => ({
      country: bucket.country,
      applicants: bucket.applicants.size,
      applications: bucket.applications,
      requested: amountsOf(bucket.requested),
      provided: amountsOf(bucket.provided),
      toFund: amountsOf(bucket.toFund),
      unknownAmountApplications: bucket.unknownAmountApplications,
    }))
    .sort((a, b) => a.country.localeCompare(b.country));

  const statuses = [...statusApplications.keys()].sort().map((status) => ({
    status,
    applications: statusApplications.get(status),
    applicants: statusApplicants.get(status).size,
  }));

  const applicationCount = filtered.length;
  const countryApplications = countryRows.reduce((sum, row) => sum + row.applications, 0);
  const statusApplicationsTotal = statuses.reduce((sum, row) => sum + row.applications, 0);

  return {
    applicants: applicants.size,
    applications: applicationCount,
    unknownAmountApplications,
    statuses,
    requested: amountsOf(requested),
    provided: amountsOf(provided),
    toFund: amountsOf(toFund),
    countries: countryRows,
    applicationCountReconciles:
      countryApplications === applicationCount && statusApplicationsTotal === applicationCount,
  };
}
