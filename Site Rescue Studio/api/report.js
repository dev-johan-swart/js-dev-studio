const PDFDocument = require("pdfkit");


module.exports = async function handler(req, res) {

  if (req.method !== "POST") {

    return res.status(405).json({
      success: false,
      error: "Method not allowed."
    });

  }


  try {

    const data = req.body;


    if (!data) {

      return res.status(400).json({
        success: false,
        error: "No report data was provided."
      });

    }


    const {
      url,
      scores,
      recommendations,
      metadata,
      issues
    } = data;


    if (!url || !scores) {

      return res.status(400).json({
        success: false,
        error:
          "The report requires a website URL and health scores."
      });

    }


    const doc =
      new PDFDocument({
        size: "A4",
        margin: 50
      });


    const chunks = [];


    doc.on("data", chunk => {
      chunks.push(chunk);
    });


    const pdfFinished =
      new Promise((resolve, reject) => {

        doc.on("end", resolve);
        doc.on("error", reject);

      });


    /*
     * --------------------------------
     * COVER
     * --------------------------------
     */

    doc
      .fontSize(28)
      .text(
        "SITE RESCUE STUDIO",
        {
          align: "center"
        }
      );


    doc.moveDown(2);


    doc
      .fontSize(24)
      .text(
        "Website Rescue Report",
        {
          align: "center"
        }
      );


    doc.moveDown();


    doc
      .fontSize(14)
      .text(
        cleanUrl(url),
        {
          align: "center"
        }
      );


    doc.moveDown(2);


    doc
      .fontSize(48)
      .text(
        `${scoreValue(scores.overall)}/100`,
        {
          align: "center"
        }
      );


    doc.moveDown();


    doc
      .fontSize(18)
      .text(
        getOverallLabel(
          scores.overall
        ),
        {
          align: "center"
        }
      );


    doc.moveDown(2);


    doc
      .fontSize(10)
      .text(
        `Generated ${formatDate()}`,
        {
          align: "center"
        }
      );


    doc.moveDown(3);


    doc
      .fontSize(11)
      .text(
        "Fix. Improve. Grow.",
        {
          align: "center"
        }
      );


    /*
     * --------------------------------
     * PAGE 2
     * OVERVIEW
     * --------------------------------
     */

    doc.addPage();


    heading(
      doc,
      "Website Health Overview"
    );


    doc
      .fontSize(11)
      .text(
        "This report summarises the results of your Site Rescue Studio website health assessment and highlights the areas that may benefit from improvement."
      );


    doc.moveDown(2);


    const scoreRows = [
      ["Overall", scores.overall],
      ["SEO", scores.seo],
      ["Mobile", scores.mobile],
      ["Accessibility", scores.accessibility],
      ["Technical", scores.technical],
      ["Business", scores.business],
      ["Performance", scores.performance]
    ];
    
    
    const scoreBoxWidth = 245;
    const scoreBoxHeight = 68;
    const scoreGapX = 15;
    const scoreGapY = 14;
    
    const dashboardLeftX = 50;
    
    const dashboardRightX =
      dashboardLeftX +
      scoreBoxWidth +
      scoreGapX;
    
    const dashboardStartY =
      doc.y;
    
    
    scoreRows.forEach(
      ([name, score], index) => {
    
        const column =
          index % 2;
    
        const row =
          Math.floor(index / 2);
    
        const x =
          column === 0
            ? dashboardLeftX
            : dashboardRightX;
    
        const y =
          dashboardStartY +
          row *
          (scoreBoxHeight + scoreGapY);
    
    
        /*
         * Score box
         */
        doc
          .roundedRect(
            x,
            y,
            scoreBoxWidth,
            scoreBoxHeight,
            8
          )
          .stroke();
    
    
        /*
         * Score name
         */
        doc
          .fontSize(9)
          .text(
            name.toUpperCase(),
            x + 14,
            y + 12,
            {
              width:
                scoreBoxWidth - 28
            }
          );
    
    
        /*
         * Score value
         */
        doc
          .fontSize(20)
          .text(
            formatScore(score),
            x + 14,
            y + 30,
            {
              width:
                scoreBoxWidth - 28
            }
          );
    
      }
    );
    
    
    /*
     * Move the PDF cursor underneath
     * the complete dashboard.
     */
    const dashboardRows =
      Math.ceil(
        scoreRows.length / 2
      );
    
    
    doc.y =
      dashboardStartY +
      dashboardRows *
      (scoreBoxHeight + scoreGapY);
    
    
    /*
     * Divider
     */
    doc
      .moveTo(
        50,
        doc.y
      )
      .lineTo(
        545,
        doc.y
      )
      .stroke();
    
    
    doc.moveDown(1);


    /*
     * --------------------------------
     * PAGE 3
     * PRIORITY FINDINGS
     * --------------------------------
     */

    doc.addPage();


    heading(
      doc,
      "Priority Findings"
    );


    if (
      Array.isArray(issues) &&
      issues.length > 0
    ) {

      issues.forEach((issue, index) => {

        const title =
          typeof issue === "string"
            ? issue
            : issue.title ||
              issue.name ||
              "Website issue";


        doc
          .fontSize(13)
          .text(
            `${index + 1}. ${title}`
          );


        if (
          typeof issue === "object" &&
          issue.description
        ) {

          doc
            .fontSize(10)
            .text(
              issue.description
            );

        }


        doc.moveDown();

      });

    } else {

      doc
        .fontSize(11)
        .text(
          "No priority findings were supplied for this scan."
        );

    }


    /*
     * --------------------------------
     * RECOMMENDATIONS
     * --------------------------------
     */

    doc.addPage();


    heading(
      doc,
      "Site Rescue Recommendations"
    );


    if (
      Array.isArray(recommendations) &&
      recommendations.length > 0
    ) {

      recommendations.forEach(
        (recommendation, index) => {

          doc
            .fontSize(15)
            .text(
              `${index + 1}. ${recommendation.title || "Recommendation"}`
            );


          doc.moveDown(0.4);


          if (recommendation.severity) {

            doc
              .fontSize(9)
              .text(
                `Priority: ${recommendation.severity.toUpperCase()}`
              );

          }


          doc.moveDown(0.4);


          if (recommendation.why) {

            doc
              .fontSize(10)
              .text(
                `Why it matters: ${recommendation.why}`
              );

          }


          doc.moveDown(0.4);


          if (recommendation.action) {

            doc
              .fontSize(10)
              .text(
                `Recommended action: ${recommendation.action}`
              );

          }


          doc.moveDown(0.4);


          if (recommendation.service) {

            doc
              .fontSize(10)
              .text(
                `Recommended service: ${recommendation.service}`
              );

          }


          doc.moveDown(1);

        }
      );

    } else {

      doc
        .fontSize(11)
        .text(
          "No recommendations were generated for this scan."
        );

    }


    /*
     * --------------------------------
     * WEBSITE INFORMATION
     * --------------------------------
     */

    doc.addPage();


    heading(
      doc,
      "Website Information"
    );


    if (metadata) {

      if (metadata.title) {

        doc
          .fontSize(11)
          .text(
            `Page title: ${metadata.title}`
          );

        doc.moveDown();

      }


      if (metadata.description) {

        doc
          .fontSize(11)
          .text(
            `Meta description: ${metadata.description}`
          );

        doc.moveDown();

      }


      if (metadata.canonical) {

        doc
          .fontSize(11)
          .text(
            `Canonical URL: ${metadata.canonical}`
          );

        doc.moveDown();

      }


      if (metadata.language) {

        doc
          .fontSize(11)
          .text(
            `Language: ${metadata.language}`
          );

        doc.moveDown();

      }

    }


    doc.moveDown(2);


    doc
      .fontSize(11)
      .text(
        "This report was generated automatically using the Site Rescue Studio website health scanner."
      );


    /*
     * --------------------------------
     * FINAL PAGE
     * --------------------------------
     */

    doc.addPage();


    heading(
      doc,
      "Your Website Rescue Plan"
    );


    doc
      .fontSize(13)
      .text(
        "Recommended next steps"
      );


    doc.moveDown();


    const nextSteps = [
      "Address high-priority website issues.",
      "Improve search visibility and technical SEO.",
      "Strengthen accessibility and usability.",
      "Improve customer contact and conversion opportunities.",
      "Monitor website health regularly."
    ];


    nextSteps.forEach(
      (step, index) => {

        doc
          .fontSize(11)
          .text(
            `${index + 1}. ${step}`
          );

        doc.moveDown(0.6);

      }
    );


    doc.moveDown(2);


    doc
      .fontSize(20)
      .text(
        "Need help fixing these problems?"
      );


    doc.moveDown();


    doc
      .fontSize(13)
      .text(
        "Site Rescue Studio"
      );


    doc
      .fontSize(11)
      .text(
        "Fix. Improve. Grow."
      );


    doc.moveDown();


    doc
      .fontSize(10)
      .text(
        "Website rescue, optimisation and ongoing website care."
      );


    doc.end();


    await pdfFinished;


    const pdf =
      Buffer.concat(chunks);


    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=\"website-rescue-report.pdf\""
    );

    res.setHeader(
      "Content-Length",
      pdf.length
    );


    return res.end(pdf);


  } catch (error) {

    console.error(
      "PDF report error:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        "We could not generate the Website Rescue Report."

    });

  }

};


