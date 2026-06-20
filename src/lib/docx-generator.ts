import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  HeadingLevel,
  PageBreak,
  LevelFormat,
  VerticalAlign,
  Header,
  Footer,
  SimpleField,
} from "docx";
import * as fs from "fs";
import type { Scan } from "@/lib/types";
import { TrialVerdict, RiskLevel } from "@/lib/enums";

/**
 * Generate a Word document from a Scan report
 * @param scan The scan data to convert to a report
 * @param outputPath Where to save the .docx file
 */
export async function generateScanReport(
  scan: Scan,
  outputPath?: string
): Promise<Buffer> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 22 }, // 11pt
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: "1F4788" },
          paragraph: {
            spacing: { before: 240, after: 120 },
            outlineLevel: 0,
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: "2E5C8A" },
          paragraph: {
            spacing: { before: 180, after: 100 },
            outlineLevel: 1,
          },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Arial" },
          paragraph: {
            spacing: { before: 120, after: 60 },
            outlineLevel: 2,
          },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 inches
              height: 15840, // 11 inches
            },
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
          titlePage: true,
        },
        headers: {
          default: new Header({
            children: [
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  insideHorizontal: { style: BorderStyle.NONE },
                  insideVertical: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 4680, type: WidthType.DXA },
                        children: [],
                      }),
                      new TableCell({
                        width: { size: 4680, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: "REPORT   PENTEST   SCAN",
                                size: 14,
                                color: "999999",
                                bold: true,
                              }),
                            ],
                          }),
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: `ISSUED   ${scan.issuedDate.toUpperCase()}`,
                                size: 14,
                                color: "999999",
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 80, after: 120 },
                border: {
                  bottom: {
                    color: "E0E0E0",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 4,
                  },
                },
                children: [new TextRun("")],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `REPORT   ·   SCAN   #${scan.id}`,
                    size: 14,
                    color: "2E75B6",
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                spacing: { before: 100, after: 80 },
                border: {
                  top: {
                    color: "E0E0E0",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 4,
                  },
                },
                children: [new TextRun("")],
              }),
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [6000, 3360],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                  insideHorizontal: { style: BorderStyle.NONE },
                  insideVertical: { style: BorderStyle.NONE },
                },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 6000, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: "SENTINELPROMPT   ·   SECURITY   INSIGHTS   REPORT   ·   ",
                                size: 14,
                                color: "999999",
                              }),
                              new TextRun({
                                text: "CONFIDENTIAL",
                                size: 14,
                                color: "E74C3C",
                                bold: true,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 3360, type: WidthType.DXA },
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: "PAGE   ",
                                size: 14,
                                color: "999999",
                              }),
                              new SimpleField("PAGE"),
                              new TextRun({
                                text: "   OF   ",
                                size: 14,
                                color: "999999",
                              }),
                              new SimpleField("NUMPAGES"),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          ...createTitlePage(scan),
          new Paragraph({ children: [new PageBreak()] }),
          ...createConfigurationSection(scan),
          new Paragraph({ children: [new PageBreak()] }),
          ...createTrialSection(scan),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  if (outputPath) {
    fs.writeFileSync(outputPath, buffer);
    console.log(`✓ Report generated: ${outputPath}`);
  }
  return buffer;
}

/**
 * Title page with report header and key metrics
 */
function createTitlePage(scan: Scan): any[] {
  const breachedCount = scan.trials.filter(
    (t) => t.verdict === TrialVerdict.Breached
  ).length;

  return [
    // Header info
    new Paragraph({
      spacing: { before: 100, after: 60 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: "REPORT PENTEST SCAN",
          bold: true,
          size: 16,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `ISSUED ${scan.issuedDate.toUpperCase()}`,
          size: 16,
          color: "666666",
        }),
      ],
    }),

    // Main title
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: "SECURITY INSIGHTS REPORT",
          size: 18,
          color: "2E75B6",
          bold: true,
        }),
        new TextRun({ text: " · ", size: 18 }),
        new TextRun({
          text: `SCAN #${scan.id}`,
          size: 18,
          color: "2E75B6",
          bold: true,
        }),
      ],
    }),

    // Headline
    new Paragraph({
      spacing: { before: 200, after: 150 },
      children: [
        new TextRun({
          text: `Adversarial pressure on ${scan.targetModel}.`,
          bold: true,
          size: 44,
        }),
      ],
    }),

    // Summary paragraph
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `${scan.totalTrials} adversarial trials probed a ${scan.modelName} deployment. ${scan.breaches} landed (${scan.breachRate}% breach rate). This report unpacks how, and how to close the gap.`,
          size: 24,
        }),
      ],
    }),

    // Large score box
    ...createScorebox(scan),

    new Paragraph({ text: "" }),

    // Key metrics
    ...createMetricsTable(scan, breachedCount),

    // Summary text
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: scan.riskLevel === RiskLevel.Critical ? "⚠ CRITICAL RISK" : scan.riskLevel,
          bold: true,
          size: 22,
          color: scan.riskLevel === RiskLevel.Critical ? "E74C3C" : "F39C12",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: scan.summary,
          bold: true,
          size: 26,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: scan.summaryDetail,
          italics: true,
          size: 22,
        }),
      ],
    }),
  ];
}

