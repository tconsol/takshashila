import { CurriculumModel } from '../../modules/curricula/curriculum.model';
import { CountyAdditionModel } from '../../modules/curricula/county-addition.model';
import { planImport, applyImport, ImportFile } from '../../modules/curricula/import/curriculum-importer';
import type { ParsedDoc } from '../../modules/curricula/import/curriculum-parser';

const file: ImportFile = { path: 'x', stateCode: 'CO', kind: 'revised' };
const mkDoc = (over: Partial<ParsedDoc> = {}): ParsedDoc => ({
  grades: [{ grade: 'Grade 2', level: 'GRADE', subjects: [
    { name: 'Mathematics', notVerified: false, chapters: [{ title: 'Add', topics: ['a', 'b'] }] },
    { name: 'Dance', notVerified: true, chapters: [] },
    { name: 'Art', notVerified: false, chapters: [] },
  ] }],
  countyParagraphs: [],
  sourceParagraphs: [{ style: 'ListBullet', text: 'Mathematics: CAS (2020) - https://x.org/m' }],
  ...over,
});

describe('planImport (pure)', () => {
  it('plans only subjects with content and reports the rest', () => {
    const plan = planImport(file, mkDoc());
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ title: 'Mathematics - Grade 2', key: { stateCode: 'CO', subject: 'Mathematics', grade: 'Grade 2' }, source: { year: 2020 } });
  });

  it('builds title with course, KINDERGARTEN level, and imports arts subjects without a whitelist', () => {
    const doc = mkDoc({ grades: [
      { grade: 'Kindergarten', level: 'KINDERGARTEN', subjects: [{ name: 'Theatre', courseName: 'Intro', notVerified: false, chapters: [{ title: 'c', topics: [] }] }] },
    ] });
    const [p] = planImport(file, doc);
    expect(p.title).toBe('Theatre - Intro - Kindergarten');
    expect(p.level).toBe('KINDERGARTEN');
    expect(p.key.courseName).toBe('Intro');
  });

  it('merges duplicate subjects in a grade', () => {
    const s = (t: string) => ({ name: 'Science', notVerified: false, chapters: [{ title: t, topics: ['x'] }] });
    const doc = mkDoc({ grades: [{ grade: 'Grade 1', level: 'GRADE', subjects: [s('One'), s('Two')] }] });
    const plan = planImport(file, doc);
    expect(plan).toHaveLength(1);
    expect(plan[0].chapters.map((c) => c.title)).toEqual(['One', 'Two']);
  });
});

