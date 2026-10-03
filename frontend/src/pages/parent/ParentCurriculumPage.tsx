// frontend/src/pages/parent/ParentCurriculumPage.tsx
//
// Parent view of the state curriculum for one child (state + grade come from the child's profile).
// Same tiles as the student page; "Create course" opens the request form for that child.
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Inbox } from 'lucide-react';
import { useParentChildren } from '../../hooks/use-parent';
import { useStateCatalog } from '../../hooks/use-curricula';
import { useUsStates } from '../../hooks/use-geo';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Loading';
import { CurriculumBrowser, type CourseSelection } from '../../features/curriculum/CurriculumBrowser';
import { ALL_GRADES, GradeFilter, filterForGrade } from '../../features/curriculum/GradeFilter';
import { CountyPrograms } from '../../features/curriculum/CountyPrograms';

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <div className="flex flex-col items-center gap-3 py-14 text-center">{children}</div>
      </CardContent>
    </Card>
  );
}

export function ParentCurriculumPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const child = children.find((c) => c.publicId === searchParams.get('child')) ?? children[0];
  const stateCode = child?.state;
  const [picked, setPicked] = useState<string | undefined>();
  const filter = picked ?? filterForGrade(child?.grade);

  const catalog = useStateCatalog(stateCode);
  const { data: states } = useUsStates();

  if (childrenLoading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!child) {
    return (
      <div className="animate-fade-in">
        <PageHeader eyebrow="Family" title="Curriculum" icon={<BookOpen className="h-5 w-5" />} />
        <Message>
          <Inbox className="h-6 w-6 text-gray-400" />
          <p className="text-sm text-gray-500">Link a child first to browse their curriculum.</p>
          <Link to="/dashboard/parent/children" className="text-sm text-brand-600 hover:underline">My children</Link>
        </Message>
      </div>
    );
  }

  const stateName = states?.find((st) => st.code === stateCode)?.name ?? stateCode;
  const listed = catalog.data?.curricula ?? [];
  const visible = filter === ALL_GRADES ? listed : listed.filter((c) => c.grade === filter);

  const onCreate = (selection: CourseSelection) =>
    navigate(`/dashboard/parent/curriculum/${child.publicId}/${selection.curriculumPublicId}`, { state: selection });

  let body: React.ReactNode;
  if (!stateCode) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">{child.firstName}'s state isn't set yet. Add where they go to school to see their curriculum.</p>
        <Link to="/dashboard/parent/children" className="text-sm text-brand-600 hover:underline">Set {child.firstName}'s state and county</Link>
      </Message>
    );
  } else if (catalog.isLoading) {
    body = <div className="flex justify-center py-16"><Spinner /></div>;
  } else if (!catalog.data?.stateLoaded) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">The curriculum for {stateName} isn't available yet. We're adding states over time.</p>
      </Message>
    );
  } else if (visible.length === 0) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">{filter === ALL_GRADES ? `No published curriculum yet in ${stateName}.` : `No published curriculum yet for ${filter} in ${stateName}.`}</p>
      </Message>
    );
  } else {
    body = <CurriculumBrowser key={`${child.publicId}-${filter}`} curricula={visible} onCreate={onCreate} />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Family"
        title="Curriculum"
        description={`${child.firstName}${stateName ? ` · ${stateName}` : ''} · open a subject, pick chapters and topics, then create a course`}
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          <>
            {children.length > 1 && (
              <div className="w-44">
                <Select
                  options={children.map((c) => ({ value: c.publicId, label: `${c.firstName} ${c.lastName}`.trim() }))}
                  value={child.publicId}
                  onChange={(e) => { setPicked(undefined); setSearchParams({ child: e.target.value }, { replace: true }); }}
                />
              </div>
            )}
            <GradeFilter value={filter} onChange={setPicked} />
          </>
        }
      />
      {body}
      <CountyPrograms stateCode={stateCode} countyFips={child.countyFips} countyName={child.county} gradeFilter={filter} />
    </div>
  );
}
