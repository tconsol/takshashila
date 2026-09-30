/* Integration test against the TEST database from server/.env.
   Skipped unless CURRICULUM_IT=1. Uses stateCode 'ZZ' only and cleans it up before and after.
   tests/setup.ts overwrites MONGODB_URI with a dummy, so the real value is read from .env directly. */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { CountyAdditionModel } from '../../modules/curricula/county-addition.model';
import { applyImport, ImportFile } from '../../modules/curricula/import/curriculum-importer';
import type { ParsedDoc } from '../../modules/curricula/import/curriculum-parser';

const enabled = process.env.CURRICULUM_IT === '1';
const d = enabled ? describe : describe.skip;

const file: ImportFile = { path: 'zz', stateCode: 'ZZ', kind: 'revised' };
const mkDoc = (mathTopics: string[]): ParsedDoc => ({
  grades: [{ grade: 'Grade 3', level: 'GRADE', subjects: [
    { name: 'Mathematics', notVerified: false, chapters: [{ title: 'Fractions', topics: mathTopics }, { title: 'Shapes', topics: ['Cube'] }] },
    { name: 'Science', notVerified: false, chapters: [{ title: 'Plants', topics: ['Roots'] }] },
  ] }],
  skippedHighSchoolGrades: [], sourceParagraphs: [],
  countyParagraphs: [{ style: 'Heading 2', text: 'Zed County' }, { style: 'Heading 3', text: 'Grades 10-12' }, { style: 'Normal', text: 'Dual: enrol' }],
});

const clean = async () => {
  await CurriculumModel.deleteMany({ stateCode: 'ZZ' });
  await CountyAdditionModel.deleteMany({ stateCode: 'ZZ' });
};

d('curriculum importer (integration, ZZ)', () => {
  jest.setTimeout(60000);
  beforeAll(async () => {
    const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../../../.env')));
    await mongoose.connect(env.MONGODB_URI);
    await clean();
  });
  afterAll(async () => {
    await clean();
    await mongoose.disconnect();
  });

  it('creates, is idempotent, updates preserving ids, skips published, mirrors topics', async () => {
    const r1 = await applyImport(file, mkDoc(['Halves', 'Quarters']), { commit: true });
    expect(r1).toMatchObject({ created: 2, updated: 0, unchanged: 0, skippedPublished: 0, countyAdditions: 1 });
    const math1 = (await CurriculumModel.findOne({ stateCode: 'ZZ', subject: 'Mathematics' }))!;
    expect(math1.isPublished).toBe(false);
    expect(math1.chapters).toHaveLength(2);
    // topics mirror: derived from chapters, same publicIds
    expect(math1.topics.map((t) => t.publicId)).toEqual(math1.chapters.map((c) => c.publicId));
    expect(math1.topics.map((t) => t.title)).toEqual(['Fractions', 'Shapes']);
    expect(await CountyAdditionModel.countDocuments({ stateCode: 'ZZ', gradeFrom: 10, isPublished: false })).toBe(1);

    const r2 = await applyImport(file, mkDoc(['Halves', 'Quarters']), { commit: true });
    expect(r2).toMatchObject({ created: 0, updated: 0, unchanged: 2 });
    const math2 = (await CurriculumModel.findOne({ stateCode: 'ZZ', subject: 'Mathematics' }))!;
    expect(math2.chapters.map((c) => c.publicId)).toEqual(math1.chapters.map((c) => c.publicId));
    expect(math2.chapters[0].topics.map((t) => t.publicId)).toEqual(math1.chapters[0].topics.map((t) => t.publicId));
    expect(await CountyAdditionModel.countDocuments({ stateCode: 'ZZ' })).toBe(1);

    // a topic changes in the source doc
    const r3 = await applyImport(file, mkDoc(['Halves', 'Thirds']), { commit: true });
    expect(r3).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
    const math3 = (await CurriculumModel.findOne({ stateCode: 'ZZ', subject: 'Mathematics' }))!;
    expect(math3.chapters[0].publicId).toBe(math1.chapters[0].publicId);
    expect(math3.chapters[1].publicId).toBe(math1.chapters[1].publicId);
    expect(math3.chapters[0].topics[0].publicId).toBe(math1.chapters[0].topics[0].publicId);
    expect(math3.chapters[0].topics[1].publicId).not.toBe(math1.chapters[0].topics[1].publicId);
    expect(math3.chapters[0].topics[1].title).toBe('Thirds');
    expect(math3.topics.map((t) => t.publicId)).toEqual(math3.chapters.map((c) => c.publicId));

    // published curriculum is left alone
    await CurriculumModel.updateOne({ stateCode: 'ZZ', subject: 'Mathematics' }, { $set: { isPublished: true } });
    const r4 = await applyImport(file, mkDoc(['Only']), { commit: true });
    expect(r4).toMatchObject({ skippedPublished: 1, updated: 0, unchanged: 1 });
    const math4 = (await CurriculumModel.findOne({ stateCode: 'ZZ', subject: 'Mathematics' }))!;
    expect(math4.chapters[0].topics.map((t) => t.title)).toEqual(['Halves', 'Thirds']);
  });
});
