# MapGap Report

Deployed URL: https://aviharrison957-dev.github.io/chatgptauto1/

MapGap Report sells a one-time local presence audit for owner-operated service businesses.

## Product

- Public sales page: `index.html`
- Free local gap scorecard: `assets/js/scorecard.js`
- Operator report builder: `report-builder.html`
- Payment config: `assets/js/config.js`
- Handoff instructions: `HANDOFF.md`

## Payment Status

The checkout button is wired to `assets/js/config.js`. Avi must create a live Stripe Payment Link and paste it into `auditPaymentUrl` before customers can pay.

## Local Preview

Open `index.html` in a browser. No build step is required.
