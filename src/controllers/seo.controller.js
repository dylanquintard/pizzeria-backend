const { SITEMAP_CACHE_SECONDS } = require("../lib/env");
const seoService = require("../services/seo.service");

async function getSitemapXml(_req, res) {
  try {
    const xml = await seoService.buildSitemapXml();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      `public, max-age=${SITEMAP_CACHE_SECONDS}, s-maxage=${SITEMAP_CACHE_SECONDS}`
    );
    res.status(200).send(xml);
  } catch (err) {
    res.status(500).json({ error: "Unable to generate sitemap" });
  }
}

module.exports = {
  getSitemapXml,
};
