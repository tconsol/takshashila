/**
 * One-off migration for the Curriculum/Course rename (spec: 2026-09-25-curriculum-course-rename-design.md).
 * Run with the API and worker STOPPED, after migrate-county-to-fips / migrate-course-districts
 * have been applied under the old code, and before deploying the renamed code.
 *
 * Dry run by default — pass --apply to write.
 * Usage: npx ts-node src/scripts/migrate-curriculum-course-rename.ts [--apply]
 */
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { planRenameSteps, type Step } from './curriculum-course-rename-plan';

const apply = process.argv.includes('--apply');

async function describe(step: Step): Promise<string> {
  const db = mongoose.connection.db!;
  switch (step.kind) {
    case 'renameCollection':
      return `rename collection ${step.from} -> ${step.to} (${await db.collection(step.from).countDocuments()} docs)`;
    case 'renameFields': {
      const or = Object.keys(step.fields).map((f) => ({ [f]: { $exists: true } }));
      // In a dry run earlier steps haven't happened, so this counts the collection as it is now.
      const n = await db.collection(step.collection).countDocuments({ $or: or }).catch(() => 0);
      return `rename fields on ${step.collection}: ${JSON.stringify(step.fields)} (~${n} docs now)`;
    }
    case 'dropIndex':
      return `drop index ${step.index} on ${step.collection} (if present)`;
    case 'syncIndexes':
      return 'sync indexes for Curriculum, Course, ScheduledClass';
  }
}

async function run(step: Step) {
  const db = mongoose.connection.db!;
  switch (step.kind) {
    case 'renameCollection':
      await db.collection(step.from).rename(step.to);
      return;
    case 'renameFields': {
      const or = Object.keys(step.fields).map((f) => ({ [f]: { $exists: true } }));
      const res = await db.collection(step.collection).updateMany({ $or: or }, { $rename: step.fields });
      console.log(`    modified ${res.modifiedCount}`);
      return;
    }
    case 'dropIndex':
      await db.collection(step.collection).dropIndex(step.index).catch(() => console.log('    (index not present)'));
      return;
    case 'syncIndexes': {
      const { CurriculumModel } = await import('../modules/curricula/curriculum.model');
      const { CourseModel } = await import('../modules/courses/course.model');
      const { ScheduledClassModel } = await import('../modules/schedules/schedule.model');
      await CurriculumModel.syncIndexes();
      await CourseModel.syncIndexes();
      await ScheduledClassModel.syncIndexes();
      return;
    }
  }
}

async function main() {
  await connectDatabase();
  const db = mongoose.connection.db!;
  const collections = (await db.listCollections().toArray()).map((c) => c.name);
  const count = (c: string) => (collections.includes(c) ? db.collection(c).countDocuments() : Promise.resolve(0));
  const plan = planRenameSteps({
    collections,
    curriculaCount: await count('curricula'),
    courseRequestsCount: await count('courserequests'),
    coursesHaveCurriculumField: collections.includes('courses')
      ? (await db.collection('courses').countDocuments({ curriculumPublicId: { $exists: true } })) > 0
      : false,
  });

  if (!plan.ok) {
    console.error(`Refusing to migrate: ${plan.reason}`);
    await disconnectDatabase();
    process.exit(1);
  }

  console.log(apply ? 'APPLYING changes' : 'DRY RUN (pass --apply to write)');
  for (const step of plan.steps) {
    console.log(`- ${await describe(step)}`);
    if (apply) await run(step);
  }
  await disconnectDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
