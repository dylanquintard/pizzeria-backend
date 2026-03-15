const prisma = require("../lib/prisma");
const { FRONTEND_SITE_URL } = require("../lib/env");

const SITE_SETTINGS_SINGLETON_ID = 1;
const DEFAULT_SITE_NAME = "Camion Pizza Italienne";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getEmailBranding() {
  const siteSettings = await prisma.siteSetting
    .findUnique({
      where: { id: SITE_SETTINGS_SINGLETON_ID },
      select: {
        siteName: true,
        seo: true,
      },
    })
    .catch(() => null);

  return {
    siteName: String(siteSettings?.siteName || "").trim() || DEFAULT_SITE_NAME,
    headerLogoUrl: String(siteSettings?.seo?.headerLogoUrl || "").trim(),
    siteUrl: String(FRONTEND_SITE_URL || "").trim() || "https://example.invalid",
  };
}

function buildLogoBlock(logoUrl, siteName) {
  if (!logoUrl) {
    return `
      <div style="text-align:center; margin:0 0 28px;">
        <div style="display:inline-block; font-size:24px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#111827;">
          ${escapeHtml(siteName)}
        </div>
      </div>
    `;
  }

  return `
    <div style="text-align:center; margin:0 0 28px;">
      <img
        src="${escapeHtml(logoUrl)}"
        alt="${escapeHtml(siteName)}"
        style="display:inline-block; max-width:220px; width:auto; height:auto;"
      />
    </div>
  `;
}

function buildEmailLayout({ siteName, headerLogoUrl, contentHtml }) {
  return `
    <div style="margin:0; padding:32px 16px; background:#f5f1e8; font-family:Arial, Helvetica, sans-serif; color:#1f2937;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #eadfcb; border-radius:24px; padding:36px 32px; box-shadow:0 20px 40px rgba(15,23,42,0.08);">
        ${buildLogoBlock(headerLogoUrl, siteName)}
        <div style="font-size:16px; line-height:1.7; color:#1f2937;">
          ${contentHtml}
        </div>
      </div>
    </div>
  `;
}

function buildTeamSignature(siteName) {
  return `Cordialement,\nL'equipe ${siteName}`;
}

function buildTeamSignatureHtml(siteName) {
  return `
    <p style="margin:28px 0 0;">
      Cordialement,<br />
      L'equipe ${escapeHtml(siteName)}
    </p>
  `;
}

function buildUserOrdersUrl(siteUrl) {
  return `${String(siteUrl || "").replace(/\/+$/, "")}/userorders`;
}

module.exports = {
  escapeHtml,
  getEmailBranding,
  buildEmailLayout,
  buildTeamSignature,
  buildTeamSignatureHtml,
  buildUserOrdersUrl,
  DEFAULT_SITE_NAME,
};
