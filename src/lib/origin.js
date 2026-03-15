function normalizeOrigin(origin) {
  const raw = String(origin || "").trim().replace(/\/+$/, "");
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (!["http:", "https:"].includes(protocol)) return "";

    const hostname = String(parsed.hostname || "").toLowerCase();
    if (!hostname) return "";

    const defaultPort = protocol === "https:" ? "443" : "80";
    const port = parsed.port && parsed.port !== defaultPort ? `:${parsed.port}` : "";
    return `${protocol}//${hostname}${port}`;
  } catch (_err) {
    return raw.toLowerCase();
  }
}

function isPrivateIpv4Hostname(hostname) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;

  const private172 = /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/;
  return private172.test(hostname);
}

function isLoopbackHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isDevLocalOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;

    const hostname = String(parsed.hostname || "").toLowerCase();
    if (!hostname) return false;

    return isLoopbackHostname(hostname) || isPrivateIpv4Hostname(hostname);
  } catch (_err) {
    return false;
  }
}

function isSubdomainOf(origin, baseDomain) {
  const normalized = normalizeOrigin(origin);
  const root = String(baseDomain || "").trim().toLowerCase().replace(/^\.+/, "");
  if (!normalized || !root) return false;

  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return hostname === root || hostname.endsWith(`.${root}`);
  } catch (_err) {
    return false;
  }
}

module.exports = {
  normalizeOrigin,
  isDevLocalOrigin,
  isSubdomainOf,
};
