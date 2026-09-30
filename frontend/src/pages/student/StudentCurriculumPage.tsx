// frontend/src/pages/student/StudentCurriculumPage.tsx
//
// grade/district live on the Student PROFILE (server/src/modules/students/student.model.ts),
// not on the User/auth object, so this reads them via `useMyStudentProfile()`.
// Curricula are looked up by the student's STATE (USPS code stored on the profile).
// Two tabs: "My grade" (the student's grade in their state) and "All grades"
// (every published curriculum in the state, grouped by grade). The tab is kept in
// the URL (?tab=all) so back/refresh keep it.
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ArrowRight, Inbox, ChevronRight } from 'lucide-react';
import { useMyStudentProfile } from '../../hooks/use-students';
import { useStateCatalog } from '../../hooks/use-curricula';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { GRADE_LIST } from '../../constants/grades';
import type { Curriculum, CurriculumChapter } from '../../services/curricula.service';

type TabKey = 'mine' | 'all';

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center py-14 text-center gap-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function ProfileLink() {
  return (
    <Link to="/profile" className="text-sm text-brand-600 hover:underline">
      Go to profile <ArrowRight className="inline h-3.5 w-3.5" />
    </Link>
  );
}

function SourceLine({ source }: { source: NonNullable<Curriculum['source']> }) {
  const label = [source.name, source.year].filter(Boolean).join(', ');
  return (
    <p className="mt-2 text-xs text-gray-500">
      Source:{' '}
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{label}</a>
      ) : label}
    </p>
  );
}

function ChapterList({ chapters }: { chapters: CurriculumChapter[] }) {
  return (
    <div className="mt-3 space-y-1">
      {[...chapters].sort((a, b) => a.order - b.order).map((chapter) => (
        <details key={chapter.publicId} className="group rounded-md border border-gray-200 dark:border-gray-700">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
            <span className="flex-1">{chapter.title}</span>
            <span className="text-xs text-gray-500">{chapter.topics.length} {chapter.topics.length === 1 ? 'topic' : 'topics'}</span>
          </summary>
          <ul className="list-disc space-y-1 px-3 pb-2 pl-9 text-sm text-gray-600 dark:text-gray-400">
            {[...chapter.topics].sort((a, b) => a.order - b.order).map((topic) => <li key={topic.publicId}>{topic.title}</li>)}
          </ul>
        </details>
      ))}
    </div>
  );
}

function CurriculumGrid({ curricula }: { curricula: Curriculum[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {curricula.map((curriculum) => (
        <Card key={curriculum.publicId} className="h-full">
          <CardContent>
            <Badge variant="info" tone="soft">{curriculum.subject}</Badge>
            <Link to={`/dashboard/student/curriculum/${curriculum.publicId}`} className="mt-2 block font-semibold text-gray-900 hover:text-brand-600 dark:text-white">
              {curriculum.title}
            </Link>
            {curriculum.chapters && curriculum.chapters.length > 0 ? (
              <ChapterList chapters={curriculum.chapters} />
            ) : (
              <p className="mt-1 text-xs text-gray-500">{curriculum.topics.length} topics</p>
            )}
            {curriculum.source && <SourceLine source={curriculum.source} />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Groups in GRADE_LIST order; grades the list doesn't know go last. Empty grades are omitted. */
function groupByGrade(curricula: Curriculum[]): Array<[string, Curriculum[]]> {
  const groups = new Map<string, Curriculum[]>();
  for (const c of curricula) groups.set(c.grade, [...(groups.get(c.grade) ?? []), c]);
  const rank = (g: string) => {
    const i = (GRADE_LIST as readonly string[]).indexOf(g);
    return i < 0 ? GRADE_LIST.length : i;
  };
  return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b));
}

export function StudentCurriculumPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabKey = searchParams.get('tab') === 'all' ? 'all' : 'mine';
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const stateCode = profile?.state;
  const grade = profile?.grade;

  const mine = useStateCatalog(grade ? stateCode : undefined, grade || undefined);
  const all = useStateCatalog(stateCode);
  const active = tab === 'all' ? all : mine;

  if (profileLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  if (!stateCode) {
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow="Curricula" title="Curriculum" icon={<BookOpen className="h-5 w-5" />} />
        <Message>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Set your state in your profile to see your curriculum.
          </p>
          <ProfileLink />
        </Message>
      </div>
    );
  }

  const where = stateCode;

  let body: React.ReactNode;
  if (tab === 'mine' && !grade) {
    body = (
      <Message>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Set your grade in your profile to see your grade's curriculum.</p>
        <ProfileLink />
      </Message>
    );
  } else if (active.isLoading) {
    body = <div className="flex justify-center py-16"><Spinner /></div>;
  } else if (!active.data) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">Couldn't load curricula. Please try again.</p>
      </Message>
    );
  } else if (!active.data.stateLoaded) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">Your state's curriculum isn't available yet. We're adding states over time.</p>
      </Message>
    );
  } else if (active.data.curricula.length === 0) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">
          {tab === 'mine' ? `No published curriculum yet for ${grade} in ${where}.` : `No published curriculum yet in ${where}.`}
        </p>
      </Message>
    );
  } else if (tab === 'mine') {
    body = <CurriculumGrid curricula={active.data.curricula} />;
  } else {
    body = (
      <div className="space-y-8">
        {groupByGrade(active.data.curricula).map(([g, curricula]) => (
          <section key={g}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{g}</h2>
              {g === grade && <Badge variant="success" tone="soft">Your grade</Badge>}
            </div>
            <CurriculumGrid curricula={curricula} />
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Curricula"
        title="Curriculum"
        description={tab === 'mine' && grade ? `${grade} curriculum · ${where}` : `All grades · ${where}`}
        icon={<BookOpen className="h-5 w-5" />}
      />
      <Tabs
        className="mb-5"
        tabs={[{ key: 'mine', label: 'My grade' }, { key: 'all', label: 'All grades' }]}
        activeTab={tab}
        onChange={(key) => setSearchParams(key === 'all' ? { tab: 'all' } : {}, { replace: true })}
      />
      {body}
    </div>
  );
}
