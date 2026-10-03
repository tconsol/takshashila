/**
 * One-off: link imported county add-ons to a county, so students in that county can see them.
 * The state files name the county in free text ("Fulton County Schools", "Denver County – Denver Public Schools");
 * this matches that text to the Census county list. Records that do not match exactly are listed and left
 * alone; pick their county in the admin screen.
 *
 * Dry run by default. Pass --apply to write.
 * Usage: npx ts-node --transpile-only src/scripts/link-county-additions.ts [--apply]
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { CountyAdditionModel } from '../modules/curricula/county-addition.model';
import { resolveCounty } from '../modules/curricula/county-resolver';

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  await connectDatabase();
  console.log('Connected to', mongoose.connection.host, '/ db:', mongoose.connection.name, apply ? '(APPLY)' : '(dry run)');
  const items = await CountyAdditionModel.find({ isDeleted: false, countyFips: { $exists: false } });
  const labels = new Map<string, { stateCode: string; county: string; n: number; fips?: string; name?: string }>();
  for (const item of items) {
    const key = `${item.stateCode}|${item.county}`;
    const hit = resolveCounty(item.stateCode, item.county);
    const row = labels.get(key) ?? { stateCode: item.stateCode, county: item.county, n: 0, fips: hit?.fips, name: hit?.name };
    row.n += 1;
    labels.set(key, row);
    if (apply && hit) { item.countyFips = hit.fips; await item.save(); }
  }
  for (const r of labels.values()) {
    console.log(`${r.fips ? (apply ? 'LINKED   ' : 'would link') : 'NO MATCH  '} ${r.stateCode} "${r.county}" (${r.n})${r.name ? ` -> ${r.name}` : ''}`);
  }
  await disconnectDatabase();
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