/*
 * --------------------------------
 * HELPERS
 * --------------------------------
 */

function cleanUrl(url) {

  try {

    return new URL(url).hostname;

  } catch {

    return url;

  }

}


function scoreValue(score) {

  return Number.isFinite(score)
    ? score
    : "—";

}


function formatScore(score) {

  return Number.isFinite(score)
    ? `${score}/100`
    : "Not available";

}


function getOverallLabel(score) {

  if (!Number.isFinite(score)) {
    return "Assessment completed";
  }


  if (score >= 90) {
    return "Excellent";
  }


  if (score >= 75) {
    return "Good";
  }


  if (score >= 60) {
    return "Needs Improvement";
  }


  return "Poor";

}


function formatDate() {

  return new Date()
    .toLocaleDateString(
      "en-ZA",
      {
        year: "numeric",
        month: "long",
        day: "numeric"
      }
    );

}


function heading(doc, text) {

  doc
    .fontSize(22)
    .text(text);


  doc.moveDown(1);

}

function drawScoreBox(
  doc,
  label,
  score
) {

  const x = doc.x;
  const y = doc.y;

  const width = 150;
  const height = 65;

  doc
    .roundedRect(
      x,
      y,
      width,
      height,
      8
    )
    .stroke();


  doc
    .fontSize(10)
    .text(
      label,
      x + 12,
      y + 10
    );


  doc
    .fontSize(22)
    .text(
      formatScore(score),
      x + 12,
      y + 28
    );


  doc.moveDown(5);

}

function drawDivider(doc) {

  const y = doc.y;

  doc
    .moveTo(
      50,
      y
    )
    .lineTo(
      545,
      y
    )
    .stroke();

  doc.moveDown();

}