/**
 * Create the large security score box
 */
function createScorebox(scan: Scan): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200, after: 200 },
      border: {
        bottom: {
          color: "2E75B6",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 12,
        },
      },
      children: [
        new TextRun({
          text: `${scan.score}`,
          bold: true,
          size: 120,
          color: "1F4788",
        }),
        new TextRun({
          text: " / 100",
          bold: true,
          size: 32,
          color: "666666",
        }),
        new TextRun({ text: "\t\t", size: 32 }),
        new TextRun({
          text: "SECURITY SCORE",
          size: 20,
          color: "666666",
        }),
      ],
    }),
  ];
}

/**
 * Create metrics table for title page
 */
function createMetricsTable(scan: Scan, breachedCount: number): any[] {
  const border = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: "CCCCCC",
  };
  const borders = {
    top: border,
    bottom: border,
    left: border,
    right: border,
  };

  const metricCellWidth = 1872; // 9360 / 5
  const tableWidth = 9360;

  const metrics = [
    { label: "TARGET MODEL", value: scan.modelName },
    { label: "TOTAL TRIALS", value: scan.totalTrials.toString() },
    { label: "BREACHES", value: scan.breaches.toString(), red: true },
    { label: "BREACH RATE", value: `${scan.breachRate}%`, red: true },
    { label: "API COST", value: `$${(scan.apiCost || 0).toFixed(4)}` },
  ];

  return [
    new Table({
      width: { size: tableWidth, type: WidthType.DXA },
      columnWidths: [metricCellWidth, metricCellWidth, metricCellWidth, metricCellWidth, metricCellWidth],
      rows: [
        new TableRow({
          children: metrics.map((metric) => {
            return new TableCell({
              borders,
              width: { size: metricCellWidth, type: WidthType.DXA },
              shading: { fill: "F8F8F8", type: ShadingType.CLEAR },
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: metric.label,
                      bold: true,
                      size: 18,
                      color: "666666",
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 60 },
                  children: [
                    new TextRun({
                      text: metric.value,
                      bold: true,
                      size: 28,
                      color: metric.red ? "E74C3C" : "1F4788",
                    }),
                  ],
                }),
              ],
            });
          }),
        }),
      ],
    }),
  ];
}



/**
 * Configuration section with all scan parameters
 */
/**
 * Syntax highlighting colors for JSON/code
 */
const SyntaxColors = {
  KEY: "0B7C3F", // Green
  STRING: "D32F2F", // Red
  NUMBER: "F57C00", // Orange
  BOOLEAN: "7B1FA2", // Purple
  NULL: "EF6C00", // Dark Orange
  BRACKET: "555555", // Dark Gray
  COLON: "616161", // Medium Gray
  TEXT: "1A1A1A", // Black
};

function tokenizeWhitespace(json: string, i: number): { run: TextRun; nextIndex: number } | null {
  if (/\s/.test(json[i])) {
    let whitespace = "";
    let idx = i;
    while (idx < json.length && /\s/.test(json[idx])) {
      whitespace += json[idx];
      idx++;
    }
    return {
      run: new TextRun({ text: whitespace, size: 18, font: "Courier New" }),
      nextIndex: idx,
    };
  }
  return null;
}

function tokenizeBrackets(json: string, i: number): { run: TextRun; nextIndex: number } | null {
  const char = json[i];
  if (/[{}\[\]]/.test(char)) {
    return {
      run: new TextRun({
        text: char,
        color: SyntaxColors.BRACKET,
        bold: true,
        size: 18,
        font: "Courier New",
      }),
      nextIndex: i + 1,
    };
  }
  return null;
}

function tokenizeColonsAndCommas(json: string, i: number): { run: TextRun; nextIndex: number } | null {
  const char = json[i];
  if (/[:,]/.test(char)) {
    return {
      run: new TextRun({
        text: char,
        color: SyntaxColors.COLON,
        size: 18,
        font: "Courier New",
      }),
      nextIndex: i + 1,
    };
  }
  return null;
}

