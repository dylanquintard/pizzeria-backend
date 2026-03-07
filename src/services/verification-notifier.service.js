const nodemailer = require("nodemailer");

const APP_NAME = process.env.APP_NAME || "Pizzeria";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const VERIFICATION_STRICT_DELIVERY =
  process.env.VERIFICATION_STRICT_DELIVERY === "true" || IS_PRODUCTION;
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || "none").trim().toLowerCase();
const SMS_PROVIDER = String(process.env.SMS_PROVIDER || "none").trim().toLowerCase();

let smtpTransporter = null;

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration is incomplete");
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return smtpTransporter;
}

async function sendEmailVerificationCode({ email, code, expiresInMinutes }) {
  if (EMAIL_PROVIDER !== "smtp") {
    return { sent: false, provider: EMAIL_PROVIDER || "none", reason: "provider_not_configured" };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new Error("SMTP_FROM (or SMTP_USER) is required");
  }

  const transporter = getSmtpTransporter();
  await transporter.sendMail({
    from,
    to: email,
    subject: `${APP_NAME} - Code de verification`,
    text: `Votre code de verification est: ${code}. Il expire dans ${expiresInMinutes} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5">
        <h2>${APP_NAME}</h2>
        <p>Votre code de verification est:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>Il expire dans ${expiresInMinutes} minutes.</p>
      </div>
    `,
  });

  return { sent: true, provider: "smtp" };
}

async function sendSmsVerificationCode({ phone, code, expiresInMinutes }) {
  if (SMS_PROVIDER !== "twilio") {
    return { sent: false, provider: SMS_PROVIDER || "none", reason: "provider_not_configured" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio configuration is incomplete");
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: phone,
    From: from,
    Body: `${APP_NAME}: votre code de verification est ${code}. Expire dans ${expiresInMinutes} minutes.`,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Twilio SMS send failed (${response.status}): ${text}`);
  }

  return { sent: true, provider: "twilio" };
}

async function dispatchVerificationCodes({
  email,
  phone,
  emailOtpCode,
  phoneOtpCode,
  expiresInMinutes,
}) {
  const delivery = {
    email: { sent: false, provider: EMAIL_PROVIDER || "none" },
    phone: { sent: false, provider: SMS_PROVIDER || "none" },
  };

  if (emailOtpCode) {
    delivery.email = await sendEmailVerificationCode({
      email,
      code: emailOtpCode,
      expiresInMinutes,
    });
  }

  if (phoneOtpCode) {
    delivery.phone = await sendSmsVerificationCode({
      phone,
      code: phoneOtpCode,
      expiresInMinutes,
    });
  }

  const missingDeliveryChannels = [];
  if (emailOtpCode && !delivery.email.sent) missingDeliveryChannels.push("email");
  if (phoneOtpCode && !delivery.phone.sent) missingDeliveryChannels.push("phone");

  if (missingDeliveryChannels.length > 0 && VERIFICATION_STRICT_DELIVERY) {
    throw new Error(
      `Verification delivery not configured for: ${missingDeliveryChannels.join(", ")}`
    );
  }

  return delivery;
}

module.exports = {
  dispatchVerificationCodes,
};

