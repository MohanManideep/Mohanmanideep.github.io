import fs from "fs";
import path from "path";
import Papa from "papaparse";

const SPREADSHEET_ID = "167gElKe416X12b0xtt1fM05XPA5qqIxvdJ2PaM6N2x8";

const SHEETS = {
  profile: "Profile",
  links: "Links",
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  interests: "Interests",
  media: "Media",
  site_config: "Site_config",
};

function cleanValue(value) {
  if (value === undefined || value === null) return "";

  const trimmed = String(value).trim();

  if (trimmed.toUpperCase() === "TRUE") return true;
  if (trimmed.toUpperCase() === "FALSE") return false;

  return trimmed;
}

function cleanRow(row) {
  const cleaned = {};

  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.trim();
    if (!cleanKey) continue;
    cleaned[cleanKey] = cleanValue(value);
  }

  return cleaned;
}

async function fetchSheet(sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${sheetName}: ${response.status}`);
  }

  const csv = await response.text();

  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map(cleanRow);
}

async function main() {
  const portfolio = {};

  for (const [key, sheetName] of Object.entries(SHEETS)) {
    console.log(`Fetching ${sheetName}...`);
    portfolio[key] = await fetchSheet(sheetName);
  }

  portfolio.profile = portfolio.profile[0] || {};

  const outputPath = path.join("src", "data", "portfolio.json");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  fs.writeFileSync(
    outputPath,
    JSON.stringify(portfolio, null, 2),
    "utf-8"
  );

  console.log(`Saved ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});