function tokenizeString(json: string, i: number): { run: TextRun; nextIndex: number } | null {
  if (json[i] !== '"') return null;
  let str = '"';
  let idx = i + 1;
  while (idx < json.length && json[idx] !== '"') {
    str += json[idx];
    if (json[idx] === "\\") {
      idx++;
      if (idx < json.length) {
        str += json[idx];
      }
    }
    idx++;
  }
  if (idx < json.length) {
    str += '"';
    idx++;
  }

  // Determine if this is a key (followed by :) or a string value
  let isKey = false;
  let j = idx;
  while (j < json.length && /\s/.test(json[j])) j++;
  if (j < json.length && json[j] === ":") isKey = true;

  return {
    run: new TextRun({
      text: str,
      color: isKey ? SyntaxColors.KEY : SyntaxColors.STRING,
      size: 18,
      font: "Courier New",
    }),
    nextIndex: idx,
  };
}

function tokenizeNumber(json: string, i: number): { run: TextRun; nextIndex: number } | null {
  const char = json[i];
  if (/\d/.test(char) || char === "-") {
    let num = "";
    let idx = i;
    while (idx < json.length && /[\d.\-eE]/.test(json[idx])) {
      num += json[idx];
      idx++;
    }
    return {
      run: new TextRun({
        text: num,
        color: SyntaxColors.NUMBER,
        bold: true,
        size: 18,
        font: "Courier New",
      }),
      nextIndex: idx,
    };
  }
  return null;
}

function tokenizeKeywords(json: string, i: number): { run: TextRun; nextIndex: number } | null {
  if (json.substring(i, i + 4) === "true") {
    return {
      run: new TextRun({
        text: "true",
        color: SyntaxColors.BOOLEAN,
        bold: true,
        size: 18,
        font: "Courier New",
      }),
      nextIndex: i + 4,
    };
  }
  if (json.substring(i, i + 5) === "false") {
    return {
      run: new TextRun({
        text: "false",
        color: SyntaxColors.BOOLEAN,
        bold: true,
        size: 18,
        font: "Courier New",
      }),
      nextIndex: i + 5,
    };
  }
  if (json.substring(i, i + 4) === "null") {
    return {
      run: new TextRun({
        text: "null",
        color: SyntaxColors.NULL,
        italics: true,
        size: 18,
        font: "Courier New",
      }),
      nextIndex: i + 4,
    };
  }
  return null;
}

/**
 * Tokenize and highlight JSON with proper syntax colors
 */
function createSyntaxHighlightedJSON(json: string): TextRun[] {
  const runs: TextRun[] = [];
  let i = 0;

  while (i < json.length) {
    const token =
      tokenizeWhitespace(json, i) ||
      tokenizeBrackets(json, i) ||
      tokenizeColonsAndCommas(json, i) ||
      tokenizeString(json, i) ||
      tokenizeNumber(json, i) ||
      tokenizeKeywords(json, i);

    if (token) {
      runs.push(token.run);
      i = token.nextIndex;
    } else {
      // Fallback for unknown characters
      runs.push(new TextRun({ text: json[i], size: 18, color: SyntaxColors.TEXT, font: "Courier New" }));
      i++;
    }
  }

  return runs;
}

/**
 * Create a formatted code block with syntax highlighting
 */
function createHighlightedCodeBlock(
  code: string,
  label?: string
): Paragraph[] {
  const result: Paragraph[] = [];

  if (label) {
    result.push(
      new Paragraph({
        spacing: { before: 150, after: 80 },
        children: [
          new TextRun({
            text: label,
            bold: true,
            size: 16,
            color: "7F8C8D",
          }),
        ],
      })
    );
  }

  // Try to format as JSON if possible
  let formatted = code;
  try {
    formatted = JSON.stringify(JSON.parse(code), null, 2);
  } catch {
    // If not valid JSON, use as-is
  }

  // Split into lines for better rendering
  const lines = formatted.split("\n");
  for (const line of lines) {
    const runs = createSyntaxHighlightedJSON(line);
    result.push(
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: runs.length > 0 ? runs : [new TextRun({ text: " ", size: 18, font: "Courier New" })],
      })
    );
  }

  return result;
}

/**
 * Helper to create a syntax-highlighted code block inside a table with a light background
 */
function createCodeBlock(text: string): Table {
  const paragraphs = createHighlightedCodeBlock(text);

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 240, right: 240 },
            children: paragraphs,
          }),
        ],
      }),
    ],
  });
}

/**
 * Configuration section with all scan parameters
 */
