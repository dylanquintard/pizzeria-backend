const nodemailer = require("nodemailer");
const {
  escapeHtml,
  getEmailBranding,
  buildEmailLayout,
  buildTeamSignature,
  buildTeamSignatureHtml,
  buildUserOrdersUrl,
} = require("./email-template.service");

let emailTransporter = null;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    const err = new Error(`Missing required environment variable: ${name}`);
    err.status = 500;
    throw err;
  }
  return String(value).trim();
}

function parseSmtpPort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const err = new Error("Invalid SMTP_PORT value");
    err.status = 500;
    throw err;
  }
  return parsed;
}

function getMailIdentity() {
  return {
    from: process.env.SMTP_FROM?.trim() || getRequiredEnv("SMTP_USER"),
    smtpUser: getRequiredEnv("SMTP_USER"),
  };
}

function getEmailTransporter() {
  if (emailTransporter) return emailTransporter;

  const host = getRequiredEnv("SMTP_HOST");
  const port = parseSmtpPort(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");

  emailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return emailTransporter;
}

async function sendOrderConfirmationEmail(payload = {}) {
  const to = String(payload.toEmail || "").trim().toLowerCase();
  if (!to) return { sent: false, skipped: true };

  const { from, smtpUser } = getMailIdentity();
  const branding = await getEmailBranding();
  const siteName = String(payload.siteName || branding.siteName || "").trim() || "Pizza Truck";
  const headerLogoUrl = String(payload.headerLogoUrl || branding.headerLogoUrl || "").trim();
  const orderId = payload.orderId ?? "";
  const pickupLocationName = String(payload.pickupLocationName || "Emplacement").trim();
  const pickupAddress = String(payload.pickupAddress || "Adresse de retrait non disponible").trim();
  const pickupTimeLabel = String(payload.pickupTimeLabel || "--:--").trim();
  const subject = `${siteName} : Confirmation de votre commande ${orderId}`;

  const textBody = [
    "Bonjour,",
    "",
    `Votre commande a bien ete confirmee. Numero : ${orderId}`,
    "",
    "Nous vous remercions pour votre confiance et mettons tout en oeuvre pour la preparer dans les meilleures conditions.",
    "",
    `${pickupLocationName}`,
    `${pickupAddress}`,
    `${pickupTimeLabel}`,
    "",
    buildTeamSignature(siteName),
  ].join("\n");

  const htmlBody = buildEmailLayout({
    siteName,
    headerLogoUrl,
    contentHtml: `
      <p style="margin:0 0 20px;">Bonjour,</p>
      <p style="margin:0 0 20px;">
        Votre commande a bien ete confirmee. Numero : <strong>${escapeHtml(orderId)}</strong>
      </p>
      <p style="margin:0 0 24px;">
        Nous vous remercions pour votre confiance et mettons tout en oeuvre pour la preparer dans les meilleures conditions.
      </p>
      <div style="margin:0 0 24px; padding:18px 20px; border:1px solid #eadfcb; border-radius:18px; background:#fbf8f2;">
        <p style="margin:0 0 8px; font-weight:700;">Lieu de retrait</p>
        <p style="margin:0 0 6px;">${escapeHtml(pickupLocationName)}</p>
        <p style="margin:0 0 6px;">${escapeHtml(pickupAddress)}</p>
        <p style="margin:0; font-weight:700;">${escapeHtml(pickupTimeLabel)}</p>
      </div>
      ${buildTeamSignatureHtml(siteName)}
    `,
  });

  try {
    await getEmailTransporter().sendMail({
      from,
      to,
      envelope: {
        from: smtpUser,
        to,
      },
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch (_err) {
    const err = new Error("Unable to send order confirmation email");
    err.status = 502;
    throw err;
  }

  return { sent: true };
}

async function sendOrderValidationEmail(payload = {}) {
  const to = String(payload.toEmail || "").trim().toLowerCase();
  if (!to) return { sent: false, skipped: true };

  const { from, smtpUser } = getMailIdentity();
  const branding = await getEmailBranding();
  const siteName = String(payload.siteName || branding.siteName || "").trim() || "Pizza Truck";
  const headerLogoUrl = String(payload.headerLogoUrl || branding.headerLogoUrl || "").trim();
  const userOrdersUrl = buildUserOrdersUrl(branding.siteUrl);
  const subject = `${siteName} : Merci pour votre passage !`;

  const textBody = [
    "Bonjour,",
    "",
    `Nous vous remercions pour votre commande aupres de ${siteName}.`,
    "",
    "Votre commande a bien ete finalisee et nous esperons qu elle vous a donne entiere satisfaction.",
    "",
    "Si vous avez apprecie votre experience, nous vous invitons a laisser un avis directement sur notre site en cliquant ci-dessous :",
    userOrdersUrl,
    "",
    "Merci encore pour votre confiance, et a tres bientot.",
    "",
    buildTeamSignature(siteName),
  ].join("\n");

  const htmlBody = buildEmailLayout({
    siteName,
    headerLogoUrl,
    contentHtml: `
      <p style="margin:0 0 20px;">Bonjour,</p>
      <p style="margin:0 0 20px;">
        Nous vous remercions pour votre commande aupres de ${escapeHtml(siteName)}.
      </p>
      <p style="margin:0 0 20px;">
        Votre commande a bien ete finalisee et nous esperons qu elle vous a donne entiere satisfaction.
      </p>
      <p style="margin:0 0 24px;">
        Si vous avez apprecie votre experience, nous vous invitons a laisser un avis directement sur notre site en cliquant ci-dessous :
      </p>
      <div style="text-align:center; margin:0 0 28px;">
        <a
          href="${escapeHtml(userOrdersUrl)}"
          style="display:inline-block; text-decoration:none; color:#d97706; font-size:34px; letter-spacing:6px;"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Laisser un avis"
        >
          ★★★★★
        </a>
      </div>
      <p style="margin:0 0 20px;">
        Merci encore pour votre confiance, et a tres bientot.
      </p>
      ${buildTeamSignatureHtml(siteName)}
    `,
  });

  try {
    await getEmailTransporter().sendMail({
      from,
      to,
      envelope: {
        from: smtpUser,
        to,
      },
      subject,
      text: textBody,
      html: htmlBody,
    });
  } catch (_err) {
    const err = new Error("Unable to send order validation email");
    err.status = 502;
    throw err;
  }

  return { sent: true };
}

module.exports = {
  sendOrderConfirmationEmail,
  sendOrderValidationEmail,
};
