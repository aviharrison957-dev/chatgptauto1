// Deterministic, email-safe (inline-styled, table-based) renderer for the audit analysis JSON.
// All visual quality lives here so every audit looks like a consistent $249 deliverable; the model
// only supplies the (specific, real-data) words.
const { escapeHtml } = require("./util");

const COLORS = {
  ink: "#15202b",
  body: "#33424e",
  muted: "#6b7c8a",
  border: "#e4e9ee",
  subtle: "#f5f8fa",
  card: "#ffffff",
  accent: "#0e7c7b",
  accentInk: "#0b5e5d"
};

const SEVERITY = {
  high: { color: "#c0392b", label: "Priority" },
  medium: { color: "#cf8a17", label: "Worth fixing" },
  low: { color: "#7f8c8d", label: "Minor" },
  ok: { color: "#1e8449", label: "Looks good" }
};

const STATE_COLOR = { good: "#1e8449", warn: "#cf8a17", bad: "#c0392b", neutral: "#5d6d7e" };

const BADGE = {
  high: { bg: "#fdecea", fg: "#c0392b" },
  medium: { bg: "#fef5e7", fg: "#b9770e" },
  low: { bg: "#eef1f3", fg: "#5d6d7e" },
  quick: { bg: "#eafaf1", fg: "#1e8449" },
  moderate: { bg: "#fef5e7", fg: "#b9770e" },
  involved: { bg: "#eef1f3", fg: "#5d6d7e" }
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function preparedDate() {
  try {
    return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  } catch (_error) {
    return "";
  }
}

function renderAuditHtml(analysis, place, _order) {
  const name = escapeHtml(analysis.business_name || place?.displayName?.text || "your business");
  const address = escapeHtml(place?.formattedAddress || "");
  // Whitelist the scheme before interpolating into href: escapeHtml does not neutralize a
  // "javascript:" URI, and googleMapsUri is external (Places API) data, not ours. (SECURITY_AUDIT F1)
  const rawMapsUri = typeof place?.googleMapsUri === "string" ? place.googleMapsUri : "";
  const mapsUri = /^https:\/\//i.test(rawMapsUri) ? rawMapsUri : "";
  const preheader = escapeHtml(analysis.audit_headline || `Your MapGap Report for ${analysis.business_name || "your business"}`);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>MapGap Report — ${name}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.subtle};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLORS.subtle};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.subtle};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:${COLORS.ink};padding:26px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:${FONT};color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.2px;">
        <span style="display:inline-block;background:${COLORS.accent};color:#fff;font-size:13px;font-weight:700;padding:4px 8px;border-radius:6px;margin-right:10px;">MG</span>
        MapGap Report
      </td>
      <td align="right" style="font-family:${FONT};color:#9fb0bd;font-size:12px;">Prepared ${escapeHtml(preparedDate())}</td>
    </tr></table>
  </td></tr>

  <!-- Title block -->
  <tr><td style="padding:30px 32px 8px 32px;font-family:${FONT};">
    <div style="font-size:12px;text-transform:uppercase;letter-spacing:1.2px;color:${COLORS.accentInk};font-weight:700;">Local presence audit</div>
    <h1 style="margin:8px 0 4px 0;font-size:25px;line-height:1.25;color:${COLORS.ink};font-weight:800;">${name}</h1>
    ${address ? `<div style="font-size:13px;color:${COLORS.muted};">${address}${mapsUri ? ` &middot; <a href="${escapeHtml(mapsUri)}" style="color:${COLORS.accent};text-decoration:none;">View on Google Maps</a>` : ""}</div>` : ""}
    ${analysis.audit_headline ? `<p style="margin:16px 0 0 0;font-size:16px;line-height:1.55;color:${COLORS.ink};font-weight:600;">${escapeHtml(analysis.audit_headline)}</p>` : ""}
    ${analysis.summary ? `<p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:${COLORS.body};">${escapeHtml(analysis.summary)}</p>` : ""}
  </td></tr>

  ${renderSnapshot(analysis.snapshot)}

  <!-- Sections -->
  <tr><td style="padding:6px 32px 8px 32px;">${analysis.sections.map(renderSection).join("")}</td></tr>

  ${renderFixList(analysis.fix_list)}

  ${renderNotChecked(analysis.not_checked)}

  <!-- Closing + disclaimer -->
  <tr><td style="padding:18px 32px 28px 32px;font-family:${FONT};border-top:1px solid ${COLORS.border};">
    ${analysis.closing_note ? `<p style="margin:8px 0 14px 0;font-size:14px;line-height:1.6;color:${COLORS.body};">${escapeHtml(analysis.closing_note)}</p>` : ""}
    <p style="margin:0;font-size:11px;line-height:1.6;color:${COLORS.muted};">
      This report reviews public Google Business Profile data and your website as of ${escapeHtml(preparedDate())}. It is independent and not affiliated with or endorsed by Google. It makes no guarantee of search rankings, Map Pack placement, call volume, or revenue. You own every account and every change recommended here.
    </p>
  </td></tr>

  <tr><td style="background:${COLORS.ink};padding:16px 32px;font-family:${FONT};">
    <span style="color:#ffffff;font-size:13px;font-weight:700;">MapGap Report</span>
    <span style="color:#9fb0bd;font-size:12px;"> &nbsp;·&nbsp; One-time local presence audit. No ranking guarantees.</span>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderSnapshot(snapshot) {
  if (!Array.isArray(snapshot) || snapshot.length === 0) return "";
  const cells = snapshot.map((chip) => {
    const color = STATE_COLOR[chip.state] || STATE_COLOR.neutral;
    return `<td style="padding:6px;" valign="top" width="33%">
      <div style="border:1px solid ${COLORS.border};border-left:4px solid ${color};border-radius:8px;padding:10px 12px;background:${COLORS.subtle};">
        <div style="font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:${COLORS.muted};font-weight:700;">${escapeHtml(chip.label)}</div>
        <div style="font-family:${FONT};font-size:16px;color:${COLORS.ink};font-weight:700;margin-top:3px;">${escapeHtml(chip.value)}</div>
      </div>
    </td>`;
  });

  const rows = [];
  for (let i = 0; i < cells.length; i += 3) {
    const row = cells.slice(i, i + 3);
    while (row.length < 3) row.push('<td width="33%" style="padding:6px;"></td>');
    rows.push(`<tr>${row.join("")}</tr>`);
  }
  return `<tr><td style="padding:14px 26px 6px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
  </td></tr>`;
}

