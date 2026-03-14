const prisma = require("../lib/prisma");

const SITE_SETTINGS_SINGLETON_ID = 1;
const ANNOUNCEMENT_VARIANTS = new Set(["info", "alert", "success"]);

const DEFAULT_SITE_SETTINGS = Object.freeze({
  siteName: "Camion Pizza Italienne",
  siteTagline: {
    fr: "Pizza napolitaine au feu de bois en Moselle",
    en: "Wood-fired Neapolitan pizza in Moselle",
  },
  siteDescription: {
    fr: "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
    en: "Wood-fired Neapolitan pizza in Moselle. Online ordering and quick pickup.",
  },
  contact: {
    phone: "",
    email: "",
    address: "",
    mapsUrl: "",
    serviceArea: {
      fr: "Moselle et alentours",
      en: "Moselle and surrounding areas",
    },
  },
  social: {
    instagramUrl: "",
    facebookUrl: "",
    tiktokUrl: "",
  },
  seo: {
    defaultMetaTitle: {
      fr: "Camion Pizza Italienne | Pizza napolitaine au feu de bois en Moselle",
      en: "Italian Pizza Service | Wood-fired Neapolitan pizza in Moselle",
    },
    defaultMetaDescription: {
      fr: "Pizza napolitaine au feu de bois en Moselle. Commande en ligne et retrait rapide.",
      en: "Wood-fired Neapolitan pizza in Moselle. Online ordering and quick pickup.",
    },
    defaultOgImageUrl: "",
    headerLogoUrl: "",
    canonicalSiteUrl: "",
  },
  home: {
    heroTitle: {
      fr: "Pizza napolitaine au feu de bois en Moselle",
      en: "Wood-fired Neapolitan pizza in Moselle",
    },
    heroSubtitle: {
      fr: "Une pizza travaillee pour l emporter: pate souple, cuisson vive et recettes nettes a recuperer en Moselle.",
      en: "Pizza built for pickup: supple dough, lively baking and cleaner recipes to collect in Moselle.",
    },
    primaryCtaLabel: {
      fr: "Commander",
      en: "Order now",
    },
    secondaryCtaLabel: {
      fr: "Voir le menu",
      en: "See menu",
    },
    reassuranceText: {
      fr: "Commande en ligne, retrait rapide, cuisson minute",
      en: "Online ordering, quick pickup, baked to order",
    },
  },
  blog: {
    introTitle: {
      fr: "Farines, tomates, mozzarella & surtout la pizza !",
      en: "Flour, tomatoes, mozzarella and above all, pizza!",
    },
    introText: {
      fr: "Ici on parle d'italie, de saveurs, de savoir faire et de qualite !",
      en: "Here we talk about Italy, flavor, craft and quality!",
    },
  },
  contactPage: {
    pageTitle: {
      fr: "Nous contacter",
      en: "Get in touch",
    },
    introText: {
      fr: "Pour toute question sur la commande ou les horaires d'ouvertures, contacte-nous directement.",
      en: "For any question about ordering or opening hours, contact us directly.",
    },
    helperText: {
      fr: "Retrouvez ici nos coordonnees, nos reseaux et le formulaire de contact.",
      en: "Find our contact details, social links and contact form here.",
    },
  },
  order: {
    pickupIntroText: {
      fr: "Choisissez d'abord la date, l'horaire, puis l'adresse de retrait.",
      en: "Choose date first, then pickup time and location.",
    },
    pickupConfirmationText: {
      fr: "Verifiez bien cette adresse avant de finaliser la commande.",
      en: "Please verify this address before finalizing your order.",
    },
  },
  footer: {
    shortText: {
      fr: "Pizza napolitaine artisanale, commande en ligne et retrait rapide.",
      en: "Artisan Neapolitan pizza, online ordering and quick pickup.",
    },
    legalText: {
      fr: "Informations et disponibilites susceptibles d'evoluer selon la tournee.",
      en: "Information and availability may change depending on the weekly route.",
    },
    copyright: {
      fr: "Tous droits reserves.",
      en: "All rights reserved.",
    },
  },
  announcement: {
    enabled: false,
    text: {
      fr: "",
      en: "",
    },
    linkUrl: "",
    variant: "info",
  },
});

