// Synthetic, ILLUSTRATIVE data used only for offline tests and the template design preview.
// This is NOT a real audit and NOT real business data — it exists to exercise the deterministic
// renderer/normalizer without live API keys. Real samples come from scripts/generate-samples.js.

// Shaped like a raw model response (pre-normalization) so it also tests normalizeAnalysis() coercion.
const SAMPLE_MODEL_OUTPUT = {
  business_name: "Brightwater Plumbing & Drain",
  audit_headline:
    "With a 4.2 rating from only 18 reviews and no hours listed, your profile is leaving easy trust and visibility on the table.",
  summary:
    "Brightwater Plumbing & Drain has a solid 4.2 rating, but just 18 reviews and 3 photos make the profile look thinner than an established plumber should. Hours are not listed and the website homepage title does not mention Austin or plumbing, two quick, high-impact fixes.",
  snapshot: [
    { label: "Google rating", value: "4.2 ★", state: "warn" },
    { label: "Reviews", value: "18", state: "warn" },
    { label: "Photos visible", value: "3", state: "bad" },
    { label: "Hours listed", value: "No", state: "bad" },
    { label: "Website", value: "Linked (HTTPS)", state: "good" },
    { label: "Primary category", value: "Plumber", state: "good" }
  ],
  sections: [
    {
      key: "gbp",
      title: "Google Business Profile",
      summary: "The core profile is claimed and categorized correctly, but it is missing the completeness signals customers and Google both look for.",
      findings: [
        { observation: "Business hours are not listed on the profile. Customers can't tell if you're open, and incomplete profiles look less trustworthy.", severity: "HIGH", recommendation: "Add full weekly hours, including how after-hours / emergency calls are handled." },
        { observation: "Only 3 photos are visible via Google. Established plumbers typically show trucks, team, and completed work.", severity: "medium", recommendation: "Add 8-10 recent, clearly-labeled job photos." },
        { observation: "Primary category is correctly set to Plumber, which is a good relevance signal.", severity: "ok", recommendation: "" }
      ]
    },
    {
      key: "reviews",
      title: "Reviews & Reputation",
      summary: "A 4.2 average is fine; the bigger issue is volume and recency.",
      findings: [
        { observation: "18 total reviews is low for a plumber; review count is a recognized trust and relevance signal.", severity: "high", recommendation: "Ask every satisfied customer for a Google review with a direct link." },
        { observation: "Two of the five recent reviews mention slow callbacks, a theme worth addressing publicly.", severity: "medium", recommendation: "Reply to those reviews and tighten your callback process." },
        { observation: "We cannot see from Google's data whether you reply to reviews.", severity: "low", recommendation: "Verify every review has an owner reply; replies are visible to future customers." }
      ]
    },
    {
      key: "website",
      title: "Website & Local Signals",
      summary: "The site is live and secure but under-optimized for local search.",
      findings: [
        { observation: "The homepage <title> is 'Home | Brightwater' — it does not include 'plumber' or 'Austin', the single highest-impact on-page local signal.", severity: "high", recommendation: "Rewrite the title to something like 'Austin Plumber | Brightwater Plumbing & Drain'." },
        { observation: "No click-to-call (tel:) link was found on the homepage; mobile visitors can't tap to call.", severity: "medium", recommendation: "Add a tappable phone link in the header." },
        { observation: "No LocalBusiness structured data was detected.", severity: "low", recommendation: "Add LocalBusiness schema with name, address, phone, and hours." }
      ]
    },
    {
      key: "missed_call",
      title: "Missed-Call Risk",
      summary: "Calls are how plumbing jobs get booked, so missed calls are missed revenue.",
      findings: [
        { observation: "Recent reviews mention slow callbacks, and the site shows no after-hours or response-time promise.", severity: "medium", recommendation: "Set up missed-call text-back and state a callback time on the site." }
      ]
    }
  ],
  fix_list: [
    { rank: 1, action: "Add complete business hours to your Google Business Profile.", rationale: "Hours are currently blank; this is a fast completeness + trust win.", where: "Google Business Profile -> Edit profile -> Hours", impact: "high", effort: "quick" },
    { rank: 2, action: "Rewrite your homepage title tag to include 'Austin' and 'plumber'.", rationale: "Your title says 'Home | Brightwater' with no city or trade.", where: "Website CMS -> homepage SEO/title settings", impact: "high", effort: "quick" },
    { rank: 3, action: "Launch a simple review-request habit.", rationale: "18 reviews is low; volume is a recognized trust signal.", where: "Your invoicing/checkout follow-up", impact: "high", effort: "moderate" },
    { rank: 4, action: "Add 8-10 recent job photos to the profile.", rationale: "Only 3 photos are visible today.", where: "Google Business Profile -> Photos", impact: "medium", effort: "quick" },
    { rank: 5, action: "Add a click-to-call link to your website header.", rationale: "No tel: link was found, hurting mobile conversions.", where: "Website header template", impact: "medium", effort: "quick" },
    { rank: 6, action: "Set up missed-call text-back.", rationale: "Reviews mention slow callbacks.", where: "Your phone system or a text-back tool", impact: "medium", effort: "moderate" }
  ],
  not_checked: [
    "Whether you currently reply to reviews (Google's public data doesn't expose this) — check your profile's Reviews tab.",
    "Your actual phone answer rate — test it by calling your own number during and after hours.",
    "Citation consistency (name/address/phone) across directories beyond your website."
  ],
  closing_note:
    "Start with #1 and #2 this week; both take minutes and address the clearest gaps. None of this guarantees rankings, but each item is a recognized local-search best practice."
};

// Minimal raw Places-shaped object for the renderer header.
const SAMPLE_PLACE = {
  id: "SAMPLE_PLACE_ID",
  displayName: { text: "Brightwater Plumbing & Drain" },
  formattedAddress: "1200 W 5th St, Austin, TX 78703",
  googleMapsUri: "https://maps.google.com/?cid=0"
};

module.exports = { SAMPLE_MODEL_OUTPUT, SAMPLE_PLACE };
