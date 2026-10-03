// frontend/src/features/curriculum/CurriculumBrowser.tsx
//
// Shared by the student and parent curriculum pages. One tile per subject; click a tile to
// expand it to its chapters, click a chapter to expand it to its topics. Chapters and topics
// are both selectable; ticking a chapter ticks all its topics. The selection is bundled into
// a course request for one curriculum at a time.
import { useMemo, useState } from 'react';
import { Check, ChevronRight, Minus } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Curriculum, CurriculumChapter } from '../../services/curricula.service';

export interface CourseSelection {
  curriculumPublicId: string;
  chapterPublicIds: string[];
  topicPublicIds: string[];
}

interface Picked { chapters: Set<string>; topics: Set<string> }
const EMPTY: Picked = { chapters: new Set(), topics: new Set() };

/** Imported curricula carry `chapters`; legacy ones only a flat `topics` list, shown as chapters without topics. */
const chaptersOf = (c: Curriculum): CurriculumChapter[] =>
  [...(c.chapters?.length ? c.chapters : c.topics.map((t) => ({ ...t, topics: [] })))]
    .sort((a, b) => a.order - b.order)
    .map((ch) => ({ ...ch, topics: [...ch.topics].sort((a, b) => a.order - b.order) }));

function Box({ state }: { state: 'on' | 'some' | 'off' }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
        state === 'off' ? 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900' : 'border-brand-600 bg-brand-600 text-white'
      }`}
    >
      {state === 'on' && <Check className="h-3 w-3" />}
      {state === 'some' && <Minus className="h-3 w-3" />}
    </span>
  );
}

function CurriculumBlock({ curriculum, showTitle, onCreate }: {
  curriculum: Curriculum;
  showTitle: boolean;
  onCreate: (s: CourseSelection) => void;
}) {
  const chapters = useMemo(() => chaptersOf(curriculum), [curriculum]);
  const [picked, setPicked] = useState<Picked>(EMPTY);
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  const toggleChapter = (ch: CurriculumChapter) =>
    setPicked((prev) => {
      const chapterSet = new Set(prev.chapters);
      const topicSet = new Set(prev.topics);
      const allOn = chapterSet.has(ch.publicId) && ch.topics.every((t) => topicSet.has(t.publicId));
      if (allOn) {
        chapterSet.delete(ch.publicId);
        ch.topics.forEach((t) => topicSet.delete(t.publicId));
      } else {
        chapterSet.add(ch.publicId);
        ch.topics.forEach((t) => topicSet.add(t.publicId));
      }
      return { chapters: chapterSet, topics: topicSet };
    });

  const toggleTopic = (ch: CurriculumChapter, topicId: string) =>
    setPicked((prev) => {
      const chapterSet = new Set(prev.chapters);
      const topicSet = new Set(prev.topics);
      if (topicSet.has(topicId)) topicSet.delete(topicId); else topicSet.add(topicId);
      if (ch.topics.some((t) => topicSet.has(t.publicId))) chapterSet.add(ch.publicId); else chapterSet.delete(ch.publicId);
      return { chapters: chapterSet, topics: topicSet };
    });

  const chapterState = (ch: CurriculumChapter): 'on' | 'some' | 'off' => {
    if (!picked.chapters.has(ch.publicId)) return 'off';
    const n = ch.topics.filter((t) => picked.topics.has(t.publicId)).length;
    return n === ch.topics.length ? 'on' : 'some';
  };

  return (
    <div>
      {showTitle && (
        <div className="mb-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{curriculum.title}</p>
          <p className="text-xs text-gray-500">
            {[curriculum.courseName && curriculum.courseName !== curriculum.subject && `Course: ${curriculum.courseName}`, curriculum.grade].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
      <ul className="space-y-1.5">
        {chapters.map((ch) => {
          const open = openChapter === ch.publicId;
          return (
            <li key={ch.publicId} className="rounded-lg border border-rule">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" role="checkbox" aria-checked={chapterState(ch) === 'some' ? 'mixed' : chapterState(ch) === 'on'} aria-label={`Select chapter ${ch.title}`} onClick={() => toggleChapter(ch)}>
                  <Box state={chapterState(ch)} />
                </button>
                <button
                  type="button"
                  aria-expanded={open}
                  disabled={ch.topics.length === 0}
                  onClick={() => setOpenChapter(open ? null : ch.publicId)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span className="flex-1 text-sm text-gray-800 dark:text-gray-200">{ch.title}</span>
                  {ch.topics.length > 0 && (
                    <>
                      <span className="text-xs text-gray-500">{ch.topics.length} {ch.topics.length === 1 ? 'topic' : 'topics'}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </button>
              </div>
              {open && (
                <ul className="space-y-0.5 border-t border-rule px-3 py-2 pl-9">
                  {ch.topics.map((t) => (
                    <li key={t.publicId}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={picked.topics.has(t.publicId)}
                        onClick={() => toggleTopic(ch, t.publicId)}
                        className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm text-gray-600 hover:bg-surface-hover dark:text-gray-400"
                      >
                        <Box state={picked.topics.has(t.publicId) ? 'on' : 'off'} />
                        <span>{t.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {picked.chapters.size > 0 && (
        <div className="sticky bottom-2 mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 dark:border-brand-900 dark:bg-brand-900/30">
          <p className="flex-1 text-xs font-medium text-gray-700 dark:text-gray-200">
            {picked.chapters.size} {picked.chapters.size === 1 ? 'chapter' : 'chapters'}
            {picked.topics.size > 0 && `, ${picked.topics.size} ${picked.topics.size === 1 ? 'topic' : 'topics'}`} selected
          </p>
          <Button size="sm" variant="outline" onClick={() => setPicked(EMPTY)}>Clear</Button>
          <Button
            size="sm"
            variant="gradient"
            onClick={() => onCreate({ curriculumPublicId: curriculum.publicId, chapterPublicIds: [...picked.chapters], topicPublicIds: [...picked.topics] })}
          >
            Create course
          </Button>
        </div>
      )}
    </div>
  );
}

function SubjectTile({ subject, curricula, onCreate }: { subject: string; curricula: Curriculum[]; onCreate: (s: CourseSelection) => void }) {
  const [open, setOpen] = useState(false);
  const chapterCount = curricula.reduce((n, c) => n + chaptersOf(c).length, 0);
  const topicCount = curricula.reduce((n, c) => n + chaptersOf(c).reduce((m, ch) => m + ch.topics.length, 0), 0);

  return (
    <div className={`rounded-xl border border-rule bg-surface ${open ? 'col-span-full' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{subject}</p>
          <p className="mt-0.5 text-xs text-gray-500">{chapterCount} chapters · {topicCount} topics</p>
        </div>
        {curricula.length > 1 && <Badge variant="info" tone="soft">{curricula.length} courses</Badge>}
        <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-rule p-4">
          {curricula.map((c) => (
            <div key={c.publicId}>
              <CurriculumBlock curriculum={c} showTitle={curricula.length > 1} onCreate={onCreate} />
              {c.source && (
                <p className="mt-2 text-xs text-gray-500">
                  Source:{' '}
                  {c.source.url
                    ? <a href={c.source.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{[c.source.name, c.source.year].filter(Boolean).join(', ')}</a>
                    : [c.source.name, c.source.year].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CurriculumBrowser({ curricula, onCreate }: { curricula: Curriculum[]; onCreate: (s: CourseSelection) => void }) {
  const bySubject = useMemo(() => {
    const m = new Map<string, Curriculum[]>();
    for (const c of curricula) m.set(c.subject, [...(m.get(c.subject) ?? []), c]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [curricula]);

  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {bySubject.map(([subject, list]) => (
        <SubjectTile key={subject} subject={subject} curricula={list} onCreate={onCreate} />
      ))}
    </div>
  );
}
