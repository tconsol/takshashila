// frontend/src/pages/student/StudentCurriculumPage.tsx
//
// grade/district live on the Student PROFILE (server/src/modules/students/student.model.ts),
// not on the User/auth object, so this reads them via `useMyStudentProfile()`.
// Two tabs: "My grade" (the student's grade in their district) and "All grades"
// (every published curriculum in the district, grouped by grade). The tab is kept in
// the URL (?tab=all) so back/refresh keep it.
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, ArrowRight, Inbox } from 'lucide-react';
import { useMyStudentProfile } from '../../hooks/use-students';
import { useCurriculumCatalog } from '../../hooks/use-curricula';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { GRADE_LIST } from '../../constants/grades';
import type { Curriculum } from '../../services/curricula.service';

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

function CurriculumGrid({ curricula }: { curricula: Curriculum[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {curricula.map((curriculum) => (
        <Link key={curriculum.publicId} to={`/dashboard/student/curriculum/${curriculum.publicId}`}>
          <Card className="h-full hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
            <CardContent>
              <Badge variant="info" tone="soft">{curriculum.subject}</Badge>
              <p className="mt-2 font-semibold text-gray-900 dark:text-white">{curriculum.title}</p>
              <p className="mt-1 text-xs text-gray-500">{curriculum.topics.length} topics</p>
            </CardContent>
          </Card>
        </Link>
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
  const districtId = profile?.districtId;
  const grade = profile?.grade;

  const mine = useCurriculumCatalog({ districtId: grade ? districtId : undefined, grade: grade || undefined });
  const all = useCurriculumCatalog({ districtId });
  const active = tab === 'all' ? all : mine;

  if (profileLoading) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  if (!districtId) {
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow="Curricula" title="Curriculum" icon={<BookOpen className="h-5 w-5" />} />
        <Message>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Set your school district in your profile to see your curriculum.
          </p>
          <ProfileLink />
        </Message>
      </div>
    );
  }

  const where = `${profile?.district}, ${profile?.state}`;

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
  } else if (!active.data || active.data.length === 0) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">
          {tab === 'mine' ? `No published curriculum yet for ${grade} in ${where}.` : `No published curriculum yet in ${where}.`}
        </p>
      </Message>
    );
  } else if (tab === 'mine') {
    body = <CurriculumGrid curricula={active.data} />;
  } else {
    body = (
      <div className="space-y-8">
        {groupByGrade(active.data).map(([g, curricula]) => (
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