const LOCALIZED_TRANSLATION_PATHS = [
  ["siteTagline"],
  ["siteDescription"],
  ["contact", "serviceArea"],
  ["seo", "defaultMetaTitle"],
  ["seo", "defaultMetaDescription"],
  ["home", "heroTitle"],
  ["home", "heroSubtitle"],
  ["home", "primaryCtaLabel"],
  ["home", "secondaryCtaLabel"],
  ["home", "reassuranceText"],
  ["blog", "introTitle"],
  ["blog", "introText"],
  ["contactPage", "pageTitle"],
  ["contactPage", "introText"],
  ["contactPage", "helperText"],
  ["order", "pickupIntroText"],
  ["order", "pickupConfirmationText"],
  ["footer", "shortText"],
  ["footer", "legalText"],
  ["footer", "copyright"],
  ["announcement", "text"],
];

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SITE_SETTINGS));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureObject(value, fieldName) {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value;
}

function normalizeString(value, fieldName) {
  if (value === undefined) return undefined;
  if (value === null) return "";
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  return value.trim();
}

function mergeLocalizedValue(currentValue, nextValue, fieldName) {
  const source = ensureObject(nextValue, fieldName);
  return {
    fr:
      source.fr !== undefined
        ? normalizeString(source.fr, `${fieldName}.fr`)
        : String(currentValue?.fr || ""),
    en:
      source.en !== undefined
        ? normalizeString(source.en, `${fieldName}.en`)
        : String(currentValue?.en || ""),
  };
}

