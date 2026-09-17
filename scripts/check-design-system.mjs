import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "src/ui/tokens.ts",
  "src/ui/icons.ts",
  "src/ui/contracts.ts",
  "src/ui/index.ts",
  "docs/PALTA_DESIGN_SYSTEM_CONTRACT.md",
  "docs/DESIGN_TOKEN_REGISTRY_V1.json",
  "docs/COMPONENT_REGISTRY_V2.json",
  "docs/PALTA_ICON_CHARACTER_LANGUAGE.md",
  "docs/PALTA_CORE_ICON_SET_V1.md",
  "docs/DESIGN_VERTICAL_SLICE_V1.md",
];

const failures = [];

for (const path of requiredFiles) {
  if (!existsSync(path)) failures.push(`missing required design-system file: ${path}`);
}

const tokenSource = readFileSync("src/ui/tokens.ts", "utf8");
const iconSource = readFileSync("src/ui/icons.ts", "utf8");
const contractSource = readFileSync("src/ui/contracts.ts", "utf8");

const hexMatches = tokenSource.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
if (hexMatches.length > 0) {
  failures.push(`brand/color hex values must not be frozen in src/ui/tokens.ts: ${hexMatches.join(", ")}`);
}

const emojiMatches = iconSource.match(/\p{Extended_Pictographic}/gu) ?? [];
if (emojiMatches.length > 0) {
  failures.push("core icon registry must not use Unicode emoji as product icons");
}

const iconKeys = [...iconSource.matchAll(/\bkey:\s*"([^"]+)"/g)].map((match) => match[1]);
const duplicateIconKeys = [...new Set(iconKeys.filter((key, index) => iconKeys.indexOf(key) !== index))];
if (duplicateIconKeys.length > 0) {
  failures.push(`duplicate core icon keys: ${duplicateIconKeys.join(", ")}`);
}

const requiredSemanticContracts = [
  "PaltaButtonContract",
  "PaltaInputContract",
  "ContentCardContract",
  "BottomSheetContract",
  "StatusBadgeContract",
  "TrustStatusContract",
  "EmptyStateContract",
  "ErrorStateContract",
  "ProfileIdentityContract",
  "CommunityPostContract",
  "LocalResultContract",
];

for (const name of requiredSemanticContracts) {
  if (!contractSource.includes(`interface ${name}`)) {
    failures.push(`missing shared UI contract: ${name}`);
  }
}

if (!tokenSource.includes('durationFrozen: false')) {
  failures.push("motion duration must remain explicitly unfrozen until device validation");
}

if (!iconSource.includes("domainSpecificPacksAllowed: false")) {
  failures.push("icon policy must prevent independent domain icon packs");
}

if (failures.length > 0) {
  console.error("DESIGN SYSTEM CHECK: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("DESIGN SYSTEM CHECK: PASS");
console.log(`required files: ${requiredFiles.length}`);
console.log(`core icon semantic keys: ${iconKeys.length}`);
console.log(`shared semantic contracts checked: ${requiredSemanticContracts.length}`);
console.log("brand hex freeze: none");
console.log("Unicode emoji as core icons: none");
