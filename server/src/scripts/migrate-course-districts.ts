/**
 * One-off migration: set districtId/district on courses that were authored
 * per county. Run AFTER migrate-county-to-fips.ts.
 *
 * Dry run by default — pass --apply to write.
 * Usage: npx ts-node src/scripts/migrate-course-districts.ts [--apply]
 *
 * Only counties with exactly one district can be resolved automatically; the
 * rest are listed — assign them in the admin Curriculum page ("Assign district").
 * Student profiles are not migrated: students pick their district in Profile.
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { resolveCourseDistrict } from './resolve-course-district';

const apply = process.argv.includes('--apply');

async function main() {
  await connectDatabase();
  console.log(apply ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');

  // Raw collection: legacy courses lack the now-required districtId.
  const col = mongoose.connection.collection('courses');
  const legacy = col.find({
    isDeleted: { $ne: true },
    $or: [{ districtId: { $exists: false } }, { districtId: null }, { districtId: '' }],
  });

  let resolved = 0;
  const problems: string[] = [];
  for await (const doc of legacy) {
    const r = resolveCourseDistrict(doc.state, doc.countyFips);
    if (r.status === 'unresolved') {
      problems.push(`  course ${doc.publicId}  "${doc.title}"  ${doc.county ?? '?'}, ${doc.state ?? '?'}  (${r.candidates} districts)`);
      continue;
    }
    resolved++;
    console.log(`  course ${doc.publicId}  "${doc.title}" → ${r.district.name} (${r.district.id})`);
    if (apply) {
      await col.updateOne({ _id: doc._id }, { $set: { districtId: r.district.id, district: r.district.name } });
    }
  }

  console.log(`courses: ${resolved} ${apply ? 'updated' : 'would update'}, ${problems.length} need a district assigned by hand`);
  if (problems.length) console.log(problems.join('\n'));
  await disconnectDatabase();
  process.exit(problems.length ? 2 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
