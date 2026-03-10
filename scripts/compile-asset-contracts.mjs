import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const docsRoot = resolve(root, "docs", "assets");
const activeFiles = JSON.parse(readFileSync(resolve(root, "src", "config", "active-asset-files.json"), "utf8"));
const outputDir = resolve(root, "generated");
const outputFile = resolve(outputDir, "asset-contract-manifest.json");
const tempOutputFile = `${outputFile}.tmp`;

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

function parseFrontmatter(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return {};
  }
  const result = {};
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    result[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return result;
}

function sectionLines(content, sectionTitle) {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${sectionTitle}`);
  if (start === -1) return [];
  const result = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) break;
    if (line.trim()) result.push(line.trim());
  }
  return result;
}

function firstSection(content, titles) {
  for (const title of titles) {
    const lines = sectionLines(content, title);
    if (lines.length > 0) {
      return lines;
    }
  }
  return [];
}

function extractKeywords(lines) {
  const keywords = new Set();
  for (const line of lines) {
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      keywords.add(match[1]);
    }
  }
  return [...keywords];
}

function classifyEvidence(dropId, contractLines, guardrailLines) {
  const text = `${contractLines.join(" ")} ${guardrailLines.join(" ")}`.toLowerCase();
  const requirements = [];

  if (text.includes("schema")) requirements.push("schema-validation");
  if (text.includes("project")) requirements.push("project-layer");
  if (text.includes("diff")) requirements.push("generation-diff");
  if (text.includes("relation")) requirements.push("relation-graph");
  if (text.includes("webui") || text.includes("ui ")) requirements.push("webui-surface");
  if (text.includes("workdir") || text.includes(".phonowell")) requirements.push("workdir");
  if (text.includes("dry-run")) requirements.push("dry-run");
  if (text.includes("packet")) requirements.push("packet-runtime");
  if (text.includes("verify")) requirements.push("verify-loop");
  if (text.includes("layer")) requirements.push("layer-visibility");
  if (text.includes("legacy")) requirements.push("legacy-boundary");
  if (text.includes("goal-origin")) requirements.push("goal-origin");
  if (text.includes("acceptance")) requirements.push("acceptance-binding");

  if (dropId === "drop-ref-react-19") requirements.push("react-webui");
  if (dropId === "drop-ref-codex") requirements.push("cli-surface");
  if (dropId === "drop-ref-mimikit-openai-llm") requirements.push("provider-runtime");

  return [...new Set(requirements)];
}

const compiledAt = new Date().toISOString();
const assets = activeFiles.map((relativeFile) => {
  const sourceFile = resolve(docsRoot, relativeFile);
  const content = readFileSync(sourceFile, "utf8");
  const frontmatter = parseFrontmatter(content);
  const purposeLines = sectionLines(content, "Purpose");
  const contractLines = [
    ...firstSection(content, ["Contract", "Protocol", "Rules", "Included Foundations", "V1 Target", "Intended Scope", "Intended Reference Scope"]),
    ...sectionLines(content, "Low Cognitive Load Defaults"),
    ...sectionLines(content, "State Flow"),
    ...sectionLines(content, "Quality Signals"),
  ];
  const guardrailLines = firstSection(content, ["Guardrails", "Core Guardrails", "Non-Scope", "Explicit Non-Scope"]);
  return {
    dropId: frontmatter.dropId,
    title: frontmatter.title,
    domain: frontmatter.domain,
    layer: frontmatter.layer || (String(frontmatter.type).startsWith("reference-") ? "reference" : "contract"),
    sourceFile,
    purpose: purposeLines.join(" "),
    contractLines,
    guardrailLines,
    keywords: extractKeywords([...purposeLines, ...contractLines, ...guardrailLines]),
    evidenceRequirements: classifyEvidence(frontmatter.dropId, contractLines, guardrailLines),
  };
});

mkdirSync(outputDir, { recursive: true });
writeFileSync(tempOutputFile, JSON.stringify({
  schemaVersion: "1.0.0",
  compiledAt,
  assetCount: assets.length,
  assets,
}, null, 2));
renameSync(tempOutputFile, outputFile);

console.log(`compiled asset contract manifest -> ${outputFile}`);
