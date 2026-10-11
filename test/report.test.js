import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildReport } from "../js/report.js";

const source = JSON.parse(readFileSync(new URL("../data/applicants.json", import.meta.url), "utf8"));
const records = source.records;

function amount(list, currency) {
  const match = list.find((entry) => entry.currency === currency);
  return match ? match.amount : undefined;
}

test("sample file is labeled and is not a historical snapshot", () => {
  assert.equal(source.source, "sample");
  assert.match(source.label, /not an authoritative/i);
  assert.equal(source.asOfSupported, false);
});

test("current totals distinguish applicants from applications and reconcile", () => {
  const report = buildReport(records);
  assert.equal(report.applicants, 7);
  assert.equal(report.applications, 9);
  assert.equal(report.applicationCountReconciles, true);
  assert.equal(
    report.statuses.reduce((sum, row) => sum + row.applications, 0),
    report.applications,
  );
  assert.equal(
    report.countries.reduce((sum, row) => sum + row.applications, 0),
    report.applications,
  );
});

test("status breakdown counts applications and distinct applicants", () => {
  const report = buildReport(records);
  const byStatus = Object.fromEntries(report.statuses.map((row) => [row.status, row]));
  assert.equal(byStatus.approved.applications, 3);
  assert.equal(byStatus.approved.applicants, 3);
  assert.equal(byStatus.partially_funded.applications, 2);
  assert.equal(byStatus.partially_funded.applicants, 2);
  assert.equal(byStatus.pending.applications, 2);
  assert.equal(byStatus.funded.applications, 1);
  assert.equal(byStatus.declined.applications, 1);
});

test("funding amounts stay in their currency and skip missing values", () => {
  const report = buildReport(records);
  assert.equal(amount(report.requested, "USD"), 35700);
  assert.equal(amount(report.requested, "EUR"), 1000);
  assert.equal(amount(report.requested, "GBP"), 2000);
  assert.equal(amount(report.provided, "USD"), 17600);
  assert.equal(amount(report.provided, "GBP"), 500);
  assert.equal(amount(report.provided, "EUR"), undefined);
  assert.equal(amount(report.toFund, "USD"), 13000);
  assert.equal(amount(report.toFund, "GBP"), 1500);
  assert.equal(amount(report.toFund, "EUR"), undefined);
  assert.equal(report.unknownAmountApplications, 2);
});

test("country breakdown includes missing country and reconciles applications", () => {
  const report = buildReport(records);
  const unknown = report.countries.find((row) => row.country === "Unknown");
  assert.ok(unknown);
  assert.equal(unknown.applicants, 1);
  assert.equal(unknown.applications, 1);
  assert.equal(amount(unknown.requested, "EUR"), 1000);
  assert.equal(unknown.provided.length, 0);
  const nigeria = report.countries.find((row) => row.country === "Nigeria");
  assert.equal(nigeria.applicants, 1);
  assert.equal(nigeria.applications, 2);
  assert.equal(amount(nigeria.toFund, "USD"), 13000);
});

test("filters apply to every figure and clearing them restores the full report", () => {
  const nigeria = buildReport(records, { country: "Nigeria" });
  assert.equal(nigeria.applicants, 1);
  assert.equal(nigeria.applications, 2);
  assert.equal(amount(nigeria.toFund, "USD"), 13000);
  assert.equal(amount(nigeria.requested, "GBP"), undefined);
  assert.equal(nigeria.applicationCountReconciles, true);

  const declined = buildReport(records, { status: "declined" });
  assert.equal(declined.applications, 1);
  assert.equal(declined.toFund.length, 0);
  assert.equal(amount(declined.requested, "USD"), 4000);
  assert.equal(amount(declined.provided, "USD"), 0);

  const cleared = buildReport(records, { country: "", status: "" });
  assert.deepEqual(cleared, buildReport(records));
});

test("empty source is an empty report, not invented zeros for missing currencies", () => {
  const report = buildReport([]);
  assert.equal(report.applicants, 0);
  assert.equal(report.applications, 0);
  assert.equal(report.requested.length, 0);
  assert.equal(report.toFund.length, 0);
  assert.equal(report.applicationCountReconciles, true);
});
