import { v4 as uuidv4 } from 'uuid';
import { CurriculumModel } from '../curriculum.model';
import { CountyAdditionModel } from '../county-addition.model';
import type { ICurriculumChapter, ICurriculumSource } from '../curriculum.types';
import type { ParsedDoc } from './curriculum-parser';
import { parseSources, pickSource } from './sources-parser';
import { parseCountyAdditions } from './county-parser';

export interface ImportFile { path: string; stateCode: string; kind: 'revised' | 'master'; /** only county additions are taken from this file */ countyOnly?: boolean }

export interface StateReport {
  stateCode: string; kind: 'revised' | 'master';
  created: number; updated: number; unchanged: number; skippedPublished: number;
  chapters: number; topics: number;
  subjectsSkippedNotVerified: string[]; emptySubjects: string[];
  emptyChapters: string[]; missingCitation: string[]; missingSourceUrl: string[]; highSchoolSkipped: string[];
  countyAdditions: number; subjectsSeen: string[];
  duplicateSubjects: string[];
}

export interface PlannedCurriculum {
  key: { stateCode: string; subject: string; grade: string; courseName?: string };
  title: string;
  level: 'KINDERGARTEN' | 'GRADE';
  source?: ICurriculumSource;
  chapters: { title: string; topics: string[] }[];
}

const ADMIN = 'system:curriculum-import';
const uniq = (xs: string[]) => [...new Set(xs)];

/** Pure: everything derived from the parsed document, no database. */
function buildPlan(file: ImportFile, doc: ParsedDoc) {
  const sources = parseSources(doc.sourceParagraphs);
  const report: StateReport = {
    stateCode: file.stateCode, kind: file.kind,
    created: 0, updated: 0, unchanged: 0, skippedPublished: 0, chapters: 0, topics: 0,
    subjectsSkippedNotVerified: [], emptySubjects: [], emptyChapters: [], missingCitation: [], missingSourceUrl: [],
    highSchoolSkipped: [...doc.skippedHighSchoolGrades], countyAdditions: 0, subjectsSeen: [], duplicateSubjects: [],
  };
  const plan: PlannedCurriculum[] = [];
  if (file.countyOnly) {
    report.highSchoolSkipped = [];
    const county = parseCountyAdditions(doc.countyParagraphs);
    report.countyAdditions = county.length;
    return { plan, report, county };
  }
  const noCitation: string[] = [];
  const noUrl: string[] = [];
  const seen: string[] = [];

  for (const g of doc.grades) {
    const byKey = new Map<string, PlannedCurriculum>();
    for (const s of g.subjects) {
      const label = s.courseName ? `${s.name} (${s.courseName})` : s.name;
      const where = `${g.grade} / ${label}`;
      seen.push(s.name);
      if (s.notVerified) { report.subjectsSkippedNotVerified.push(where); continue; }
      if (!s.chapters.length) { report.emptySubjects.push(where); continue; }

      const mapKey = `${s.name}\u0000${s.courseName ?? ''}`;
      const chapters = s.chapters.map((c) => ({ title: c.title, topics: [...c.topics] }));
      const dup = byKey.get(mapKey);
      if (dup) {
        dup.chapters.push(...chapters);
        report.duplicateSubjects.push(where);
        continue;
      }
      const ref = pickSource(sources, s.name);
      if (!ref) noCitation.push(s.name);
      else if (!ref.url) noUrl.push(s.name);
      const p: PlannedCurriculum = {
        key: { stateCode: file.stateCode, subject: s.name, grade: g.grade, ...(s.courseName ? { courseName: s.courseName } : {}) },
        title: `${s.name}${s.courseName ? ' - ' + s.courseName : ''} - ${g.grade}`,
        level: g.level,
        ...(ref ? { source: { name: ref.name, year: ref.year, url: ref.url } } : {}),
        chapters,
      };
      byKey.set(mapKey, p);
      plan.push(p);
    }
  }
  for (const p of plan) {
    report.chapters += p.chapters.length;
    for (const c of p.chapters) {
      report.topics += c.topics.length;
      if (!c.topics.length) report.emptyChapters.push(`${p.key.grade} / ${p.key.subject} / ${c.title}`);
    }
  }
  report.missingCitation = uniq(noCitation);
  report.missingSourceUrl = uniq(noUrl);
  report.subjectsSeen = uniq(seen);
  const county = parseCountyAdditions(doc.countyParagraphs);
  report.countyAdditions = county.length;
  return { plan, report, county };
}

