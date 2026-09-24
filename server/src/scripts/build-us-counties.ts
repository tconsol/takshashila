/**
 * Regenerates src/modules/geo/us-counties.json from the US Census Bureau
 * county gazetteer file. Not used at runtime — run it only when refreshing the data.
 *
 * Source: https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html
 *   (Counties → e.g. 2024_Gaz_counties_national.zip, unzip to get the .txt)
 *
 * Usage: npx ts-node src/scripts/build-us-counties.ts path/to/2024_Gaz_counties_national.txt
 */
import fs from 'fs';
import path from 'path';
import { US_STATE_CODES } from '../modules/geo/us-states';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: ts-node src/scripts/build-us-counties.ts <gazetteer.txt>');
  process.exit(1);
}

const stateCodes = new Set<string>(US_STATE_CODES);
const [header, ...rows] = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const cols = header.split('\t').map((c) => c.trim());
const iState = cols.indexOf('USPS');
const iFips = cols.indexOf('GEOID');
const iName = cols.indexOf('NAME');
if (iState < 0 || iFips < 0 || iName < 0) throw new Error(`Unexpected header: ${header}`);

const counties = rows
  .map((line) => line.split('\t').map((c) => c.trim()))
  // Only the 50 states + DC; territories (PR, etc.) are out of scope.
  .filter((c) => stateCodes.has(c[iState]))
  .map((c) => ({ fips: c[iFips], name: c[iName], state: c[iState] }))
  .sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

const outPath = path.join(__dirname, '../modules/geo/us-counties.json');
fs.writeFileSync(outPath, JSON.stringify(counties) + '\n');
console.log(`Wrote ${counties.length} counties to ${outPath}`);
