const test = require("node:test");
const assert = require("node:assert/strict");

const { DEFAULT_SITE_SETTINGS } = require("../src/services/site-settings.service");

test("site settings defaults no longer expose legacy Pizza Truck branding", () => {
  assert.equal(DEFAULT_SITE_SETTINGS.siteName, "Camion Pizza Italienne");
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.seo.defaultMetaTitle.fr, /Pizza Truck/i);
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.seo.defaultMetaDescription.fr, /Pizza Truck/i);
});

test("site settings defaults no longer hardcode Metz in generic service area copy", () => {
  assert.equal(DEFAULT_SITE_SETTINGS.contact.serviceArea.fr, "Moselle et alentours");
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.siteDescription.fr, /Metz/i);
  assert.doesNotMatch(DEFAULT_SITE_SETTINGS.home.heroSubtitle.fr, /Metz/i);
});
