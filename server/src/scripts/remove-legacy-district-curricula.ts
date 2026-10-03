/**
 * One-off clean-up: soft-delete curricula that were authored per school district (they have no stateCode).
 * Curricula are state-based now, so these can no longer be browsed, edited or requested.
 *
 * Dry run by default. Pass --apply to write. A legacy curriculum that PENDING or ACCEPTED courses still
 * use is listed and skipped; finish or cancel those courses first.
 *
 * Usage: npx ts-node --transpile-only src/scripts/remove-legacy-district-curricula.ts [--apply]
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';

const apply = process.argv.includes('--apply');

async function main(): Promise<void> {
  await connectDatabase();
  const db = mongoose.connection;
  console.log('Connected to', db.host, '/ db:', db.name, apply ? '(APPLY)' : '(dry run)');
  const curricula = db.collection('curricula');
  const courses = db.collection('courses');

  const legacy = await curricula.find({ isDeleted: { $ne: true }, stateCode: { $exists: false } }).toArray();
  console.log(`${legacy.length} legacy district curriculum(s)`);
  for (const c of legacy) {
    const active = await courses.countDocuments({ curriculumPublicId: c.publicId, status: { $in: ['PENDING', 'ACCEPTED'] }, isDeleted: { $ne: true } });
    if (active > 0) { console.log(`SKIP  ${c.title} (${c.publicId}): ${active} active course(s)`); continue; }
    console.log(`${apply ? 'DELETE' : 'would delete'}  ${c.title} (${c.publicId})`);
    if (apply) await curricula.updateOne({ _id: c._id }, { $set: { isDeleted: true, isPublished: false } });
  }
  await disconnectDatabase();
}

main().catch((err) => { console.error('FAILED:', err.message); process.exit(1); });
