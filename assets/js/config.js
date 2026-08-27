window.MAPGAP_CONFIG = {
  // LIVE Stripe Payment Link (real charges) — minted 2026-08-27: plink_1U98D3PL9698yhYP8j3vhBW6,
  // $249 one-time, required custom text field google_business_profile_url. The old TEST link was
  // plink_1TtaiQPL9698yhYPShuM7MHW (test_cNibJ33AK9AG4qx7i85gc00); never derive live URLs by
  // stripping "test_" — this shared Stripe account's live slug 00 belongs to a different product.
  auditPaymentUrl: "https://buy.stripe.com/aFa14p2wGbIOf5beKA5gc0i",
  // Optional monthly maintenance link.
  maintenancePaymentUrl: "",
  // Optional contact email for future form integrations.
  contactEmail: ""
};
