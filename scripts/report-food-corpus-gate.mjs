import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'data/food/chile/rm');
const coverage = JSON.parse(fs.readFileSync(path.join(root, 'corpus-coverage.json'), 'utf8'));
const files = fs.readdirSync(root)
  .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
  .sort();
const records = files.flatMap((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return Array.isArray(payload.records) ? payload.records : [];
});

const currentComunas = new Set(records.map((record) => record.outlet?.comuna).filter(Boolean));
const priorityComunas = new Set(coverage.priority_comunas ?? []);
const priorityComunasWithData = [...currentComunas].filter((comuna) => priorityComunas.has(comuna)).sort();
const itemCount = records.reduce(
  (sum, record) => sum + (record.menu_snapshot?.sample_items?.length ?? 0),
  0,
);
const identityRiskRecords = records.filter((record) =>
  record.outlet?.identity_status === 'needs_review' ||
  record.outlet?.identity_status === 'possible_virtual_brand' ||
  record.listing?.observed_availability === 'closed_on_platform' ||
  (record.related_platform_listings?.length ?? 0) > 0,
);

const target = coverage.gate_before_consumer_taxonomy_v1;
const metrics = {
  outlets: { current: records.length, target: target.minimum_outlets },
  sampledMenuItems: { current: itemCount, target: target.minimum_sampled_menu_items },
  priorityComunasWithData: {
    current: priorityComunasWithData.length,
    target: target.minimum_priority_comunas_with_data,
    values: priorityComunasWithData,
  },
  identityRiskExamples: {
    current: identityRiskRecords.length,
    target: target.required_identity_risk_examples,
  },
};

const progress = Object.fromEntries(
  Object.entries(metrics).map(([key, metric]) => [
    key,
    {
      ...metric,
      ratio: Number(Math.min(1, metric.current / metric.target).toFixed(4)),
      met: metric.current >= metric.target,
    },
  ]),
);
const gateMet = Object.values(progress).every((metric) => metric.met);

console.log(JSON.stringify({
  gate: 'consumer_taxonomy_v1_research_sufficiency',
  gateMet,
  observationFiles: files.length,
  progress,
  note: target.note,
}, null, 2));

if (process.argv.includes('--strict') && !gateMet) process.exitCode = 1;