export function planImport(file: ImportFile, doc: ParsedDoc): PlannedCurriculum[] {
  return buildPlan(file, doc).plan;
}

/** Rebuilds chapters/topics keeping publicIds of same-titled chapters (and same-titled topics within them). */
function rebuildChapters(planned: PlannedCurriculum['chapters'], existing: ICurriculumChapter[]): ICurriculumChapter[] {
  const pool = new Map<string, ICurriculumChapter[]>();
  for (const c of existing) {
    if (!pool.has(c.title)) pool.set(c.title, []);
    pool.get(c.title)!.push(c);
  }
  return planned.map((c, i) => {
    const old = pool.get(c.title)?.shift();
    const topicPool = new Map<string, string[]>();
    for (const t of old?.topics ?? []) {
      if (!topicPool.has(t.title)) topicPool.set(t.title, []);
      topicPool.get(t.title)!.push(t.publicId);
    }
    return {
      publicId: old?.publicId ?? uuidv4(),
      title: c.title,
      order: i,
      topics: c.topics.map((title, j) => ({ publicId: topicPool.get(title)?.shift() ?? uuidv4(), title, order: j })),
    };
  });
}

const shape = (chapters: ICurriculumChapter[]) =>
  JSON.stringify(chapters.map((c) => [c.publicId, c.title, c.order, (c.topics ?? []).map((t) => [t.publicId, t.title, t.order])]));
const srcShape = (s?: ICurriculumSource | null) => (s ? JSON.stringify([s.name, s.year ?? null, s.url ?? '']) : '');

export async function applyImport(file: ImportFile, doc: ParsedDoc, opts: { commit: boolean }): Promise<StateReport> {
  const { plan, report, county } = buildPlan(file, doc);
  const stateCode = file.stateCode.toUpperCase();

  const existing = file.countyOnly ? [] : await CurriculumModel.find({ stateCode, isDeleted: { $ne: true }, districtId: null });
  const index = new Map<string, (typeof existing)[number]>();
  for (const e of existing) {
    const k = `${e.grade}\u0000${e.subject}\u0000${e.courseName ?? ''}`;
    if (!index.has(k)) index.set(k, e);
  }

  for (const p of plan) {
    const found = index.get(`${p.key.grade}\u0000${p.key.subject}\u0000${p.key.courseName ?? ''}`);
    if (!found) {
      report.created++;
      if (opts.commit) {
        // create() (not insertMany/update queries) so the topics mirror pre-validate hook runs
        await CurriculumModel.create({
          country: 'US', stateCode, grade: p.key.grade, subject: p.key.subject,
          ...(p.key.courseName ? { courseName: p.key.courseName } : {}),
          title: p.title, level: p.level, ...(p.source ? { source: p.source } : {}),
          sourceKind: file.kind, chapters: rebuildChapters(p.chapters, []),
          createdByAdminPublicId: ADMIN, isPublished: false,
        });
      }
      continue;
    }
    if (found.isPublished) { report.skippedPublished++; continue; }

    const chapters = rebuildChapters(p.chapters, found.chapters ?? []);
    const changed =
      shape(chapters) !== shape(found.chapters ?? []) ||
      found.title !== p.title || found.level !== p.level || found.sourceKind !== file.kind ||
      (!!p.source && srcShape(p.source) !== srcShape(found.source));
    if (!changed) { report.unchanged++; continue; }
    report.updated++;
    if (opts.commit) {
      found.title = p.title;
      found.level = p.level;
      found.sourceKind = file.kind;
      if (p.source) found.source = p.source;
      found.chapters = chapters;
      await found.save();
    }
  }

  if (county.length) {
    const existingCounty = await CountyAdditionModel.find({ stateCode });
    const ck = (c: { county: string; district?: string; gradeFrom: number; gradeTo: number; category: string }) =>
      JSON.stringify([c.county, c.district ?? '', c.gradeFrom, c.gradeTo, c.category]);
    const cIndex = new Map(existingCounty.map((c) => [ck(c), c]));
    for (const c of county) {
      const found = cIndex.get(ck(c));
      if (!found) {
        if (opts.commit) await CountyAdditionModel.create({ ...c, stateCode, isPublished: false });
      } else if (!found.isPublished && found.description !== c.description && opts.commit) {
        found.description = c.description;
        await found.save();
      }
    }
  }
  return report;
}