describe('applyImport with mocked models', () => {
  const fakeExisting = (over: Record<string, unknown> = {}) => {
    const d: any = {
      subject: 'Mathematics', grade: 'Grade 2', courseName: undefined, stateCode: 'CO', isPublished: false,
      title: 'Mathematics - Grade 2', level: 'GRADE', sourceKind: 'revised', source: { name: 'CAS', year: 2020, url: 'https://x.org/m' },
      chapters: [{ publicId: 'ch1', title: 'Add', order: 0, topics: [{ publicId: 't1', title: 'a', order: 0 }, { publicId: 't2', title: 'b', order: 1 }] }],
      save: jest.fn().mockResolvedValue(undefined), ...over,
    };
    return d;
  };
  let createSpy: jest.SpyInstance;
  beforeEach(() => {
    createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue({} as never);
    jest.spyOn(CountyAdditionModel, 'find').mockResolvedValue([] as never);
    jest.spyOn(CountyAdditionModel, 'create').mockResolvedValue({} as never);
  });

  it('creates a draft when none exists, and commit=false writes nothing but reports the same', async () => {
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([] as never);
    const dry = await applyImport(file, mkDoc(), { commit: false });
    expect(createSpy).not.toHaveBeenCalled();
    const real = await applyImport(file, mkDoc(), { commit: true });
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy.mock.calls[0][0]).toMatchObject({ isPublished: false, createdByAdminPublicId: 'system:curriculum-import', sourceKind: 'revised', stateCode: 'CO' });
    expect(real).toEqual(dry);
    expect(real).toMatchObject({ created: 1, updated: 0, unchanged: 0, chapters: 1, topics: 2, subjectsSkippedNotVerified: ['Grade 2 / Dance'], emptySubjects: ['Grade 2 / Art'], highSchoolCourses: 0, highSchoolMerged: [], missingCitation: [], missingSourceUrl: [] });
  });

  it('unchanged when identical; updated preserves ids; published is skipped', async () => {
    const same = fakeExisting();
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([same] as never);
    expect(await applyImport(file, mkDoc(), { commit: true })).toMatchObject({ created: 0, unchanged: 1 });
    expect(same.save).not.toHaveBeenCalled();

    const doc = mkDoc();
    doc.grades[0].subjects[0].chapters[0].topics = ['a', 'c'];
    const rep = await applyImport(file, doc, { commit: true });
    expect(rep).toMatchObject({ updated: 1, unchanged: 0 });
    expect(same.save).toHaveBeenCalledTimes(1);
    expect(same.chapters[0].publicId).toBe('ch1');
    expect(same.chapters[0].topics[0].publicId).toBe('t1');
    expect(same.chapters[0].topics[1].publicId).not.toBe('t2');

    const pub = fakeExisting({ isPublished: true });
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([pub] as never);
    expect(await applyImport(file, doc, { commit: true })).toMatchObject({ skippedPublished: 1, updated: 0 });
    expect(pub.save).not.toHaveBeenCalled();
  });

  it('reports missing source and duplicate subjects', async () => {
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([] as never);
    const s = (t: string) => ({ name: 'Music', notVerified: false, chapters: [{ title: t, topics: ['x'] }] });
    const doc = mkDoc({ grades: [{ grade: 'Grade 1', level: 'GRADE', subjects: [s('A'), s('B')] }], sourceParagraphs: [] });
    const rep = await applyImport(file, doc, { commit: true });
    expect(rep.missingCitation).toEqual(['Music']);
    expect(rep.missingSourceUrl).toEqual([]);
    expect(rep.duplicateSubjects).toEqual(['Grade 1 / Music']);
    expect(createSpy.mock.calls[0][0].source).toBeUndefined();
    expect(createSpy.mock.calls[0][0].chapters).toHaveLength(2);
  });

  it('upserts county additions as drafts incl. grades 9-12, never touching published ones', async () => {
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([] as never);
    const pubAdd: any = { county: 'A County', district: '', gradeFrom: 0, gradeTo: 12, category: 'Cat', isPublished: true, description: 'old', save: jest.fn() };
    jest.spyOn(CountyAdditionModel, 'find').mockResolvedValue([pubAdd] as never);
    const doc = mkDoc({ countyParagraphs: [
      { style: 'Heading 2', text: 'A County' }, { style: 'Normal', text: 'Cat: d' },
      { style: 'Heading 3', text: 'Grades 10-12' }, { style: 'Normal', text: 'Dual: enrol' },
    ] });
    const rep = await applyImport(file, doc, { commit: true });
    expect(rep.countyAdditions).toBe(2);
    const created = (CountyAdditionModel.create as unknown as jest.SpyInstance).mock.calls.map((c) => c[0]);
    expect(created).toHaveLength(1); // the published key is left alone
    expect(created[0]).toMatchObject({ stateCode: 'CO', gradeFrom: 10, gradeTo: 12, isPublished: false });
    expect(pubAdd.save).not.toHaveBeenCalled();
  });
});

describe('source reporting', () => {
  it('separates subjects with a citation but no URL from subjects with no citation', () => {
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([] as never);
    const doc = mkDoc({ sourceParagraphs: [{ style: 'Heading 3', text: 'Sources Used for Mathematics' }, { style: 'Normal', text: 'Colorado Academic Standards (Department of Education, 2020)' }] });
    return applyImport(file, doc, { commit: false }).then((rep) => {
      expect(rep.missingCitation).toEqual([]);
      expect(rep.missingSourceUrl).toEqual(['Mathematics']);
    });
  });
});