function createConfigurationSection(scan: Scan): any[] {
  return [
    // Top Title Block
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: "What the assistant was asked to protect.",
          bold: true,
          size: 36,
          color: "1F4788",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "The system prompt under test, the behavior it must never produce, and the adversarial coverage applied.",
          size: 20,
          color: "666666",
        }),
      ],
    }),

    // System Prompt
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: "SYSTEM PROMPT",
          bold: true,
          size: 16,
          color: "999999",
        }),
      ],
    }),
    createCodeBlock(scan.systemPrompt),

    // Tools
    new Paragraph({
      spacing: { before: 250, after: 100 },
      children: [
        new TextRun({
          text: "TOOLS",
          bold: true,
          size: 16,
          color: "999999",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `${scan.tools.length} tool definition${scan.tools.length !== 1 ? "s" : ""} configured`,
          italics: true,
          size: 18,
          color: "666666",
        }),
      ],
    }),
    createCodeBlock(JSON.stringify(scan.tools, null, 2)),

    // Mock Tool Responses
    new Paragraph({
      spacing: { before: 250, after: 100 },
      children: [
        new TextRun({
          text: "MOCK TOOL RESPONSES",
          bold: true,
          size: 16,
          color: "999999",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `${Object.keys(scan.mockToolResponses).length} mock response${
            Object.keys(scan.mockToolResponses).length !== 1 ? "s" : ""
          } defined`,
          italics: true,
          size: 18,
          color: "666666",
        }),
      ],
    }),
    createCodeBlock(JSON.stringify(scan.mockToolResponses, null, 2)),

    // Forbidden Task
    new Paragraph({
      spacing: { before: 250, after: 100 },
      children: [
        new TextRun({
          text: "FORBIDDEN TASK",
          bold: true,
          size: 16,
          color: "999999",
        }),
      ],
    }),
    createCodeBlock(scan.forbiddenTask),

    // Judge Instructions
    new Paragraph({
      spacing: { before: 250, after: 100 },
      children: [
        new TextRun({
          text: "JUDGE INSTRUCTIONS",
          bold: true,
          size: 16,
          color: "999999",
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: "Criteria used to evaluate each response.",
          italics: true,
          size: 18,
          color: "666666",
        }),
      ],
    }),
    createCodeBlock(scan.judgeInstructions),

    // Adversarial Coverage
    new Paragraph({
      spacing: { before: 250, after: 100 },
      children: [
        new TextRun({
          text: "ADVERSARIAL COVERAGE",
          bold: true,
          size: 16,
          color: "999999",
        }),
      ],
    }),
    createAdversarialCoverageCard(scan),
  ];
}

/**
 * Helper to create a premium styled card for Adversarial Coverage
 */
