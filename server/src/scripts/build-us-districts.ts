/**
 * Regenerates src/modules/geo/us-districts.json from two NCES files.
 * Not used at runtime — run it only when refreshing the data.
 *
 * Sources (2023-24):
 *   CCD LEA directory: https://nces.ed.gov/ccd/Data/zip/ccd_lea_029_2324_w_1a_073124.zip
 *   EDGE LEA geocodes: https://nces.ed.gov/programs/edge/data/EDGE_GEOCODE_PUBLICLEA_2324.zip
 *
 * Usage: npx ts-node src/scripts/build-us-districts.ts <ccd_lea_029_....csv> <EDGE_GEOCODE_PUBLICLEA_....TXT>
 */
import fs from 'fs';
import path from 'path';
import usCounties from '../modules/geo/us-counties.json';
import { buildDistricts } from './us-districts-builder';

const [ccdPath, edgePath] = process.argv.slice(2);
if (!ccdPath || !edgePath) {
  console.error('Usage: ts-node src/scripts/build-us-districts.ts <ccd.csv> <edge.txt>');
  process.exit(1);
}

// NCES files are Windows-1252; latin1 decodes every byte without throwing.
const ccd = fs.readFileSync(ccdPath, 'latin1');
const edge = fs.readFileSync(edgePath, 'latin1');
const known = new Set((usCounties as Array<{ fips: string }>).map((c) => c.fips));

const { districts, dropped } = buildDistricts(ccd, edge, known);
const outPath = path.join(__dirname, '../modules/geo/us-districts.json');
fs.writeFileSync(outPath, JSON.stringify(districts) + '\n');
console.log(`Wrote ${districts.length} districts to ${outPath}`);
console.log('Dropped:', dropped);
