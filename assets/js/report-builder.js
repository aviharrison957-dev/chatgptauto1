(function () {
  const preview = document.getElementById("reportPreview");
  const updateButton = document.getElementById("updateReport");

  function value(id) {
    return document.getElementById(id).value.trim();
  }

  function listItems(raw) {
    return raw.split("|").map((item) => item.trim()).filter(Boolean);
  }

  function render() {
    const name = value("rbName") || "Client business";
    const trade = value("rbTrade") || "service business";
    const city = value("rbCity") || "local market";
    const concern = value("rbConcern") || "local visibility";
    const fixes = listItems(value("rbFixes"));

    preview.innerHTML = `
      <div class="report-header">
        <p class="eyebrow">MapGap Report</p>
        <h2>${escapeHtml(name)}</h2>
        <p>${escapeHtml(trade)} audit for ${escapeHtml(city)}. Primary concern: ${escapeHtml(concern)}.</p>
      </div>
      ${section("Google Business Profile", value("rbProfile"))}
      ${section("Reviews", value("rbReviews"))}
      ${section("Website Local Signals", value("rbWebsite"))}
      ${section("Phone Follow-Up Risk", value("rbPhone"))}
      <section class="report-section">
        <h3>30-Day Fix Order</h3>
        <ol>${fixes.map((fix) => `<li>${escapeHtml(fix)}</li>`).join("")}</ol>
      </section>
      <section class="report-section">
        <h3>Notes</h3>
        <p>This report identifies visible gaps and practical fixes. It does not guarantee search rankings, call volume, or revenue.</p>
      </section>
    `;
  }

  function section(title, body) {
    return `
      <section class="report-section">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body || "No finding entered.")}</p>
      </section>
    `;
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[char]));
  }

  updateButton.addEventListener("click", render);
  render();
}());
