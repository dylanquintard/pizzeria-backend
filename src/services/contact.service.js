const nodemailer = require("nodemailer");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRequiredString(value, fieldName, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} is too long`);
  }
  return trimmed;
}

function parseOptionalString(value, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new Error("subject must be a string");
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error("subject is too long");
  }
  return trimmed;
}

function parseEmail(value) {
  const email = parseRequiredString(value, "email", 254).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new Error("Invalid email format");
  }
  return email;
}

function parseSmtpPort(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid SMTP_PORT value");
  }
  return parsed;
}

function parseBooleanFlag(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    const err = new Error(`Missing required environment variable: ${name}`);
    err.status = 500;
    throw err;
  }
  return value.trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = getRequiredEnv("SMTP_HOST");
  const port = parseSmtpPort(getRequiredEnv("SMTP_PORT"));
  const user = getRequiredEnv("SMTP_USER");
  const pass = getRequiredEnv("SMTP_PASS");

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  return transporter;
}

async function sendContactEmail(payload) {
  const name = parseRequiredString(payload?.name, "name", 120);
  const email = parseEmail(payload?.email);
  const subject = parseOptionalString(payload?.subject, 180);
  const message = parseRequiredString(payload?.message, "message", 5000);

  const from = getRequiredEnv("SMTP_FROM");
  const smtpUser = getRequiredEnv("SMTP_USER");
  const target = process.env.CONTACT_RECIPIENT_EMAIL?.trim() || smtpUser;

  const finalSubject = subject || "Nouveau message via le formulaire de contact";

  const textBody = [
    "Nouveau message depuis le site.",
    "",
    `Nom: ${name}`,
    `Email: ${email}`,
    `Sujet: ${finalSubject}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const htmlBody = `
    <p><strong>Nouveau message depuis le site.</strong></p>
    <p><strong>Nom :</strong> ${escapeHtml(name)}<br/>
    <strong>Email :</strong> ${escapeHtml(email)}<br/>
    <strong>Sujet :</strong> ${escapeHtml(finalSubject)}</p>
    <p><strong>Message :</strong><br/>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
  `;

  try {
    const info = await getTransporter().sendMail({
      from,
      to: target,
      envelope: {
        from: smtpUser,
        to: target,
      },
      replyTo: email,
      subject: finalSubject,
      text: textBody,
      html: htmlBody,
    });

    const debugLogEnabled =
      process.env.NODE_ENV !== "production" ||
      parseBooleanFlag(process.env.CONTACT_DEBUG_LOGGING, false);

    if (debugLogEnabled) {
      console.log("[contact] email queued", {
        to: target,
        messageId: info?.messageId || null,
        accepted: info?.accepted || [],
        rejected: info?.rejected || [],
        response: info?.response || null,
      });
    }
  } catch (_err) {
    const err = new Error("Unable to send email");
    err.status = 502;
    throw err;
  }

  return { sent: true };
}

module.exports = {
  sendContactEmail,
};