function renderSection(section) {
  const findings = (section.findings || []).map(renderFinding).join("");
  return `<div style="margin:18px 0 6px 0;">
    <h2 style="font-family:${FONT};margin:0 0 4px 0;font-size:17px;color:${COLORS.ink};font-weight:800;border-bottom:2px solid ${COLORS.accent};display:inline-block;padding-bottom:3px;">${escapeHtml(section.title)}</h2>
    ${section.summary ? `<p style="font-family:${FONT};margin:8px 0 4px 0;font-size:14px;line-height:1.6;color:${COLORS.body};">${escapeHtml(section.summary)}</p>` : ""}
    ${findings}
  </div>`;
}

function renderFinding(finding) {
  const sev = SEVERITY[finding.severity] || SEVERITY.medium;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0;">
    <tr><td style="border-left:4px solid ${sev.color};background:${COLORS.subtle};border-radius:0 8px 8px 0;padding:11px 14px;">
      <div style="font-family:${FONT};font-size:11px;text-transform:uppercase;letter-spacing:.6px;font-weight:700;color:${sev.color};margin-bottom:3px;">${sev.label}</div>
      <div style="font-family:${FONT};font-size:14px;line-height:1.55;color:${COLORS.ink};">${escapeHtml(finding.observation)}</div>
      ${finding.recommendation ? `<div style="font-family:${FONT};font-size:13px;line-height:1.55;color:${COLORS.body};margin-top:6px;"><span style="color:${COLORS.accentInk};font-weight:700;">Do this:</span> ${escapeHtml(finding.recommendation)}</div>` : ""}
    </td></tr>
  </table>`;
}

function renderFixList(fixes) {
  if (!Array.isArray(fixes) || fixes.length === 0) return "";
  const rows = fixes.map((fix) => `
    <tr>
      <td valign="top" style="padding:12px 10px 12px 0;width:30px;font-family:${FONT};font-size:18px;font-weight:800;color:${COLORS.accent};">${escapeHtml(String(fix.rank))}</td>
      <td valign="top" style="padding:12px 0;border-bottom:1px solid ${COLORS.border};font-family:${FONT};">
        <div style="font-size:14px;font-weight:700;color:${COLORS.ink};line-height:1.45;">${escapeHtml(fix.action)}</div>
        ${fix.rationale ? `<div style="font-size:13px;color:${COLORS.body};line-height:1.55;margin-top:3px;">${escapeHtml(fix.rationale)}</div>` : ""}
        ${fix.where ? `<div style="font-size:12px;color:${COLORS.muted};margin-top:4px;">Where: ${escapeHtml(fix.where)}</div>` : ""}
        <div style="margin-top:7px;">${badge("Impact: " + cap(fix.impact), fix.impact)} ${badge("Effort: " + cap(fix.effort), fix.effort)}</div>
      </td>
    </tr>`).join("");

  return `<tr><td style="padding:14px 32px 6px 32px;">
    <h2 style="font-family:${FONT};margin:6px 0 2px 0;font-size:18px;color:${COLORS.ink};font-weight:800;">Your prioritized 30-day fix list</h2>
    <p style="font-family:${FONT};margin:2px 0 6px 0;font-size:13px;color:${COLORS.muted};">Ranked by impact against effort. Start at #1.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </td></tr>`;
}

function renderNotChecked(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const lis = items.map((i) => `<li style="margin:4px 0;">${escapeHtml(i)}</li>`).join("");
  return `<tr><td style="padding:16px 32px 4px 32px;">
    <div style="border:1px dashed ${COLORS.border};border-radius:10px;padding:14px 16px;background:${COLORS.card};">
      <h3 style="font-family:${FONT};margin:0 0 6px 0;font-size:14px;color:${COLORS.ink};font-weight:800;">What this audit could not verify</h3>
      <ul style="font-family:${FONT};margin:0;padding-left:18px;font-size:13px;line-height:1.5;color:${COLORS.body};">${lis}</ul>
    </div>
  </td></tr>`;
}

function badge(text, kind) {
  const b = BADGE[kind] || BADGE.low;
  return `<span style="display:inline-block;font-family:${FONT};font-size:11px;font-weight:700;color:${b.fg};background:${b.bg};border-radius:5px;padding:3px 8px;margin-right:6px;">${escapeHtml(text)}</span>`;
}

function cap(value) {
  const s = String(value || "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

module.exports = { renderAuditHtml, preparedDate };