function formatSiteSettingsRecord(record) {
  const defaults = cloneDefaults();
  const source = record || {};

  return {
    siteName: String(source.siteName || defaults.siteName),
    siteTagline: mergeLocalizedValue(
      defaults.siteTagline,
      source.siteTagline || {},
      "siteTagline"
    ),
    siteDescription: mergeLocalizedValue(
      defaults.siteDescription,
      source.siteDescription || {},
      "siteDescription"
    ),
    contact: {
      phone: normalizeString(source.contact?.phone, "contact.phone") ?? defaults.contact.phone,
      email: normalizeString(source.contact?.email, "contact.email") ?? defaults.contact.email,
      address:
        normalizeString(source.contact?.address, "contact.address") ?? defaults.contact.address,
      mapsUrl:
        normalizeString(source.contact?.mapsUrl, "contact.mapsUrl") ?? defaults.contact.mapsUrl,
      serviceArea: mergeLocalizedValue(
        defaults.contact.serviceArea,
        source.contact?.serviceArea || {},
        "contact.serviceArea"
      ),
    },
    social: {
      instagramUrl:
        normalizeString(source.social?.instagramUrl, "social.instagramUrl") ??
        defaults.social.instagramUrl,
      facebookUrl:
        normalizeString(source.social?.facebookUrl, "social.facebookUrl") ??
        defaults.social.facebookUrl,
      tiktokUrl:
        normalizeString(source.social?.tiktokUrl, "social.tiktokUrl") ??
        defaults.social.tiktokUrl,
    },
    seo: {
      defaultMetaTitle: mergeLocalizedValue(
        defaults.seo.defaultMetaTitle,
        source.seo?.defaultMetaTitle || {},
        "seo.defaultMetaTitle"
      ),
      defaultMetaDescription: mergeLocalizedValue(
        defaults.seo.defaultMetaDescription,
        source.seo?.defaultMetaDescription || {},
        "seo.defaultMetaDescription"
      ),
      defaultOgImageUrl:
        normalizeString(source.seo?.defaultOgImageUrl, "seo.defaultOgImageUrl") ??
        defaults.seo.defaultOgImageUrl,
      headerLogoUrl:
        normalizeString(source.seo?.headerLogoUrl, "seo.headerLogoUrl") ??
        defaults.seo.headerLogoUrl,
      canonicalSiteUrl:
        normalizeString(source.seo?.canonicalSiteUrl, "seo.canonicalSiteUrl") ??
        defaults.seo.canonicalSiteUrl,
    },
    home: {
      heroTitle: mergeLocalizedValue(
        defaults.home.heroTitle,
        source.home?.heroTitle || {},
        "home.heroTitle"
      ),
      heroSubtitle: mergeLocalizedValue(
        defaults.home.heroSubtitle,
        source.home?.heroSubtitle || {},
        "home.heroSubtitle"
      ),
      primaryCtaLabel: mergeLocalizedValue(
        defaults.home.primaryCtaLabel,
        source.home?.primaryCtaLabel || {},
        "home.primaryCtaLabel"
      ),
      secondaryCtaLabel: mergeLocalizedValue(
        defaults.home.secondaryCtaLabel,
        source.home?.secondaryCtaLabel || {},
        "home.secondaryCtaLabel"
      ),
      reassuranceText: mergeLocalizedValue(
        defaults.home.reassuranceText,
        source.home?.reassuranceText || {},
        "home.reassuranceText"
      ),
    },
    blog: {
      introTitle: mergeLocalizedValue(
        defaults.blog.introTitle,
        source.blog?.introTitle || {},
        "blog.introTitle"
      ),
      introText: mergeLocalizedValue(
        defaults.blog.introText,
        source.blog?.introText || {},
        "blog.introText"
      ),
    },
    contactPage: {
      pageTitle: mergeLocalizedValue(
        defaults.contactPage.pageTitle,
        source.contactPage?.pageTitle || {},
        "contactPage.pageTitle"
      ),
      introText: mergeLocalizedValue(
        defaults.contactPage.introText,
        source.contactPage?.introText || {},
        "contactPage.introText"
      ),
      helperText: mergeLocalizedValue(
        defaults.contactPage.helperText,
        source.contactPage?.helperText || {},
        "contactPage.helperText"
      ),
    },
    order: {
      pickupIntroText: mergeLocalizedValue(
        defaults.order.pickupIntroText,
        source.order?.pickupIntroText || {},
        "order.pickupIntroText"
      ),
      pickupConfirmationText: mergeLocalizedValue(
        defaults.order.pickupConfirmationText,
        source.order?.pickupConfirmationText || {},
        "order.pickupConfirmationText"
      ),
    },
    footer: {
      shortText: mergeLocalizedValue(
        defaults.footer.shortText,
        source.footer?.shortText || {},
        "footer.shortText"
      ),
      legalText: mergeLocalizedValue(
        defaults.footer.legalText,
        source.footer?.legalText || {},
        "footer.legalText"
      ),
      copyright: mergeLocalizedValue(
        defaults.footer.copyright,
        source.footer?.copyright || {},
        "footer.copyright"
      ),
    },
    announcement: {
      enabled:
        typeof source.announcement?.enabled === "boolean"
          ? source.announcement.enabled
          : defaults.announcement.enabled,
      text: mergeLocalizedValue(
        defaults.announcement.text,
        source.announcement?.text || {},
        "announcement.text"
      ),
      linkUrl:
        normalizeString(source.announcement?.linkUrl, "announcement.linkUrl") ??
        defaults.announcement.linkUrl,
      variant: ANNOUNCEMENT_VARIANTS.has(String(source.announcement?.variant || ""))
        ? String(source.announcement.variant)
        : defaults.announcement.variant,
    },
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
  };
}

function buildPersistedPayload(settings) {
  return {
    siteName: settings.siteName,
    siteTagline: settings.siteTagline,
    siteDescription: settings.siteDescription,
    contact: settings.contact,
    social: settings.social,
    seo: settings.seo,
    home: settings.home,
    blog: settings.blog,
    contactPage: settings.contactPage,
    order: settings.order,
    footer: settings.footer,
    announcement: settings.announcement,
  };
}

function getNestedValue(source, path) {
  return path.reduce((current, key) => current?.[key], source);
}

function setNestedValue(target, path, value) {
  const nextTarget = target;
  let cursor = nextTarget;
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index];
    cursor[key] = isPlainObject(cursor[key]) ? { ...cursor[key] } : {};
    cursor = cursor[key];
  }
  cursor[path[path.length - 1]] = value;
  return nextTarget;
}

async function translateFrenchTextToEnglish(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "fr");
  url.searchParams.set("tl", "en");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "pizzeria-backend/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Automatic translation is temporarily unavailable");
  }

  const payload = await response.json();
  const translated = Array.isArray(payload?.[0])
    ? payload[0].map((entry) => String(entry?.[0] || "")).join("")
    : "";

  return translated.trim() || text;
}

