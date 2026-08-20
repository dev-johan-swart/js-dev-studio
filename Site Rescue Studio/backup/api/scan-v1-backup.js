const { URL } = require("url");

const USER_AGENT =
  "Site Rescue Studio Website Health Scanner/1.0 (+https://site-rescue-studio.vercel.app/)";

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteUrl(baseUrl, value) {
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function getAttribute(tag, attribute) {
  const regex = new RegExp(
    `${attribute}\\s*=\\s*["']([^"']*)["']`,
    "i"
  );

  const match = tag.match(regex);

  return match ? cleanText(match[1]) : "";
}

function extractTags(html, tagName) {
  const regex = new RegExp(
    `<${tagName}\\b[^>]*>`,
    "gi"
  );

  return html.match(regex) || [];
}

function extractTextBetween(html, tagName) {
  const regex = new RegExp(
    `<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "gi"
  );

  const results = [];

  let match;

  while ((match = regex.exec(html)) !== null) {
    const text = cleanText(
      match[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
    );

    if (text) results.push(text);
  }

  return results;
}

function hasMeta(html, name) {
  const regex = new RegExp(
    `<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`,
    "i"
  );

  return regex.test(html);
}

function getMetaContent(html, name) {
  const regex = new RegExp(
    `<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`,
    "i"
  );

  const match = html.match(regex);

  if (!match) return "";

  return getAttribute(match[0], "content");
}

function calculateScore(checks) {
  const passed = checks.filter((check) => check.status === "pass").length;
  const total = checks.length;

  if (!total) return 0;

  return Math.round((passed / total) * 100);
}

function finding(
  title,
  description,
  status,
  severity = "info"
) {
  return {
    title,
    description,
    status,
    severity
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });
  }

  try {
    const { url } = req.body || {};

    if (!url || typeof url !== "string") {
      return res.status(400).json({
        success: false,
        error: "Please provide a website URL."
      });
    }

    let targetUrl;

    try {
      targetUrl = new URL(
        url.startsWith("http://") || url.startsWith("https://")
          ? url
          : `https://${url}`
      );
    } catch {
      return res.status(400).json({
        success: false,
        error: "That does not appear to be a valid website URL."
      });
    }

    if (!["http:", "https:"].includes(targetUrl.protocol)) {
      return res.status(400).json({
        success: false,
        error: "Only HTTP and HTTPS websites can be scanned."
      });
    }

    const started = Date.now();

    const response = await fetch(targetUrl.href, {
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const html = await response.text();

    const responseTime = Date.now() - started;

    if (!html) {
      return res.status(422).json({
        success: false,
        error: "The website returned an empty response."
      });
    }

    const finalUrl = response.url || targetUrl.href;

    const titleMatches = extractTextBetween(html, "title");
    const title = titleMatches[0] || "";

    const description = getMetaContent(
      html,
      "description"
    );

    const viewport = getMetaContent(
      html,
      "viewport"
    );

    const h1s = extractTextBetween(html, "h1");

    const h2s = extractTextBetween(html, "h2");

    const images = extractTags(html, "img");

    const links = extractTags(html, "a");

    const scripts = extractTags(html, "script");

    const stylesheets = (
      html.match(
        /<link\b[^>]*rel\s*=\s*["'][^"']*stylesheet[^"']*["'][^>]*>/gi
      ) || []
    );

    const canonicalMatch = html.match(
      /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i
    );

    const canonical = canonicalMatch
      ? getAttribute(canonicalMatch[0], "href")
      : "";

    const robotsMeta = getMetaContent(
      html,
      "robots"
    );

    const languageMatch = html.match(
      /<html\b[^>]*lang\s*=\s*["']([^"']+)["']/i
    );

    const language = languageMatch
      ? languageMatch[1]
      : "";

    const hasStructuredData =
      /<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(
        html
      );

    const hasFavicon =
      /<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["']/i.test(
        html
      );

    const hasPhone =
      /(?:\+27|0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}/i.test(
        html
      );

    const hasEmail =
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(
        html
      );

    const hasWhatsApp =
      /wa\.me|whatsapp/i.test(html);

    const hasAddress =
      /\b(street|road|avenue|ave|drive|close|centurion|pretoria|gauteng|south africa)\b/i.test(
        html
      );

    const hasForm =
      /<form\b/i.test(html);

    const hasCTA =
      /\b(contact|book|quote|get started|call us|request|enquire|learn more)\b/i.test(
        html
      );

    const hasOpenGraph =
      hasMeta(html, "og:title") ||
      hasMeta(html, "og:description");

    const mixedContent =
      targetUrl.protocol === "https:" &&
      /(?:src|href)\s*=\s*["']http:\/\//i.test(html);

    /*
     * IMAGE ALT CHECK
     */

    let imagesWithoutAlt = 0;

    for (const image of images) {
      const alt = getAttribute(image, "alt");

      if (!alt) {
        imagesWithoutAlt++;
      }
    }

    /*
     * LINK ACCESSIBILITY CHECK
     */

    let emptyLinks = 0;

    for (const link of links) {
      const href = getAttribute(link, "href");

      const visibleText = cleanText(
        link
          .replace(/<svg[\s\S]*?<\/svg>/gi, "")
          .replace(/<[^>]+>/g, " ")
      );

      const ariaLabel = getAttribute(
        link,
        "aria-label"
      );

      if (
        href &&
        !visibleText &&
        !ariaLabel
      ) {
        emptyLinks++;
      }
    }

    /*
     * SEO CHECKS
     */

    const seoChecks = [];

    seoChecks.push(
      title
        ? finding(
            "Page title",
            `Title found: "${title.slice(0, 100)}"`,
            "pass"
          )
        : finding(
            "Missing page title",
            "Add a unique and descriptive <title> element.",
            "fail",
            "high"
          )
    );

    seoChecks.push(
      title.length >= 30 && title.length <= 65
        ? finding(
            "Title length",
            "The title length is within a useful SEO range.",
            "pass"
          )
        : finding(
            "Title length",
            `Current title length: ${title.length} characters.`,
            "warning",
            "medium"
          )
    );

    seoChecks.push(
      description
        ? finding(
            "Meta description",
            "A meta description was found.",
            "pass"
          )
        : finding(
            "Missing meta description",
            "Add a useful meta description describing the page.",
            "fail",
            "high"
          )
    );

    seoChecks.push(
      h1s.length === 1
        ? finding(
            "Single H1",
            "Exactly one H1 heading was found.",
            "pass"
          )
        : h1s.length === 0
        ? finding(
            "Missing H1",
            "Add one clear primary H1 heading.",
            "fail",
            "high"
          )
        : finding(
            "Multiple H1 headings",
            `${h1s.length} H1 headings were found.`,
            "warning",
            "medium"
          )
    );

    seoChecks.push(
      canonical
        ? finding(
            "Canonical URL",
            "A canonical URL was found.",
            "pass"
          )
        : finding(
            "Missing canonical URL",
            "Consider adding a canonical URL to important pages.",
            "warning",
            "low"
          )
    );

    seoChecks.push(
      hasOpenGraph
        ? finding(
            "Social sharing metadata",
            "Open Graph metadata was found.",
            "pass"
          )
        : finding(
            "Missing Open Graph metadata",
            "Add Open Graph metadata for better social sharing.",
            "warning",
            "low"
          )
    );

    seoChecks.push(
      hasStructuredData
        ? finding(
            "Structured data",
            "JSON-LD structured data was found.",
            "pass"
          )
        : finding(
            "Structured data",
            "No JSON-LD structured data was detected.",
            "warning",
            "medium"
          )
    );

    /*
     * MOBILE CHECKS
     */

    const mobileChecks = [];

    mobileChecks.push(
      viewport
        ? finding(
            "Viewport configuration",
            "A responsive viewport meta tag was found.",
            "pass"
          )
        : finding(
            "Missing viewport",
            "Add a responsive viewport meta tag.",
            "fail",
            "high"
          )
    );

    /*
     * ACCESSIBILITY CHECKS
     */

    const accessibilityChecks = [];

    accessibilityChecks.push(
      language
        ? finding(
            "Document language",
            `HTML language is set to "${language}".`,
            "pass"
          )
        : finding(
            "Missing document language",
            "Add a lang attribute to the HTML element.",
            "warning",
            "medium"
          )
    );

    accessibilityChecks.push(
      imagesWithoutAlt === 0
        ? finding(
            "Image alternative text",
            "All detected images have alt attributes.",
            "pass"
          )
        : finding(
            "Images missing alt text",
            `${imagesWithoutAlt} image(s) do not have alt text.`,
            "fail",
            "high"
          )
    );

    accessibilityChecks.push(
      emptyLinks === 0
        ? finding(
            "Link accessibility",
            "No obvious empty links were detected.",
            "pass"
          )
        : finding(
            "Empty links",
            `${emptyLinks} link(s) appear to have no accessible text.`,
            "warning",
            "medium"
          )
    );

    /*
     * TECHNICAL CHECKS
     */

    const technicalChecks = [];

    technicalChecks.push(
      targetUrl.protocol === "https:"
        ? finding(
            "HTTPS",
            "The scanned URL uses HTTPS.",
            "pass"
          )
        : finding(
            "HTTPS",
            "The scanned URL is not using HTTPS.",
            "fail",
            "high"
          )
    );

    technicalChecks.push(
      response.ok
        ? finding(
            "HTTP response",
            `The page returned HTTP ${response.status}.`,
            "pass"
          )
        : finding(
            "HTTP response",
            `The page returned HTTP ${response.status}.`,
            "warning",
            "high"
          )
    );

    technicalChecks.push(
      mixedContent
        ? finding(
            "Mixed content",
            "HTTP resources were detected on an HTTPS page.",
            "fail",
            "high"
          )
        : finding(
            "Mixed content",
            "No obvious HTTP resources were detected on this HTTPS page.",
            "pass"
          )
    );

    technicalChecks.push(
      hasFavicon
        ? finding(
            "Favicon",
            "A favicon was detected.",
            "pass"
          )
        : finding(
            "Favicon",
            "No favicon was detected.",
            "warning",
            "low"
          )
    );

    /*
     * BUSINESS CHECKS
     */

    const businessChecks = [];

    businessChecks.push(
      hasPhone
        ? finding(
            "Phone number",
            "A phone number was detected.",
            "pass"
          )
        : finding(
            "Phone number",
            "No obvious phone number was detected.",
            "warning",
            "medium"
          )
    );

    businessChecks.push(
      hasEmail
        ? finding(
            "Email address",
            "An email address was detected.",
            "pass"
          )
        : finding(
            "Email address",
            "No obvious email address was detected.",
            "warning",
            "medium"
          )
    );

    businessChecks.push(
      hasWhatsApp
        ? finding(
            "WhatsApp",
            "A WhatsApp link or reference was detected.",
            "pass"
          )
        : finding(
            "WhatsApp",
            "No WhatsApp link was detected.",
            "info",
            "low"
          )
    );

    businessChecks.push(
      hasAddress
        ? finding(
            "Business location",
            "Location/address signals were detected.",
            "pass"
          )
        : finding(
            "Business location",
            "No obvious physical location information was detected.",
            "warning",
            "medium"
          )
    );

    businessChecks.push(
      hasForm
        ? finding(
            "Contact form",
            "A form was detected.",
            "pass"
          )
        : finding(
            "Contact form",
            "No HTML form was detected.",
            "warning",
            "medium"
          )
    );

    businessChecks.push(
      hasCTA
        ? finding(
            "Call to action",
            "Conversion-focused wording was detected.",
            "pass"
          )
        : finding(
            "Call to action",
            "No obvious call-to-action wording was detected.",
            "warning",
            "medium"
          )
    );

    /*
     * SCORES
     */

    const scores = {
      seo: calculateScore(seoChecks),
      mobile: calculateScore(mobileChecks),
      accessibility: calculateScore(
        accessibilityChecks
      ),
      technical: calculateScore(
        technicalChecks
      ),
      business: calculateScore(
        businessChecks
      )
    };

    const overall = Math.round(
      (
        scores.seo +
        scores.mobile +
        scores.accessibility +
        scores.technical +
        scores.business
      ) / 5
    );

    /*
     * PRIORITY FINDINGS
     */

    const allChecks = [
      ...seoChecks,
      ...mobileChecks,
      ...accessibilityChecks,
      ...technicalChecks,
      ...businessChecks
    ];

    const issues = allChecks
      .filter(
        (check) =>
          check.status === "fail" ||
          check.status === "warning"
      )
      .sort((a, b) => {
        const priority = {
          high: 3,
          medium: 2,
          low: 1,
          info: 0
        };

        return (
          (priority[b.severity] || 0) -
          (priority[a.severity] || 0)
        );
      });

    /*
     * RESULT
     */

    return res.status(200).json({
      success: true,

      scannedAt: new Date().toISOString(),

      url: targetUrl.href,

      finalUrl,

      responseTime,

      statusCode: response.status,

      pageSize: Buffer.byteLength(
        html,
        "utf8"
      ),

      counts: {
        images: images.length,
        imagesWithoutAlt,
        links: links.length,
        scripts: scripts.length,
        stylesheets: stylesheets.length,
        h1: h1s.length,
        h2: h2s.length
      },

      scores: {
        overall,
        ...scores
      },

      checks: {
        seo: seoChecks,
        mobile: mobileChecks,
        accessibility: accessibilityChecks,
        technical: technicalChecks,
        business: businessChecks
      },

      issues: issues.slice(0, 10),

      metadata: {
        title,
        description,
        viewport,
        canonical,
        language,
        robots: robotsMeta,
        h1s,
        h2s
      }
    });
  } catch (error) {
    console.error("Scanner error:", error);

    return res.status(500).json({
      success: false,
      error:
        "We could not scan this website. The website may be unavailable, blocking automated requests, or taking too long to respond."
    });
  }
};