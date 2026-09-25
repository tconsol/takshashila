// frontend/src/features/programs/ProgramEnrollmentView.tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useEnrollmentStructure } from '../../hooks/use-programs';
import { CourseStructureTree } from '../courses/CourseStructureTree';
import { categoryLabel, levelLabel } from '../../constants/programs';

export function ProgramEnrollmentView({ enrollmentPublicId, backTo, backLabel, actions }: {
  enrollmentPublicId?: string;
  backTo: string;
  backLabel: string;
  actions?: ReactNode;
}) {
  const { data, isLoading, isError } = useEnrollmentStructure(enrollmentPublicId);
  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) {
    return <div className="py-16 text-center text-sm text-gray-500">Enrollment not found. <Link to={backTo} className="text-brand-600 hover:underline">{backLabel}</Link></div>;
  }
  const { enrollment, program, topics, otherClasses, viewerRole } = data;
  const showStatus = viewerRole === 'STUDENT' || viewerRole === 'PARENT';
  const pct = enrollment.sessionCount ? Math.round((enrollment.sessionsCompletedCount / enrollment.sessionCount) * 100) : 0;
  const who = viewerRole === 'TUTOR' ? `for ${enrollment.studentName}` : `with ${enrollment.tutorName}`;

  return (
    <div className="animate-fade-in">
      <Link to={backTo} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
      </Link>
      <PageHeader
        eyebrow="Skill program"
        title={program.title}
        description={`${categoryLabel(program.category)} · ${levelLabel(program.level)} · ${who}`}
        icon={<Sparkles className="h-5 w-5" />}
        actions={actions}
      />
      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">
              {enrollment.sessionsCompletedCount}/{enrollment.sessionCount} sessions completed
            </span>
            <span className="text-xs text-gray-500">{enrollment.sessionsScheduledCount} scheduled · {enrollment.status.toLowerCase()}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <CourseStructureTree topics={topics} otherClasses={otherClasses} showStatus={showStatus} hideMaterials onOpenMaterial={() => undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
