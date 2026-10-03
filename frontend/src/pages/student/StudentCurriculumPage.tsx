// frontend/src/pages/student/StudentCurriculumPage.tsx
//
// grade/district live on the Student PROFILE (server/src/modules/students/student.model.ts),
// not on the User/auth object, so this reads them via `useMyStudentProfile()`.
// Curricula are looked up by the student's STATE (USPS code stored on the profile).
// One tile per subject (expand → chapters → topics); a grade filter sits top right and starts
// on the student's own grade. High school is organised by course under the 'High School' filter.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, Inbox } from 'lucide-react';
import { useMyStudentProfile } from '../../hooks/use-students';
import { useStateCatalog } from '../../hooks/use-curricula';
import { useUsStates } from '../../hooks/use-geo';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { CurriculumBrowser, type CourseSelection } from '../../features/curriculum/CurriculumBrowser';
import { ALL_GRADES, GradeFilter, filterForGrade } from '../../features/curriculum/GradeFilter';
import { CountyPrograms } from '../../features/curriculum/CountyPrograms';

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

export function StudentCurriculumPage() {
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useMyStudentProfile();
  const stateCode = profile?.state;
  const grade = profile?.grade;
  // undefined until the user picks one; then their pick wins over the default (own grade).
  const [picked, setPicked] = useState<string | undefined>();
  const filter = picked ?? filterForGrade(grade);

  const all = useStateCatalog(stateCode);
  const { data: states } = useUsStates();

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

  const stateName = states?.find((st) => st.code === stateCode)?.name ?? stateCode;
  const listed = all.data?.curricula ?? [];
  const visible = filter === ALL_GRADES ? listed : listed.filter((c) => c.grade === filter);

  const onCreate = (selection: CourseSelection) =>
    navigate(`/dashboard/student/curriculum/${selection.curriculumPublicId}`, { state: selection });

  let body: React.ReactNode;
  if (all.isLoading) {
    body = <div className="flex justify-center py-16"><Spinner /></div>;
  } else if (!all.data) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">Couldn't load curricula. Please try again.</p>
      </Message>
    );
  } else if (!all.data.stateLoaded) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">Your state's curriculum isn't available yet. We're adding states over time.</p>
      </Message>
    );
  } else if (visible.length === 0) {
    body = (
      <Message>
        <Inbox className="h-6 w-6 text-gray-400" />
        <p className="text-sm text-gray-500">
          {filter === ALL_GRADES ? `No published curriculum yet in ${stateName}.` : `No published curriculum yet for ${filter} in ${stateName}.`}
        </p>
      </Message>
    );
  } else {
    body = <CurriculumBrowser key={filter} curricula={visible} onCreate={onCreate} />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Curricula"
        title="Curriculum"
        description={`${stateName} · open a subject, pick chapters and topics, then create a course`}
        icon={<BookOpen className="h-5 w-5" />}
        actions={<GradeFilter value={filter} onChange={setPicked} />}
      />
      {body}
      <CountyPrograms stateCode={stateCode} countyFips={profile?.countyFips} countyName={profile?.county} gradeFilter={filter} />
    </div>
  );
}