async function getSiteSettingsRecord() {
  return prisma.siteSetting.findUnique({
    where: { id: SITE_SETTINGS_SINGLETON_ID },
  });
}

async function getPublicSiteSettings() {
  const record = await getSiteSettingsRecord();
  return formatSiteSettingsRecord(record);
}

async function getAdminSiteSettings() {
  const record = await getSiteSettingsRecord();
  return formatSiteSettingsRecord(record);
}

async function updateSiteSettings(payload) {
  const current = await getAdminSiteSettings();
  const source = ensureObject(payload, "payload");
  const next = {
    ...current,
    siteName:
      source.siteName !== undefined
        ? normalizeString(source.siteName, "siteName")
        : current.siteName,
    siteTagline:
      source.siteTagline !== undefined
        ? mergeLocalizedValue(current.siteTagline, source.siteTagline, "siteTagline")
        : current.siteTagline,
    siteDescription:
      source.siteDescription !== undefined
        ? mergeLocalizedValue(
            current.siteDescription,
            source.siteDescription,
            "siteDescription"
          )
        : current.siteDescription,
    contact:
      source.contact !== undefined
        ? {
            ...current.contact,
            ...(ensureObject(source.contact, "contact")),
            phone:
              ensureObject(source.contact, "contact").phone !== undefined
                ? normalizeString(ensureObject(source.contact, "contact").phone, "contact.phone")
                : current.contact.phone,
            email:
              ensureObject(source.contact, "contact").email !== undefined
                ? normalizeString(ensureObject(source.contact, "contact").email, "contact.email")
                : current.contact.email,
            address:
              ensureObject(source.contact, "contact").address !== undefined
                ? normalizeString(
                    ensureObject(source.contact, "contact").address,
                    "contact.address"
                  )
                : current.contact.address,
            mapsUrl:
              ensureObject(source.contact, "contact").mapsUrl !== undefined
                ? normalizeString(
                    ensureObject(source.contact, "contact").mapsUrl,
                    "contact.mapsUrl"
                  )
                : current.contact.mapsUrl,
            serviceArea:
              ensureObject(source.contact, "contact").serviceArea !== undefined
                ? mergeLocalizedValue(
                    current.contact.serviceArea,
                    ensureObject(source.contact, "contact").serviceArea,
                    "contact.serviceArea"
                  )
                : current.contact.serviceArea,
          }
        : current.contact,
    social:
      source.social !== undefined
        ? {
            ...current.social,
            instagramUrl:
              ensureObject(source.social, "social").instagramUrl !== undefined
                ? normalizeString(
                    ensureObject(source.social, "social").instagramUrl,
                    "social.instagramUrl"
                  )
                : current.social.instagramUrl,
            facebookUrl:
              ensureObject(source.social, "social").facebookUrl !== undefined
                ? normalizeString(
                    ensureObject(source.social, "social").facebookUrl,
                    "social.facebookUrl"
                  )
                : current.social.facebookUrl,
            tiktokUrl:
              ensureObject(source.social, "social").tiktokUrl !== undefined
                ? normalizeString(
                    ensureObject(source.social, "social").tiktokUrl,
                    "social.tiktokUrl"
                  )
                : current.social.tiktokUrl,
          }
        : current.social,
    seo:
      source.seo !== undefined
        ? {
            ...current.seo,
            defaultMetaTitle:
              ensureObject(source.seo, "seo").defaultMetaTitle !== undefined
                ? mergeLocalizedValue(
                    current.seo.defaultMetaTitle,
                    ensureObject(source.seo, "seo").defaultMetaTitle,
                    "seo.defaultMetaTitle"
                  )
                : current.seo.defaultMetaTitle,
            defaultMetaDescription:
              ensureObject(source.seo, "seo").defaultMetaDescription !== undefined
                ? mergeLocalizedValue(
                    current.seo.defaultMetaDescription,
                    ensureObject(source.seo, "seo").defaultMetaDescription,
                    "seo.defaultMetaDescription"
                  )
                : current.seo.defaultMetaDescription,
              defaultOgImageUrl:
                ensureObject(source.seo, "seo").defaultOgImageUrl !== undefined
                  ? normalizeString(
                      ensureObject(source.seo, "seo").defaultOgImageUrl,
                      "seo.defaultOgImageUrl"
                    )
                  : current.seo.defaultOgImageUrl,
              headerLogoUrl:
                ensureObject(source.seo, "seo").headerLogoUrl !== undefined
                  ? normalizeString(
                      ensureObject(source.seo, "seo").headerLogoUrl,
                      "seo.headerLogoUrl"
                    )
                  : current.seo.headerLogoUrl,
              canonicalSiteUrl:
                ensureObject(source.seo, "seo").canonicalSiteUrl !== undefined
                  ? normalizeString(
                    ensureObject(source.seo, "seo").canonicalSiteUrl,
                    "seo.canonicalSiteUrl"
                  )
                : current.seo.canonicalSiteUrl,
          }
        : current.seo,
    home:
      source.home !== undefined
        ? {
            ...current.home,
            heroTitle:
              ensureObject(source.home, "home").heroTitle !== undefined
                ? mergeLocalizedValue(
                    current.home.heroTitle,
                    ensureObject(source.home, "home").heroTitle,
                    "home.heroTitle"
                  )
                : current.home.heroTitle,
            heroSubtitle:
              ensureObject(source.home, "home").heroSubtitle !== undefined
                ? mergeLocalizedValue(
                    current.home.heroSubtitle,
                    ensureObject(source.home, "home").heroSubtitle,
                    "home.heroSubtitle"
                  )
                : current.home.heroSubtitle,
            primaryCtaLabel:
              ensureObject(source.home, "home").primaryCtaLabel !== undefined
                ? mergeLocalizedValue(
                    current.home.primaryCtaLabel,
                    ensureObject(source.home, "home").primaryCtaLabel,
                    "home.primaryCtaLabel"
                  )
                : current.home.primaryCtaLabel,
            secondaryCtaLabel:
              ensureObject(source.home, "home").secondaryCtaLabel !== undefined
                ? mergeLocalizedValue(
                    current.home.secondaryCtaLabel,
                    ensureObject(source.home, "home").secondaryCtaLabel,
                    "home.secondaryCtaLabel"
                  )
                : current.home.secondaryCtaLabel,
            reassuranceText:
              ensureObject(source.home, "home").reassuranceText !== undefined
                ? mergeLocalizedValue(
                    current.home.reassuranceText,
                    ensureObject(source.home, "home").reassuranceText,
                    "home.reassuranceText"
                  )
                : current.home.reassuranceText,
          }
        : current.home,
    blog:
      source.blog !== undefined
        ? {
            ...current.blog,
            introTitle:
              ensureObject(source.blog, "blog").introTitle !== undefined
                ? mergeLocalizedValue(
                    current.blog.introTitle,
                    ensureObject(source.blog, "blog").introTitle,
                    "blog.introTitle"
                  )
                : current.blog.introTitle,
            introText:
              ensureObject(source.blog, "blog").introText !== undefined
                ? mergeLocalizedValue(
                    current.blog.introText,
                    ensureObject(source.blog, "blog").introText,
                    "blog.introText"
                  )
                : current.blog.introText,
          }
        : current.blog,
    contactPage:
      source.contactPage !== undefined
        ? {
            ...current.contactPage,
            pageTitle:
              ensureObject(source.contactPage, "contactPage").pageTitle !== undefined
                ? mergeLocalizedValue(
                    current.contactPage.pageTitle,
                    ensureObject(source.contactPage, "contactPage").pageTitle,
                    "contactPage.pageTitle"
                  )
                : current.contactPage.pageTitle,
            introText:
              ensureObject(source.contactPage, "contactPage").introText !== undefined
                ? mergeLocalizedValue(
                    current.contactPage.introText,
                    ensureObject(source.contactPage, "contactPage").introText,
                    "contactPage.introText"
                  )
                : current.contactPage.introText,
            helperText:
              ensureObject(source.contactPage, "contactPage").helperText !== undefined
                ? mergeLocalizedValue(
                    current.contactPage.helperText,
                    ensureObject(source.contactPage, "contactPage").helperText,
                    "contactPage.helperText"
                  )
                : current.contactPage.helperText,
          }
        : current.contactPage,
    order:
      source.order !== undefined
        ? {
            ...current.order,
            pickupIntroText:
              ensureObject(source.order, "order").pickupIntroText !== undefined
                ? mergeLocalizedValue(
                    current.order.pickupIntroText,
                    ensureObject(source.order, "order").pickupIntroText,
                    "order.pickupIntroText"
                  )
                : current.order.pickupIntroText,
            pickupConfirmationText:
              ensureObject(source.order, "order").pickupConfirmationText !== undefined
                ? mergeLocalizedValue(
                    current.order.pickupConfirmationText,
                    ensureObject(source.order, "order").pickupConfirmationText,
                    "order.pickupConfirmationText"
                  )
                : current.order.pickupConfirmationText,
          }
        : current.order,
    footer:
      source.footer !== undefined
        ? {
            ...current.footer,
            shortText:
              ensureObject(source.footer, "footer").shortText !== undefined
                ? mergeLocalizedValue(
                    current.footer.shortText,
                    ensureObject(source.footer, "footer").shortText,
                    "footer.shortText"
                  )
                : current.footer.shortText,
            legalText:
              ensureObject(source.footer, "footer").legalText !== undefined
                ? mergeLocalizedValue(
                    current.footer.legalText,
                    ensureObject(source.footer, "footer").legalText,
                    "footer.legalText"
                  )
                : current.footer.legalText,
            copyright:
              ensureObject(source.footer, "footer").copyright !== undefined
                ? mergeLocalizedValue(
                    current.footer.copyright,
                    ensureObject(source.footer, "footer").copyright,
                    "footer.copyright"
                  )
                : current.footer.copyright,
          }
        : current.footer,
    announcement:
      source.announcement !== undefined
        ? {
            ...current.announcement,
            enabled:
              ensureObject(source.announcement, "announcement").enabled !== undefined
                ? Boolean(ensureObject(source.announcement, "announcement").enabled)
                : current.announcement.enabled,
            text:
              ensureObject(source.announcement, "announcement").text !== undefined
                ? mergeLocalizedValue(
                    current.announcement.text,
                    ensureObject(source.announcement, "announcement").text,
                    "announcement.text"
                  )
                : current.announcement.text,
            linkUrl:
              ensureObject(source.announcement, "announcement").linkUrl !== undefined
                ? normalizeString(
                    ensureObject(source.announcement, "announcement").linkUrl,
                    "announcement.linkUrl"
                  )
                : current.announcement.linkUrl,
            variant:
              ensureObject(source.announcement, "announcement").variant !== undefined
                ? normalizeString(
                    ensureObject(source.announcement, "announcement").variant,
                    "announcement.variant"
                  )
                : current.announcement.variant,
          }
        : current.announcement,
  };

  if (!next.siteName) {
    throw new Error("siteName is required");
  }

  if (!ANNOUNCEMENT_VARIANTS.has(next.announcement.variant)) {
    throw new Error("announcement.variant must be info, alert or success");
  }

  const saved = await prisma.siteSetting.upsert({
    where: { id: SITE_SETTINGS_SINGLETON_ID },
    update: buildPersistedPayload(next),
    create: {
      id: SITE_SETTINGS_SINGLETON_ID,
      ...buildPersistedPayload(next),
    },
  });

  return formatSiteSettingsRecord(saved);
}

async function translateSiteSettingsToEnglish(payload) {
  const source = formatSiteSettingsRecord(payload);
  const translated = formatSiteSettingsRecord(payload);

  await Promise.all(
    LOCALIZED_TRANSLATION_PATHS.map(async (path) => {
      const localizedValue = getNestedValue(source, path);
      const frenchText = String(localizedValue?.fr || "").trim();
      const currentEnglishText = String(localizedValue?.en || "").trim();
      const englishText = frenchText
        ? await translateFrenchTextToEnglish(frenchText)
        : currentEnglishText;

      setNestedValue(translated, path, {
        fr: frenchText,
        en: englishText,
      });
    })
  );

  return translated;
}

module.exports = {
  DEFAULT_SITE_SETTINGS,
  getAdminSiteSettings,
  getPublicSiteSettings,
  translateSiteSettingsToEnglish,
  updateSiteSettings,
};