function createAdversarialCoverageCard(scan: Scan): Table {
  const hasBreaches = scan.breaches > 0;
  const statusColor = hasBreaches ? "E74C3C" : "2E75B6";

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    borders: {
      left: {
        style: BorderStyle.SINGLE,
        size: 24, // 3pt
        color: statusColor,
      },
      top: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            shading: { fill: "F8F9FA", type: ShadingType.CLEAR },
            margins: { top: 150, bottom: 150, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: scan.forbiddenTask,
                    size: 20,
                    color: "1A1A1A",
                    bold: true,
                  }),
                  new TextRun({
                    text: "   —   ",
                    size: 20,
                    color: "7F8C8D",
                  }),
                  new TextRun({
                    text: `${scan.breaches} / ${scan.totalTrials} breached`,
                    size: 20,
                    color: hasBreaches ? "E74C3C" : "2E75B6",
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * Trial breakdown section
 */
function createTrialSection(scan: Scan): any[] {
  const breachedCount = scan.trials.filter(
    (t) => t.verdict === TrialVerdict.Breached
  ).length;

  const headerTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            children: [
              new Paragraph({
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({
                    text: `${scan.totalTrials} Trials`,
                    bold: true,
                    size: 36,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({
                    text: "● ",
                    color: "E74C3C", // Red
                    size: 18,
                  }),
                  new TextRun({
                    text: "BREACHED     ",
                    color: "666666",
                    size: 16,
                    bold: true,
                  }),
                  new TextRun({
                    text: "● ",
                    color: "2E75B6", // Blue
                    size: 18,
                  }),
                  new TextRun({
                    text: "DEFENDED",
                    color: "666666",
                    size: 16,
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const separatorLine = new Paragraph({
    spacing: { after: 300 },
    border: {
      bottom: {
        color: "000000",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 18, // Thick line
      },
    },
    children: [new TextRun("")],
  });

  const trialCards = scan.trials.flatMap((trial, idx) => {
    const isBreached = trial.verdict === TrialVerdict.Breached;
    const trialColor = isBreached ? "E74C3C" : "2E75B6";

    // Tiny table representing the badge
    const badgeTable = new Table({
      alignment: AlignmentType.RIGHT,
      width: { size: 1400, type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 1400, type: WidthType.DXA },
              shading: { fill: trialColor, type: ShadingType.CLEAR },
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: isBreached ? "BREACHED" : "DEFENDED",
                      bold: true,
                      color: "FFFFFF",
                      size: 14,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const cardHeaderTable = new Table({
      width: { size: 8880, type: WidthType.DXA },
      columnWidths: [4440, 4440],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4440, type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${String(trial.number).padStart(2, "0")}   `,
                      bold: true,
                      size: 24,
                      color: "1A1A1A",
                    }),
                    new TextRun({
                      text: "TRIAL",
                      bold: true,
                      size: 16,
                      color: "7F8C8D",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4440, type: WidthType.DXA },
              verticalAlign: VerticalAlign.CENTER,
              children: [badgeTable],
            }),
          ],
        }),
      ],
    });

    const trialCardTable = new Table({
      width: { size: 9360, type: WidthType.DXA },
      borders: {
        left: {
          style: BorderStyle.SINGLE,
          size: 24,
          color: trialColor,
        },
        top: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 9360, type: WidthType.DXA },
              shading: { fill: "F8F9FA", type: ShadingType.CLEAR },
              margins: { top: 200, bottom: 200, left: 240, right: 240 },
              children: [
                cardHeaderTable,
                new Paragraph({ spacing: { before: 150 } }),

                // Attack Heading
                new Paragraph({
                  spacing: { before: 100, after: 60 },
                  children: [
                    new TextRun({
                      text: "❘ ",
                      color: trialColor,
                      bold: true,
                      size: 18,
                    }),
                    new TextRun({
                      text: "ATTACK",
                      bold: true,
                      size: 16,
                      color: "7F8C8D",
                    }),
                  ],
                }),
                // Attack Text
                new Paragraph({
                  spacing: { after: 150 },
                  children: [
                    new TextRun({
                      text: trial.attack,
                      size: 20,
                      color: "1A1A1A",
                    }),
                  ],
                }),

                // Separator
                new Paragraph({
                  spacing: { before: 100, after: 100 },
                  border: {
                    bottom: {
                      color: "E0E0E0",
                      style: BorderStyle.SINGLE,
                      size: 4,
                    },
                  },
                  children: [new TextRun("")],
                }),

                // Response Heading
                new Paragraph({
                  spacing: { before: 100, after: 60 },
                  children: [
                    new TextRun({
                      text: "❘ ",
                      color: trialColor,
                      bold: true,
                      size: 18,
                    }),
                    new TextRun({
                      text: "RESPONSE",
                      bold: true,
                      size: 16,
                      color: "7F8C8D",
                    }),
                  ],
                }),
                // Response Text
                new Paragraph({
                  spacing: { after: 150 },
                  children: [
                    new TextRun({
                      text: trial.response,
                      size: 20,
                      color: "1A1A1A",
                    }),
                  ],
                }),

                // Separator
                new Paragraph({
                  spacing: { before: 100, after: 100 },
                  border: {
                    bottom: {
                      color: "E0E0E0",
                      style: BorderStyle.SINGLE,
                      size: 4,
                    },
                  },
                  children: [new TextRun("")],
                }),

                // Judge Heading
                new Paragraph({
                  spacing: { before: 100, after: 60 },
                  children: [
                    new TextRun({
                      text: "❘ ",
                      color: trialColor,
                      bold: true,
                      size: 18,
                    }),
                    new TextRun({
                      text: `JUDGE — ${isBreached ? "LEAKED" : "DEFENDED"}`,
                      bold: true,
                      size: 16,
                      color: trialColor,
                    }),
                  ],
                }),
                // Judge Verdict
                new Paragraph({
                  children: [
                    new TextRun({
                      text: trial.judgeVerdict,
                      italics: true,
                      size: 20,
                      color: "555555",
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    return [
      trialCardTable,
      new Paragraph({ spacing: { before: 200 } }), // gap between cards
    ];
  });

  return [
    // Section header marker
    new Paragraph({
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: "—  02 – TRIAL-BY-TRIAL BREAKDOWN",
          bold: true,
          size: 18,
          color: "2E75B6",
        }),
      ],
    }),
    headerTable,
    separatorLine,
    ...trialCards,
  ];
}