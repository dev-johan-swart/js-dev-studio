const { URL } = require("url");

const USER_AGENT =
  "Site Rescue Studio Website Health Scanner/2.0";

const FETCH_TIMEOUT = 15000;

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
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

    if (text) {
      results.push(text);
    }
  }

  return results;
}

function getMetaContent(html, name) {
  const regex = new RegExp(
    `<meta\\b[^>]*(?:name|property)\\s*=\\s*["']${name}["'][^>]*>`,
    "i"
  );

  const match = html.match(regex);

  if (!match) {
    return "";
  }

  return getAttribute(match[0], "content");
}

function hasMeta(html, name) {
  return Boolean(getMetaContent(html, name));
}

function finding(
  title,
  description,
  status,
  weight = 1,
  severity = "info"
) {
  return {
    title,
    description,
    status,
    weight,
    severity
  };
}

function calculateWeightedScore(checks) {
  if (!checks.length) {
    return 0;
  }

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const check of checks) {
    totalWeight += check.weight;

    if (check.status === "pass") {
      earnedWeight += check.weight;
    } else if (check.status === "warning") {
      earnedWeight += check.weight * 0.5;
    }
  }

  if (!totalWeight) {
    return 0;
  }

  return Math.round(
    (earnedWeight / totalWeight) * 100
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase();

  const blockedHosts = [
    "localhost",
    "localhost.localdomain",
    "0.0.0.0",
    "127.0.0.1",
    "::1",
    "[::1]"
  ];

  if (blockedHosts.includes(host)) {
    return true;
  }

  if (
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  return false;
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = FETCH_TIMEOUT
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function runPageSpeed(url) {

  const endpoint =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";


  const params =
    new URLSearchParams();


  params.set(
    "url",
    url
  );


  params.set(
    "strategy",
    "mobile"
  );


  params.set(
    "key",
    process.env.PAGESPEED_API_KEY
  );

  console.log(
    "PageSpeed API key loaded:",
    Boolean(process.env.PAGESPEED_API_KEY)
  );
  
  console.log(
    "PageSpeed API key length:",
    process.env.PAGESPEED_API_KEY?.length || 0
  );


  params.append(
    "category",
    "performance"
  );

  params.append(
    "category",
    "accessibility"
  );

  params.append(
    "category",
    "best-practices"
  );

  params.append(
    "category",
    "seo"
  );


  try {

    const response =
      await fetchWithTimeout(
        `${endpoint}?${params.toString()}`,
        {
          headers: {
            "User-Agent":
              USER_AGENT,
            "Accept":
              "application/json"
          }
        },
        30000
      );


    /*
     * Read the response body first.
     *
     * This allows us to see Google's
     * actual error message instead of
     * simply returning "PageSpeed failed".
     */

    const responseText =
      await response.text();


    if (!response.ok) {

      let googleMessage =
        "";


      try {

        const errorData =
          JSON.parse(
            responseText
          );


        googleMessage =
          errorData.error?.message ||
          "";

      } catch {

        // Response wasn't JSON.

      }


      return {

        success: false,

        error:
          googleMessage
            ? `PageSpeed returned HTTP ${response.status}: ${googleMessage}`
            : `PageSpeed returned HTTP ${response.status}.`

      };

    }


    let data;


    try {

      data =
        JSON.parse(
          responseText
        );

    } catch {

      return {

        success: false,

        error:
          "PageSpeed returned an invalid response."

      };

    }


    const lighthouse =
      data.lighthouseResult;


    if (!lighthouse) {

      return {

        success: false,

        error:
          "PageSpeed returned no Lighthouse results."

      };

    }


    const categories =
      lighthouse.categories || {};


    const audits =
      lighthouse.audits || {};


    const performance =
      categories.performance?.score;


    const accessibility =
      categories.accessibility?.score;


    const bestPractices =
      categories["best-practices"]?.score;


    const seo =
      categories.seo?.score;


    /*
     * Make sure the performance score
     * actually exists.
     */

    if (
      typeof performance !==
      "number"
    ) {

      return {

        success: false,

        error:
          "PageSpeed returned no performance score."

      };

    }


    return {

      success: true,


      scores: {

        performance:
          Math.round(
            performance * 100
          ),


        accessibility:
          typeof accessibility ===
          "number"
            ? Math.round(
                accessibility * 100
              )
            : null,


        bestPractices:
          typeof bestPractices ===
          "number"
            ? Math.round(
                bestPractices * 100
              )
            : null,


        seo:
          typeof seo ===
          "number"
            ? Math.round(
                seo * 100
              )
            : null

      },


      vitals: {

        lcp:
          audits[
            "largest-contentful-paint"
          ]?.displayValue ||
          "Not available",


        cls:
          audits[
            "cumulative-layout-shift"
          ]?.displayValue ||
          "Not available",


        inp:
          audits[
            "interaction-to-next-paint"
          ]?.displayValue ||

          audits[
            "experimental-interaction-to-next-paint"
          ]?.displayValue ||

          "Not available",


        fcp:
          audits[
            "first-contentful-paint"
          ]?.displayValue ||
          "Not available",


        tbt:
          audits[
            "total-blocking-time"
          ]?.displayValue ||
          "Not available"

      }

    };


  } catch (error) {

    console.error(
      "PageSpeed error:",
      error
    );


    return {

      success: false,

      error:
        error.name ===
        "AbortError"

          ? "PageSpeed request timed out."

          : `PageSpeed could not be reached: ${
              error.message ||
              "Unknown error"
            }`

    };

  }

}

function buildRecommendation(check) {

  const recommendations = {

    "Missing page title": {
      why:
        "The page does not have a clear title for search engines and visitors.",
      action:
        "Add a unique, descriptive title that explains the page and business.",
      service:
        "SEO optimisation"
    },

    "Title length": {
      why:
        "Very short or very long titles may be less effective in search results.",
      action:
        "Create a concise title that clearly describes the page and its main service.",
      service:
        "SEO optimisation"
    },

    "Missing meta description": {
      why:
        "Search engines may have less useful information when generating search-result snippets.",
      action:
        "Add a unique description summarising the page, service and location where relevant.",
      service:
        "SEO optimisation"
    },

    "Missing H1": {
      why:
        "The page lacks a clear primary heading describing its main purpose.",
      action:
        "Add one prominent H1 that clearly describes the page.",
      service:
        "Content and SEO optimisation"
    },

    "Multiple H1 headings": {
      why:
        "Multiple primary headings can make the page structure less clear.",
      action:
        "Review the heading hierarchy and use one clear primary H1.",
      service:
        "SEO and content optimisation"
    },

    "Missing canonical URL": {
      why:
        "Search engines may have less guidance about the preferred version of the page.",
      action:
        "Add a canonical link pointing to the preferred page URL.",
      service:
        "Technical SEO"
    },

    "Missing Open Graph metadata": {
      why:
        "Social platforms may generate less useful previews when the page is shared.",
      action:
        "Add Open Graph title, description and image metadata.",
      service:
        "Social and SEO optimisation"
    },

    "Structured data": {
      why:
        "Structured data can help search engines understand important information about a page or business.",
      action:
        "Add appropriate JSON-LD structured data such as LocalBusiness or Organization markup.",
      service:
        "Technical SEO"
    },

    "Heading structure": {
      why:
        "Clear heading structure helps visitors and search engines understand the content hierarchy.",
      action:
        "Use logical H1, H2 and H3 headings throughout the page.",
      service:
        "Content optimisation"
    },

    "Images missing alt text": {
      why:
        "Images without useful alternative text can reduce accessibility.",
      action:
        "Add meaningful alt text to informative images and mark decorative images appropriately.",
      service:
        "Accessibility optimisation"
    },

    "Empty links": {
      why:
        "Links without an accessible name can be difficult for assistive technologies to understand.",
      action:
        "Give icon and image links a clear accessible name.",
      service:
        "Accessibility optimisation"
    },

    "Missing document language": {
      why:
        "Assistive technologies use the document language to interpret page content correctly.",
      action:
        "Add the appropriate lang attribute to the HTML element.",
      service:
        "Accessibility optimisation"
    },

    "Missing viewport": {
      why:
        "Without a responsive viewport configuration, mobile browsers may not display the page correctly.",
      action:
        "Add a responsive viewport meta tag.",
      service:
        "Mobile optimisation"
    },

    "HTTPS": {
      why:
        "HTTPS protects visitors and is an important baseline for a modern website.",
      action:
        "Configure the website to use HTTPS across all pages.",
      service:
        "Website security"
    },

    "Server response time": {
      why:
        "Slow server responses can delay the beginning of page loading.",
      action:
        "Review hosting, caching, server configuration and backend requests.",
      service:
        "Performance optimisation"
    },

    "Mixed content": {
      why:
        "HTTP resources on an HTTPS page can create security and browser warnings.",
      action:
        "Update insecure HTTP resources to HTTPS.",
      service:
        "Website security"
    },

    "Favicon": {
      why:
        "A favicon helps identify the website in browser tabs and bookmarks.",
      action:
        "Add a properly configured favicon.",
      service:
        "Website polish"
    },

    "Phone number": {
      why:
        "Customers may struggle to contact the business quickly if no phone number is visible.",
      action:
        "Add a clearly visible click-to-call phone number.",
      service:
        "Conversion optimisation"
    },

    "Email address": {
      why:
        "A visible email option provides another direct way for customers to contact the business.",
      action:
        "Add a clearly visible business email address.",
      service:
        "Conversion optimisation"
    },

    "WhatsApp": {
      why:
        "WhatsApp can provide a convenient direct contact channel for customers.",
      action:
        "Consider adding a clearly labelled WhatsApp contact option where appropriate.",
      service:
        "Conversion optimisation"
    },

    "Business location": {
      why:
        "Location information helps local customers understand where the business operates.",
      action:
        "Display the service area or business location clearly and consider appropriate local structured data.",
      service:
        "Local SEO"
    },

    "Contact form": {
      why:
        "Without an easy enquiry method, potential customers may leave without contacting the business.",
      action:
        "Add a simple contact or quote-request form.",
      service:
        "Conversion optimisation"
    },

    "Call to action": {
      why:
        "Visitors need a clear next step if the website is expected to generate enquiries.",
      action:
        "Add clear calls to action such as Request a Quote, Book Now or Contact Us.",
      service:
        "Conversion optimisation"
    }
  };

  const recommendation =
    recommendations[check.title];

  if (!recommendation) {
    return null;
  }

  return {
    title:
      check.title,

    severity:
      check.severity,

    status:
      check.status,

    why:
      recommendation.why,

    action:
      recommendation.action,

    service:
      recommendation.service
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

    if (
      !url ||
      typeof url !== "string"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Please provide a website URL."
      });
    }

    let targetUrl;

    try {
      targetUrl = new URL(
        url.startsWith("http://") ||
        url.startsWith("https://")
          ? url
          : `https://${url}`
      );
    } catch {
      return res.status(400).json({
        success: false,
        error:
          "That does not appear to be a valid website URL."
      });
    }

    if (
      !["http:", "https:"].includes(
        targetUrl.protocol
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Only HTTP and HTTPS websites can be scanned."
      });
    }

    if (
      isBlockedHostname(
        targetUrl.hostname
      )
    ) {
      return res.status(400).json({
        success: false,
        error:
          "That website address cannot be scanned."
      });
    }

    const started =
      Date.now();

    const response =
      await fetchWithTimeout(
        targetUrl.href,
        {
          redirect: "follow",

          headers: {
            "User-Agent":
              USER_AGENT,

            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        }
      );

    const responseTime =
      Date.now() - started;

    const html =
      await response.text();

    if (!html) {
      return res.status(422).json({
        success: false,
        error:
          "The website returned an empty response."
      });
    }

    const finalUrl =
      response.url ||
      targetUrl.href;

    /*
     * BASIC HTML ANALYSIS
     */

    const titleMatches =
      extractTextBetween(
        html,
        "title"
      );

    const title =
      titleMatches[0] || "";

    const description =
      getMetaContent(
        html,
        "description"
      );

    const viewport =
      getMetaContent(
        html,
        "viewport"
      );

    const h1s =
      extractTextBetween(
        html,
        "h1"
      );

    const h2s =
      extractTextBetween(
        html,
        "h2"
      );

    const images =
      extractTags(
        html,
        "img"
      );

    const links =
      extractTags(
        html,
        "a"
      );

    const scripts =
      extractTags(
        html,
        "script"
      );

    const stylesheets =
      (
        html.match(
          /<link\b[^>]*rel\s*=\s*["'][^"']*stylesheet[^"']*["'][^>]*>/gi
        ) || []
      );

    const canonicalMatch =
      html.match(
        /<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/i
      );

    const canonical =
      canonicalMatch
        ? getAttribute(
            canonicalMatch[0],
            "href"
          )
        : "";

    const languageMatch =
      html.match(
        /<html\b[^>]*lang\s*=\s*["']([^"']+)["']/i
      );

    const language =
      languageMatch
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
      /wa\.me|whatsapp/i.test(
        html
      );

    const hasAddress =
      /\b(street|road|avenue|ave|drive|close|centurion|pretoria|gauteng|south africa)\b/i.test(
        html
      );

    const hasForm =
      /<form\b/i.test(
        html
      );

    const hasCTA =
      /\b(contact|book|quote|get started|call us|request|enquire|learn more)\b/i.test(
        html
      );

    const hasOpenGraph =
      hasMeta(html, "og:title") ||
      hasMeta(html, "og:description");

    const mixedContent =
      targetUrl.protocol === "https:" &&
      /(?:src|href)\s*=\s*["']http:\/\//i.test(
        html
      );

    let imagesWithoutAlt = 0;

    for (const image of images) {
      if (
        !getAttribute(
          image,
          "alt"
        )
      ) {
        imagesWithoutAlt++;
      }
    }

    let emptyLinks = 0;

    for (const link of links) {

        const href =
          getAttribute(
            link,
            "href"
          );
      
        const ariaLabel =
          getAttribute(
            link,
            "aria-label"
          );
      
        const title =
          getAttribute(
            link,
            "title"
          );
      
        const role =
          getAttribute(
            link,
            "role"
          );
      
        const visibleText =
          cleanText(
            link
              .replace(
                /<svg[\s\S]*?<\/svg>/gi,
                " "
              )
              .replace(
                /<[^>]+>/g,
                " "
              )
          );
      
        const hasImage =
          /<img\b/i.test(
            link
          );
      
        const hasAltText =
          hasImage &&
          /\balt\s*=\s*["'][^"']+["']/i.test(
            link
          );
      
        const hasAccessibleName =
          Boolean(
            visibleText ||
            ariaLabel ||
            title ||
            hasAltText ||
            role === "button"
          );
      
        if (
          href &&
          !hasAccessibleName
        ) {
          emptyLinks++;
        }
      }

    /*
     * SEO
     */

    const seoChecks = [];

    seoChecks.push(
      title
        ? finding(
            "Page title",
            `Title found: "${title.slice(0, 100)}"`,
            "pass",
            20
          )
        : finding(
            "Missing page title",
            "Add a unique and descriptive title element.",
            "fail",
            20,
            "high"
          )
    );

    seoChecks.push(
      title.length >= 30 &&
      title.length <= 65
        ? finding(
            "Title length",
            "The title length is within a useful range.",
            "pass",
            10
          )
        : finding(
            "Title length",
            `Current title length: ${title.length} characters.`,
            "warning",
            10,
            "medium"
          )
    );

    seoChecks.push(
      description
        ? finding(
            "Meta description",
            "A meta description was found.",
            "pass",
            15
          )
        : finding(
            "Missing meta description",
            "Add a useful description of the page.",
            "fail",
            15,
            "high"
          )
    );

    seoChecks.push(
      h1s.length === 1
        ? finding(
            "Single H1",
            "Exactly one H1 heading was found.",
            "pass",
            15
          )
        : h1s.length === 0
        ? finding(
            "Missing H1",
            "Add one clear primary H1 heading.",
            "fail",
            15,
            "high"
          )
        : finding(
            "Multiple H1 headings",
            `${h1s.length} H1 headings were found.`,
            "warning",
            15,
            "medium"
          )
    );

    seoChecks.push(
      canonical
        ? finding(
            "Canonical URL",
            "A canonical URL was found.",
            "pass",
            10
          )
        : finding(
            "Missing canonical URL",
            "Consider adding a canonical URL.",
            "warning",
            10,
            "low"
          )
    );

    seoChecks.push(
      hasOpenGraph
        ? finding(
            "Social sharing metadata",
            "Open Graph metadata was found.",
            "pass",
            5
          )
        : finding(
            "Missing Open Graph metadata",
            "Add Open Graph metadata for social sharing.",
            "warning",
            5,
            "low"
          )
    );

    seoChecks.push(
      hasStructuredData
        ? finding(
            "Structured data",
            "JSON-LD structured data was found.",
            "pass",
            15
          )
        : finding(
            "Structured data",
            "No JSON-LD structured data was detected.",
            "warning",
            15,
            "medium"
          )
    );

    seoChecks.push(
      h2s.length > 0
        ? finding(
            "Heading structure",
            `${h2s.length} H2 heading(s) detected.`,
            "pass",
            10
          )
        : finding(
            "Heading structure",
            "No H2 headings were detected.",
            "warning",
            10,
            "low"
          )
    );

    /*
     * ACCESSIBILITY
     */

    const accessibilityChecks = [];

    accessibilityChecks.push(
      language
        ? finding(
            "Document language",
            `HTML language is set to "${language}".`,
            "pass",
            20
          )
        : finding(
            "Missing document language",
            "Add a lang attribute to the HTML element.",
            "warning",
            20,
            "medium"
          )
    );

    accessibilityChecks.push(
      imagesWithoutAlt === 0
        ? finding(
            "Image alternative text",
            "All detected images have alt attributes.",
            "pass",
            35
          )
        : finding(
            "Images missing alt text",
            `${imagesWithoutAlt} image(s) do not have alt text.`,
            "fail",
            35,
            "high"
          )
    );

    accessibilityChecks.push(
      emptyLinks === 0
        ? finding(
            "Link accessibility",
            "No obvious empty links were detected.",
            "pass",
            25
          )
        : finding(
            "Empty links",
            `${emptyLinks} link(s) appear to have no accessible text.`,
            "warning",
            25,
            "medium"
          )
    );

    accessibilityChecks.push(
      viewport
        ? finding(
            "Responsive viewport",
            "A responsive viewport was detected.",
            "pass",
            20
          )
        : finding(
            "Missing viewport",
            "Add a responsive viewport meta tag.",
            "fail",
            20,
            "high"
          )
    );

    /*
     * TECHNICAL
     */

    const technicalChecks = [];

    technicalChecks.push(
      targetUrl.protocol === "https:"
        ? finding(
            "HTTPS",
            "The website uses HTTPS.",
            "pass",
            25
          )
        : finding(
            "HTTPS",
            "The website is not using HTTPS.",
            "fail",
            25,
            "high"
          )
    );

    technicalChecks.push(
      response.ok
        ? finding(
            "HTTP response",
            `The page returned HTTP ${response.status}.`,
            "pass",
            20
          )
        : finding(
            "HTTP response",
            `The page returned HTTP ${response.status}.`,
            "fail",
            20,
            "high"
          )
    );

    technicalChecks.push(
      responseTime < 1000
        ? finding(
            "Server response time",
            `Initial response took ${responseTime}ms.`,
            "pass",
            25
          )
        : responseTime < 2000
        ? finding(
            "Server response time",
            `Initial response took ${responseTime}ms.`,
            "warning",
            25,
            "medium"
          )
        : finding(
            "Server response time",
            `Initial response took ${responseTime}ms.`,
            "fail",
            25,
            "high"
          )
    );

    technicalChecks.push(
      !mixedContent
        ? finding(
            "Mixed content",
            "No obvious HTTP resources were detected.",
            "pass",
            15
          )
        : finding(
            "Mixed content",
            "HTTP resources were detected on an HTTPS page.",
            "fail",
            15,
            "high"
          )
    );

    technicalChecks.push(
      hasFavicon
        ? finding(
            "Favicon",
            "A favicon was detected.",
            "pass",
            5
          )
        : finding(
            "Favicon",
            "No favicon was detected.",
            "warning",
            5,
            "low"
          )
    );

    /*
     * BUSINESS
     */

    const businessChecks = [];

    businessChecks.push(
      hasPhone
        ? finding(
            "Phone number",
            "A phone number was detected.",
            "pass",
            20
          )
        : finding(
            "Phone number",
            "No obvious phone number was detected.",
            "warning",
            20,
            "medium"
          )
    );

    businessChecks.push(
      hasEmail
        ? finding(
            "Email address",
            "An email address was detected.",
            "pass",
            15
          )
        : finding(
            "Email address",
            "No obvious email address was detected.",
            "warning",
            15,
            "medium"
          )
    );

    businessChecks.push(
      hasWhatsApp
        ? finding(
            "WhatsApp",
            "A WhatsApp reference was detected.",
            "pass",
            10
          )
        : finding(
            "WhatsApp",
            "No WhatsApp link was detected.",
            "warning",
            10,
            "low"
          )
    );

    businessChecks.push(
      hasAddress
        ? finding(
            "Business location",
            "Location information was detected.",
            "pass",
            15
          )
        : finding(
            "Business location",
            "No obvious business location was detected.",
            "warning",
            15,
            "medium"
          )
    );

    businessChecks.push(
      hasForm
        ? finding(
            "Contact form",
            "A form was detected.",
            "pass",
            20
          )
        : finding(
            "Contact form",
            "No HTML contact form was detected.",
            "warning",
            20,
            "medium"
          )
    );

    businessChecks.push(
      hasCTA
        ? finding(
            "Call to action",
            "Conversion-focused wording was detected.",
            "pass",
            20
          )
        : finding(
            "Call to action",
            "No obvious call-to-action wording was detected.",
            "warning",
            20,
            "medium"
          )
    );

    /*
     * PAGESPEED / LIGHTHOUSE
     */

    const pageSpeed =
      await runPageSpeed(
        finalUrl
      );

    /*
     * SCORES
     */

    const htmlSeoScore =
      calculateWeightedScore(
        seoChecks
      );

    const htmlAccessibilityScore =
      calculateWeightedScore(
        accessibilityChecks
      );

    const technicalScore =
      calculateWeightedScore(
        technicalChecks
      );

    const businessScore =
      calculateWeightedScore(
        businessChecks
      );

    const seoScore =
      pageSpeed.success
        ? Math.round(
            htmlSeoScore * 0.4 +
            pageSpeed.scores.seo * 0.6
          )
        : htmlSeoScore;

    const accessibilityScore =
      pageSpeed.success
        ? Math.round(
            htmlAccessibilityScore * 0.4 +
            pageSpeed.scores.accessibility * 0.6
          )
        : htmlAccessibilityScore;

    const performanceScore =
      pageSpeed.success
        ? pageSpeed.scores.performance
        : null;

        const mobileScore =
          viewport
            ? 100
            : 0;

        let overall;

        if (performanceScore !== null) {
        
          overall = Math.round(
            seoScore * 0.25 +
            performanceScore * 0.20 +
            accessibilityScore * 0.10 +
            technicalScore * 0.15 +
            businessScore * 0.30
          );
        
        } else {
        
          overall = Math.round(
            seoScore * 0.30 +
            accessibilityScore * 0.10 +
            technicalScore * 0.20 +
            businessScore * 0.40
          );
        
        }

    /*
     * PRIORITY ISSUES
     */

    const allChecks = [
      ...seoChecks,
      ...accessibilityChecks,
      ...technicalChecks,
      ...businessChecks
    ];

    const issues =
      allChecks
        .filter(
          check =>
            check.status === "fail" ||
            check.status === "warning"
        )
        .sort(
          (a, b) => {

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
          }
        )
        .slice(0, 12);

        const recommendations =
          issues
            .map(
              issue =>
                buildRecommendation(
                  issue
                )
            )
            .filter(Boolean);

    /*
     * RESPONSE
     */

    return res.status(200).json({

      success: true,

      scannerVersion: "2.0",

      scannedAt:
        new Date().toISOString(),

      url:
        targetUrl.href,

      finalUrl,

      responseTime,

      statusCode:
        response.status,

      pageSize:
        Buffer.byteLength(
          html,
          "utf8"
        ),

      counts: {
        images: images.length,
        imagesWithoutAlt,
        links: links.length,
        scripts: scripts.length,
        stylesheets:
          stylesheets.length,
        h1: h1s.length,
        h2: h2s.length
      },

      scores: {
        overall,
        seo: seoScore,
        performance:
          performanceScore,
        mobile: mobileScore,
        accessibility:
          accessibilityScore,
        technical:
          technicalScore,
        business:
          businessScore
      },

      pageSpeed: {
        available:
          pageSpeed.success,

        error:
          pageSpeed.error || null,

        scores:
          pageSpeed.success
            ? pageSpeed.scores
            : null,

        vitals:
          pageSpeed.success
            ? pageSpeed.vitals
            : null
      },

      checks: {
        seo: seoChecks,
        accessibility:
          accessibilityChecks,
        technical:
          technicalChecks,
        business:
          businessChecks
      },

      issues,

      recommendations,

      metadata: {
        title,
        description,
        viewport,
        canonical,
        language,
        h1s,
        h2s
      }
    });

  } catch (error) {

    console.error(
      "Scanner error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.name === "AbortError"
          ? "The website took too long to respond."
          : "We could not scan this website. It may be unavailable or blocking automated requests."
    });
  }
};