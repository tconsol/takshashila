// frontend/src/pages/tutor/TutorProgramPage.tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Sparkles, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useProgram, useProgramEnrollments } from '../../hooks/use-programs';
import { ProgramScheduleForm } from '../../features/programs/ProgramScheduleForm';
import { categoryLabel, levelLabel } from '../../constants/programs';

export function TutorProgramPage() {
  const { programPublicId } = useParams<{ programPublicId: string }>();
  const { data: program, isLoading } = useProgram(programPublicId);
  const { data: enrollments = [] } = useProgramEnrollments(programPublicId);
  const [open, setOpen] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!program) return <div className="py-16 text-center text-sm text-gray-500">Program not found.</div>;

  return (
    <div className="animate-fade-in">
      <Link to="/dashboard/tutor/programs" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Skill Programs
      </Link>
      <PageHeader eyebrow="Skill program" title={program.title}
        description={`${categoryLabel(program.category)} · ${levelLabel(program.level)} · ${program.sessionCount} sessions`}
        icon={<Sparkles className="h-5 w-5" />} />
      <Card>
        <CardContent>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-gray-400" /> Students</p>
          {enrollments.length === 0 ? (
            <p className="text-sm text-gray-500">No students yet.</p>
          ) : (
            <ul className="space-y-3">
              {enrollments.map((e) => (
                <li key={e.publicId} className="rounded-lg border border-rule p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{e.studentName}</p>
                      <p className="text-xs text-gray-500">{e.sessionsScheduledCount}/{e.sessionCount} scheduled · {e.sessionsCompletedCount} completed</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="soft" variant={e.status === 'ACTIVE' ? 'info' : e.status === 'COMPLETED' ? 'success' : 'default'}>{e.status}</Badge>
                      <Link to={`/dashboard/tutor/programs/enrollments/${e.publicId}`}><Button size="sm" variant="outline">View</Button></Link>
                      {e.status === 'ACTIVE' && e.sessionsScheduledCount < e.sessionCount && (
                        <Button size="sm" variant="outline" onClick={() => setOpen(open === e.publicId ? null : e.publicId)}>
                          <CalendarPlus className="h-3.5 w-3.5" /> Schedule next session
                        </Button>
                      )}
                    </div>
                  </div>
                  {open === e.publicId && (
                    <ProgramScheduleForm enrollmentPublicId={e.publicId} availabilityWindow={e.availabilityWindow} modules={program.modules} sessionMinutes={program.sessionMinutes} programTitle={program.title} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
