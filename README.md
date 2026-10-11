# partyapp

Applicant funding app with an Audit Report page.

## Audit Report

Open `audit.html` from the site navigation at any time. It shows current totals from `data/applicants.json`:

- distinct applicants and application counts
- funding status breakdown
- requested, provided, and amount still to be funded
- the same figures by country, including a blank-country Unknown group

Filters for country and funding status apply to every figure. Refresh reloads the file. A failed refresh does not mark stale figures as newly loaded.

The checked-in file is a **sample dataset**, labeled on the page. It is not a production audit source. There is no currency conversion and no historical as-of snapshot.

### Amount to be funded

Requested minus provided, only for approved and partially funded applications where both amounts are known and the remainder is positive. Missing amounts stay unknown. They are not counted as zero.

## Run

```bash
python3 -m http.server 8080 --bind 127.0.0.1
node --test
```
