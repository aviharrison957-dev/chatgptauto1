(function () {
  const config = window.MAPGAP_CONFIG || {};
  const form = document.getElementById("scorecardForm");
  const result = document.getElementById("scoreResult");
  const scoreTitle = document.getElementById("scoreTitle");
  const scoreSummary = document.getElementById("scoreSummary");
  const fixList = document.getElementById("fixList");
  const buyButton = document.getElementById("buyAuditButton");
  const paymentNote = document.getElementById("paymentNote");

  const checks = [
    ["claimedProfile", "Claim and complete the Google Business Profile."],
    ["servicesListed", "Add each profitable service to the Google profile."],
    ["recentPhotos", "Upload recent job photos and label them plainly."],
    ["reviewSystem", "Ask every completed job for a Google review."],
    ["respondsReviews", "Respond to reviews with specific owner-written replies."],
    ["cityPages", "Make the website say the trade, city, and core services clearly."],
    ["napConsistent", "Check that name, address, and phone match on major listings."],
    ["missedCallPlan", "Set a same-day callback rule for missed calls."]
  ];

  function setupPaymentButton() {
    if (!buyButton || !paymentNote) return;
    if (config.auditPaymentUrl) {
      buyButton.addEventListener("click", () => {
        window.location.href = config.auditPaymentUrl;
      });
      paymentNote.textContent = "Secure checkout opens in Stripe.";
      return;
    }
    buyButton.addEventListener("click", () => {
      paymentNote.textContent = "Checkout is ready for Avi to activate: create a Stripe Payment Link and paste it into assets/js/config.js.";
    });
    paymentNote.textContent = "Payment setup is the remaining owner action after handoff.";
  }

  function handleScorecard(event) {
    event.preventDefault();
    const data = new FormData(form);
    const missing = checks.filter(([name]) => !data.get(name));
    const score = Math.round(((checks.length - missing.length) / checks.length) * 100);
    const business = data.get("businessName") || "This business";
    const trade = data.get("trade") || "service business";
    const city = data.get("city") || "your city";

    scoreTitle.textContent = `${business}: ${score}/100`;
    if (score >= 75) {
      scoreSummary.textContent = `The basics look organized for a ${trade} business in ${city}. The paid report is most useful if you want competitor checks and a tighter 30-day fix order.`;
    } else if (score >= 45) {
      scoreSummary.textContent = `There are fixable gaps for a ${trade} business in ${city}. The fastest wins are usually profile completeness, review process, and local website wording.`;
    } else {
      scoreSummary.textContent = `The local presence is likely leaking calls. Start with the items below before paying for broad monthly SEO.`;
    }

    fixList.innerHTML = "";
    const fixes = missing.length ? missing : checks.slice(0, 3);
    fixes.slice(0, 5).forEach(([, fix]) => {
      const li = document.createElement("li");
      li.textContent = fix;
      fixList.appendChild(li);
    });
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (form) form.addEventListener("submit", handleScorecard);
  setupPaymentButton();
}());
