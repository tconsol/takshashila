// frontend/src/features/curriculum/CurriculumBrowser.tsx
//
// Shared by the student and parent curriculum pages. One tile per subject; click a tile to
// expand it to its chapters, click a chapter to expand it to its topics. Chapters and topics
// are both selectable; ticking a chapter ticks all its topics. The selection is bundled into
// a course request for one curriculum at a time. A search box narrows subjects, chapters and
// topics and opens the matches.
import { useMemo, useState, type ComponentType } from 'react';
import {
  BookText, Calculator, Check, ChevronRight, Cpu, FlaskConical, Globe, Landmark, Languages,
  Minus, Music, Palette, Search, BookOpen, Dumbbell, X,
} from 'lucide-react';
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

// ---- subject identity: an icon and a colour per subject, so tiles are recognisable at a glance ----

interface Look { icon: ComponentType<{ className?: string }>; chip: string; bar: string }

const PALETTE = {
  sky: { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300', bar: 'bg-sky-500' },
  emerald: { chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', bar: 'bg-emerald-500' },
  amber: { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', bar: 'bg-amber-500' },
  rose: { chip: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', bar: 'bg-rose-500' },
  violet: { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', bar: 'bg-violet-500' },
  teal: { chip: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300', bar: 'bg-teal-500' },
} as const;

const RULES: Array<[RegExp, Look]> = [
  [/math|algebra|geometry|calculus|statistic/i, { icon: Calculator, ...PALETTE.sky }],
  [/science|biology|chemistry|physics|earth/i, { icon: FlaskConical, ...PALETTE.emerald }],
  [/english|reading|writing|literature|language arts|ela/i, { icon: BookText, ...PALETTE.rose }],
  [/social|history|civics|government|economics/i, { icon: Landmark, ...PALETTE.amber }],
  [/geograph|world/i, { icon: Globe, ...PALETTE.teal }],
  [/spanish|french|german|chinese|latin|foreign/i, { icon: Languages, ...PALETTE.violet }],
  [/art|design/i, { icon: Palette, ...PALETTE.rose }],
  [/music|band|choir/i, { icon: Music, ...PALETTE.violet }],
  [/computer|coding|technology|engineering/i, { icon: Cpu, ...PALETTE.teal }],
  [/physical|health|pe\b|sport/i, { icon: Dumbbell, ...PALETTE.emerald }],
];
const FALLBACK: Look = { icon: BookOpen, ...PALETTE.sky };
const lookFor = (subject: string): Look => RULES.find(([re]) => re.test(subject))?.[1] ?? FALLBACK;

const matches = (text: string, q: string) => text.toLowerCase().includes(q);

/** Animated show/hide without measuring heights. Content stays mounted, so selections survive closing. */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

function Box({ state }: { state: 'on' | 'some' | 'off' }) {
  return (
    <span
      aria-hidden
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
        state === 'off' ? 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900' : 'border-brand-600 bg-brand-600 text-white'
      }`}
    >
      {state === 'on' && <Check className="h-3 w-3" />}
      {state === 'some' && <Minus className="h-3 w-3" />}
    </span>
  );
}

function CurriculumBlock({ curriculum, showTitle, onCreate, query, bar }: {
  curriculum: Curriculum;
  showTitle: boolean;
  onCreate: (s: CourseSelection) => void;
  query: string;
  bar: string;
}) {
  const allChapters = useMemo(() => chaptersOf(curriculum), [curriculum]);
  const [picked, setPicked] = useState<Picked>(EMPTY);
  const [openChapter, setOpenChapter] = useState<string | null>(null);

  // While searching, show only chapters that match (by title, or through one of their topics).
  const subjectHit = !!query && matches(curriculum.subject, query);
  const chapters = query && !subjectHit
    ? allChapters.filter((ch) => matches(ch.title, query) || ch.topics.some((t) => matches(t.title, query)))
    : allChapters;

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

  const selectAll = () =>
    setPicked({
      chapters: new Set(allChapters.map((c) => c.publicId)),
      topics: new Set(allChapters.flatMap((c) => c.topics.map((t) => t.publicId))),
    });
  const everythingPicked = picked.chapters.size === allChapters.length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        {showTitle ? (
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{curriculum.title}</p>
            <p className="text-xs text-gray-500">
              {[curriculum.courseName && curriculum.courseName !== curriculum.subject && `Course: ${curriculum.courseName}`, curriculum.grade].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : <span />}
        <button
          type="button"
          onClick={() => (everythingPicked ? setPicked(EMPTY) : selectAll())}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          {everythingPicked ? 'Clear all' : 'Select all chapters'}
        </button>
      </div>

      {chapters.length === 0 && <p className="py-4 text-sm text-gray-500">Nothing in this subject matches "{query}".</p>}

      <ul className="space-y-2">
        {chapters.map((ch) => {
          const index = allChapters.indexOf(ch) + 1;
          const state = chapterState(ch);
          const topicHit = !!query && ch.topics.some((t) => matches(t.title, query));
          const open = openChapter === ch.publicId || topicHit;
          return (
            <li
              key={ch.publicId}
              className={`overflow-hidden rounded-xl border transition-colors ${
                state === 'off' ? 'border-rule bg-surface' : 'border-brand-300 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-900/20'
              }`}
            >
              <div className="relative flex items-center gap-3 px-3 py-2.5">
                {state !== 'off' && <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === 'some' ? 'mixed' : state === 'on'}
                  aria-label={`Select chapter ${ch.title}`}
                  onClick={() => toggleChapter(ch)}
                  className="rounded p-1 -m-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <Box state={state} />
                </button>
                <button
                  type="button"
                  aria-expanded={open}
                  disabled={ch.topics.length === 0}
                  onClick={() => setOpenChapter(open ? null : ch.publicId)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-400">{index}</span>
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100">{ch.title}</span>
                  {ch.topics.length > 0 && (
                    <>
                      <span className="whitespace-nowrap text-xs text-gray-500">
                        {state === 'off' ? '' : `${ch.topics.filter((t) => picked.topics.has(t.publicId)).length}/`}{ch.topics.length} {ch.topics.length === 1 ? 'topic' : 'topics'}
                      </span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </button>
              </div>
              <Collapse open={open}>
                <ul className="space-y-0.5 border-t border-rule px-3 py-2 pl-12">
                  {ch.topics.map((t) => {
                    const on = picked.topics.has(t.publicId);
                    const hit = !!query && matches(t.title, query);
                    return (
                      <li key={t.publicId}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          tabIndex={open ? 0 : -1}
                          onClick={() => toggleTopic(ch, t.publicId)}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-hover ${
                            on ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                          } ${hit ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                        >
                          <Box state={on ? 'on' : 'off'} />
                          <span>{t.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Collapse>
            </li>
          );
        })}
      </ul>

      {picked.chapters.size > 0 && (
        <div className="sticky bottom-3 z-10 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur animate-fade-in dark:border-brand-900 dark:bg-gray-900/95">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {picked.chapters.size} {picked.chapters.size === 1 ? 'chapter' : 'chapters'}
              {picked.topics.size > 0 && `, ${picked.topics.size} ${picked.topics.size === 1 ? 'topic' : 'topics'}`} selected
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
              <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${Math.round((picked.chapters.size / allChapters.length) * 100)}%` }} />
            </div>
          </div>
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

function SubjectTile({ subject, curricula, onCreate, query }: { subject: string; curricula: Curriculum[]; onCreate: (s: CourseSelection) => void; query: string }) {
  const [openByUser, setOpen] = useState(false);
  const open = openByUser || !!query;
  const chapterCount = curricula.reduce((n, c) => n + chaptersOf(c).length, 0);
  const topicCount = curricula.reduce((n, c) => n + chaptersOf(c).reduce((m, ch) => m + ch.topics.length, 0), 0);
  const { icon: Icon, chip, bar } = lookFor(subject);

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-surface transition-all duration-200 motion-reduce:transition-none ${
        open ? 'col-span-full border-rule-strong shadow-sm' : 'border-rule hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
      >
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${chip}`}>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{subject}</p>
          <p className="mt-0.5 text-xs text-gray-500">{chapterCount} chapters · {topicCount} topics</p>
        </div>
        {curricula.length > 1 && <Badge variant="info" tone="soft">{curricula.length} courses</Badge>}
        <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      <Collapse open={open}>
        <div className="space-y-6 border-t border-rule p-4">
          {curricula.map((c) => (
            <div key={c.publicId}>
              <CurriculumBlock curriculum={c} showTitle={curricula.length > 1} onCreate={onCreate} query={query} bar={bar} />
              {c.source && (
                <p className="mt-3 text-xs text-gray-500">
                  Source:{' '}
                  {c.source.url
                    ? <a href={c.source.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{[c.source.name, c.source.year].filter(Boolean).join(', ')}</a>
                    : [c.source.name, c.source.year].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </Collapse>
    </div>
  );
}

export function CurriculumBrowser({ curricula, onCreate }: { curricula: Curriculum[]; onCreate: (s: CourseSelection) => void }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const bySubject = useMemo(() => {
    const m = new Map<string, Curriculum[]>();
    for (const c of curricula) m.set(c.subject, [...(m.get(c.subject) ?? []), c]);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [curricula]);

  const shown = query
    ? bySubject.filter(([subject, list]) =>
        matches(subject, query)
        || list.some((c) => chaptersOf(c).some((ch) => matches(ch.title, query) || ch.topics.some((t) => matches(t.title, query)))))
    : bySubject;

  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects, chapters or topics"
          aria-label="Search the curriculum"
          className="w-full rounded-xl border border-rule bg-surface py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:text-white dark:focus:ring-brand-900"
        />
        {search && (
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">No subject, chapter or topic matches "{search}".</p>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(([subject, list]) => (
            <SubjectTile key={subject} subject={subject} curricula={list} onCreate={onCreate} query={query} />
          ))}
        </div>
      )}
    </div>
  );
}
