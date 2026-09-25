// frontend/src/pages/tutor/TutorCoursePage.tsx
//
// A tutor's view of one course they teach (no progress status). Curriculum (admin)
// assignments and worksheets get a Submissions panel for this course's student.
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CourseStructureView } from '../../features/courses/CourseStructureView';
import { useQueryClient } from '@tanstack/react-query';
import { useMaterialSubmissions, courseKeys } from '../../hooks/use-courses';
import { useGradeSubmission } from '../../hooks/use-assignments';
import type { StructureMaterial } from '../../services/courses.service';

function SubmissionsModal({ coursePublicId, material, onClose }: { coursePublicId: string; material: StructureMaterial; onClose: () => void }) {
  const kind = material.kind as 'assignment' | 'worksheet';
  const { data: subs = [], isLoading } = useMaterialSubmissions(coursePublicId, kind, material.publicId, true);
  const { mutateAsync: grade } = useGradeSubmission();
  const qc = useQueryClient();
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});

  return (
    <Modal open onClose={onClose} title={`Submissions — ${material.title}`}>
      {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : subs.length === 0 ? (
        <p className="text-sm text-gray-500">No submission yet.</p>
      ) : (
        <ul className="space-y-3">
          {subs.map((s) => (
            <li key={s.publicId} className="rounded-lg border border-rule p-3 text-sm">
              <div className="mb-1 flex items-center gap-2">
                {s.status && <Badge tone="soft" variant={s.status === 'GRADED' ? 'success' : 'warning'}>{s.status}</Badge>}
                {s.score !== undefined && <span>Score: {s.score}</span>}
              </div>
              {s.content && <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{s.content}</p>}
              {kind === 'assignment' && s.status !== 'GRADED' && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="number" min={0} value={scores[s.publicId] ?? ''} onChange={(e) => setScores({ ...scores, [s.publicId]: e.target.value })}
                    className="w-20 rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1 text-sm bg-white dark:bg-gray-900" />
                  <Button size="sm" loading={gradingId === s.publicId} disabled={!scores[s.publicId] || (gradingId !== null && gradingId !== s.publicId)}
                    onClick={async () => {
                      setGradingId(s.publicId);
                      try {
                        await grade({ submissionId: s.publicId, assignmentId: material.publicId, dto: { score: Number(scores[s.publicId]) } });
                        // Refresh this panel's list (the hook only refreshes the assignment's own list).
                        await qc.invalidateQueries({ queryKey: [...courseKeys.all, 'material-submissions', coursePublicId, kind, material.publicId] });
                      } finally {
                        setGradingId(null);
                      }
                    }}>
                    Grade
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export function TutorCoursePage() {
  const { coursePublicId = '' } = useParams<{ coursePublicId: string }>();
  const [open, setOpen] = useState<StructureMaterial | null>(null);
  return (
    <>
      <CourseStructureView
        coursePublicId={coursePublicId}
        backTo="/dashboard/tutor/course-requests"
        backLabel="Course requests"
        renderMaterialExtra={(m) => m.authorRole === 'ADMIN' && m.kind !== 'resource' && (
          <Button size="sm" variant="outline" className="ml-auto" onClick={(e) => { e.stopPropagation(); setOpen(m); }}>
            Submissions
          </Button>
        )}
      />
      {open && <SubmissionsModal coursePublicId={coursePublicId} material={open} onClose={() => setOpen(null)} />}
    </>
  );
}