describe('countyOnly files', () => {
  const coFile: ImportFile = { path: 'x', stateCode: 'CO', kind: 'master', countyOnly: true };
  const doc = () => mkDoc({ countyParagraphs: [
    { style: 'Heading 2', text: 'A County' }, { style: 'Normal', text: 'Cat: d' },
  ] });

  it('planImport returns nothing', () => {
    expect(planImport(coFile, doc())).toEqual([]);
  });

  it('applyImport writes only county additions and never touches curricula', async () => {
    const findSpy = jest.spyOn(CurriculumModel, 'find').mockResolvedValue([] as never);
    const createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue({} as never);
    jest.spyOn(CountyAdditionModel, 'find').mockResolvedValue([] as never);
    const countyCreate = jest.spyOn(CountyAdditionModel, 'create').mockResolvedValue({} as never);
    const rep = await applyImport(coFile, doc(), { commit: true });
    expect(createSpy).not.toHaveBeenCalled();
    expect(findSpy).not.toHaveBeenCalled();
    expect(countyCreate).toHaveBeenCalledTimes(1);
    expect(rep).toMatchObject({ created: 0, updated: 0, unchanged: 0, skippedPublished: 0, chapters: 0, topics: 0, countyAdditions: 1, subjectsSeen: [], highSchoolCourses: 0, highSchoolMerged: [], subjectsSkippedNotVerified: [], emptySubjects: [] });
  });
});

