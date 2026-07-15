window.MAPGAP_CONFIG = {
  // ⚠️ TEST-MODE Stripe Payment Link (no real charges; card 4242 4242 4242 4242 works).
  // GO-LIVE: replace with the LIVE Payment Link (same product, same required custom text field:
  //   Label: Google Business Profile URL · Field key: google_business_profile_url)
  // created in live mode, then commit + push. See HANDOFF.md.
  auditPaymentUrl: "https://buy.stripe.com/test_cNibJ33AK9AG4qx7i85gc00",
  // Optional monthly maintenance link.
  maintenancePaymentUrl: "",
  // Optional contact email for future form integrations.
  contactEmail: ""
};
