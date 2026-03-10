const nodemailer = require("nodemailer");

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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

  const from = process.env.SMTP_FROM?.trim() || getRequiredEnv("SMTP_USER");
  const smtpUser = getRequiredEnv("SMTP_USER");

  const orderId = payload.orderId ?? "";
  const customerName = payload.customerName || "client";
  const pickupLocationName = payload.pickupLocationName || "Emplacement";
  const pickupAddress = payload.pickupAddress || "Adresse de retrait non disponible";
  const pickupTimeLabel = payload.pickupTimeLabel || "--:--";
  const subject = "Pizzeria : Commande confirmee !";

  const textBody = [
    `Bonjour ${customerName},`,
    "",
    `Votre commande numero : ${orderId} a bien ete prise en compte par nos services.`,
    `Vous pourrez recuperer votre commande a l'adresse : ${pickupLocationName} - ${pickupAddress} a ${pickupTimeLabel}.`,
    "Il peut arriver que nous ayons des retards.",
  ].join("\n");

  const htmlBody = `
    <p>Bonjour ${escapeHtml(customerName)},</p>
    <p>
      Votre commande numero : <strong>${escapeHtml(orderId)}</strong> a bien ete prise en compte par nos services.
    </p>
    <p>
      Vous pourrez recuperer votre commande a l'adresse :
      <strong>${escapeHtml(pickupLocationName)} - ${escapeHtml(pickupAddress)}</strong>
      a <strong>${escapeHtml(pickupTimeLabel)}</strong>.
    </p>
    <p>Il peut arriver que nous ayons des retards.</p>
  `;

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

module.exports = {
  sendOrderConfirmationEmail,
};