describe('high school courses', () => {
  const hs = (grade: string, subjects: ParsedDoc['grades'][number]['subjects']) => ({ grade, level: 'HIGH_SCHOOL' as const, subjects });
  const subj = (name: string, courseName: string | undefined, chapters: { title: string; topics: string[] }[]) =>
    ({ name, ...(courseName ? { courseName } : {}), notVerified: false, chapters });
  const hsDoc = () => mkDoc({ grades: [
    { grade: 'Grade 8', level: 'GRADE', subjects: [subj('Mathematics', 'Pre-Algebra', [{ title: 'Ratios', topics: ['r'] }])] },
    hs('Grade 9', [
      subj('Mathematics', 'Algebra I', [{ title: 'Linear', topics: ['a', 'b'] }]),
      subj('Computer Science', undefined, [{ title: 'Code', topics: ['x'] }]),
      { name: 'Dance', notVerified: true, chapters: [] },
    ]),
    hs('Grade 10', [
      subj('Computer Science', undefined, [{ title: 'Code', topics: ['x', 'y'] }, { title: 'Data', topics: ['d'] }]),
      subj('Science', 'Biology (High School Life Science)', [{ title: 'Cells', topics: ['c'] }]),
    ]),
    hs('Grade 12', [subj('Computer Science', undefined, [{ title: 'Networks', topics: ['n'] }, { title: 'Code', topics: ['z', 'x'] }])]),
  ] });

  it('plans one curriculum per (subject, course) across Grades 9-12 with the High School fields', () => {
    const plan = planImport(file, hsDoc());
    const hsPlan = plan.filter((p) => p.level === 'HIGH_SCHOOL');
    expect(hsPlan.map((p) => [p.title, p.key.grade, p.key.courseName, p.usualGrade])).toEqual([
      ['Mathematics - Algebra I - High School', 'High School', 'Algebra I', 'Grade 9'],
      ['Computer Science - High School', 'High School', 'Computer Science', 'Grade 9'],
      ['Science - Biology (High School Life Science) - High School', 'High School', 'Biology (High School Life Science)', 'Grade 10'],
    ]);
    const cs = hsPlan[1];
    expect(cs.chapters).toEqual([
      { title: 'Code', topics: ['x', 'y', 'z'] },
      { title: 'Data', topics: ['d'] },
      { title: 'Networks', topics: ['n'] },
    ]);
    // K-8 is untouched
    expect(plan[0]).toMatchObject({ title: 'Mathematics - Pre-Algebra - Grade 8', level: 'GRADE', key: { grade: 'Grade 8', courseName: 'Pre-Algebra' } });
    expect(plan[0].usualGrade).toBeUndefined();
  });

  it('usualGrade is the lowest grade even when a later grade comes first in the file', () => {
    const doc = mkDoc({ grades: [
      hs('Grade 11', [subj('Music', undefined, [{ title: 'A', topics: ['1'] }])]),
      hs('Grade 10', [subj('Music', undefined, [{ title: 'B', topics: ['2'] }])]),
    ] });
    const [p] = planImport(file, doc);
    expect(p.usualGrade).toBe('Grade 10');
    expect(p.chapters.map((c) => c.title)).toEqual(['A', 'B']);
  });

  it('reports course counts and merges; Not verified HS subjects import nothing', async () => {
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([] as never);
    const createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue({} as never);
    jest.spyOn(CountyAdditionModel, 'find').mockResolvedValue([] as never);
    const rep = await applyImport(file, hsDoc(), { commit: true });
    expect(rep.highSchoolCourses).toBe(3);
    expect(rep.highSchoolMerged).toEqual(['Computer Science / Computer Science: grades 9,10,12']);
    expect(rep.subjectsSkippedNotVerified).toEqual(['Grade 9 / Dance']);
    expect(rep.created).toBe(4);
    const created = createSpy.mock.calls.map((c) => c[0] as any);
    expect(created.find((c) => c.subject === 'Computer Science')).toMatchObject({
      grade: 'High School', level: 'HIGH_SCHOOL', courseName: 'Computer Science', usualGrade: 'Grade 9',
      title: 'Computer Science - High School', isPublished: false,
    });
    expect(created.find((c) => c.grade === 'Grade 8').usualGrade).toBeUndefined();
  });

  it('is idempotent: an existing identical High School draft is unchanged; a changed usualGrade updates it', async () => {
    jest.spyOn(CountyAdditionModel, 'find').mockResolvedValue([] as never);
    const doc = mkDoc({ grades: [hs('Grade 9', [subj('Mathematics', 'Algebra I', [{ title: 'Linear', topics: ['a'] }])])] });
    const existing: any = {
      subject: 'Mathematics', grade: 'High School', courseName: 'Algebra I', stateCode: 'CO', isPublished: false,
      title: 'Mathematics - Algebra I - High School', level: 'HIGH_SCHOOL', usualGrade: 'Grade 9', sourceKind: 'revised',
      source: { name: 'CAS', year: 2020, url: 'https://x.org/m' },
      chapters: [{ publicId: 'ch1', title: 'Linear', order: 0, topics: [{ publicId: 't1', title: 'a', order: 0 }] }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    // a same-subject Grade 9 K-8-style row must not be matched by the High School key
    const legacy: any = { ...existing, grade: 'Grade 9', courseName: 'Algebra I', level: 'GRADE', usualGrade: undefined, save: jest.fn() };
    jest.spyOn(CurriculumModel, 'find').mockResolvedValue([legacy, existing] as never);
    const createSpy = jest.spyOn(CurriculumModel, 'create').mockResolvedValue({} as never);
    expect(await applyImport(file, doc, { commit: true })).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(existing.save).not.toHaveBeenCalled();
    expect(legacy.save).not.toHaveBeenCalled();
    expect(createSpy).not.toHaveBeenCalled();

    existing.usualGrade = 'Grade 10';
    expect(await applyImport(file, doc, { commit: true })).toMatchObject({ updated: 1 });
    expect(existing.usualGrade).toBe('Grade 9');
    expect(existing.chapters[0].publicId).toBe('ch1');
  });
});
