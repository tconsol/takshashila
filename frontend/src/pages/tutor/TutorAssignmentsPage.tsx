import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import {
  useMyAssignments,
  useCreateAssignment,
  usePublishAssignment,
  useCloseAssignment,
  useSubmissions,
  useGradeSubmission,
} from '../../hooks/use-assignments';
import { useMyClassesAsTutor } from '../../hooks/use-classes';
import type { Assignment, Submission } from '../../services/assignments.service';

type StatusVariant = 'default' | 'info' | 'success' | 'warning';

const statusVariant: Record<string, StatusVariant> = {
  DRAFT: 'default',
  PUBLISHED: 'info',
  CLOSED: 'success',
};

const submissionVariant: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  NOT_SUBMITTED: 'default',
  SUBMITTED: 'warning',
  GRADED: 'success',
  LATE: 'danger',
};

const createSchema = z.object({
  classPublicId: z.string().min(1, 'Select a class'),
  title: z.string().min(3, 'Title required').max(200),
  description: z.string().min(10, 'Description required').max(5000),
  dueDate: z.string().min(1, 'Due date required'),
  maxScore: z.coerce.number().min(1).max(1000).default(100),
});
type CreateForm = z.infer<typeof createSchema>;

const TABS = [
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'CLOSED', label: 'Closed' },
];

export function TutorAssignmentsPage() {
  const [activeTab, setActiveTab] = useState('PUBLISHED');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: assignments = [], isLoading } = useMyAssignments();
  const { data: classData } = useMyClassesAsTutor({ limit: '100' });
  const { mutateAsync: createAssignment, isPending: creating } = useCreateAssignment();
  const { mutateAsync: publishAssignment } = usePublishAssignment();
  const { mutateAsync: closeAssignment } = useCloseAssignment();
  const { data: submissions = [], isLoading: loadingSubmissions } = useSubmissions(selectedAssignment?.publicId ?? '');
  const { mutateAsync: gradeSubmission, isPending: grading } = useGradeSubmission();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { maxScore: 100 },
  });

  const filtered = assignments.filter((a) => a.status === activeTab);
  const classes = classData?.items ?? [];

  const onSubmit = async (data: CreateForm) => {
    setCreateError(null);
    try {
      await createAssignment(data);
      reset();
      setShowCreate(false);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create');
    }
  };

  const handleGrade = async () => {
    if (!gradingSubmission || !selectedAssignment) return;
    await gradeSubmission({
      submissionId: gradingSubmission.publicId,
      assignmentId: selectedAssignment.publicId,
      dto: { score: Number(gradeScore), feedback: gradeFeedback },
    });
    setGradingSubmission(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Assignments" subtitle="Create and manage student assignments" />
        <Button onClick={() => setShowCreate(true)}>+ New Assignment</Button>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          No {activeTab.toLowerCase()} assignments
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((assignment) => (
            <div key={assignment.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{assignment.title}</p>
                    <Badge variant={statusVariant[assignment.status] ?? 'default'}>{assignment.status}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{assignment.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>Due: {format(new Date(assignment.dueDate), 'MMM d, yyyy')}</span>
                    <span>Max score: {assignment.maxScore}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {assignment.status === 'DRAFT' && (
                    <Button size="sm" onClick={() => publishAssignment(assignment.publicId)}>Publish</Button>
                  )}
                  {assignment.status === 'PUBLISHED' && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setSelectedAssignment(assignment)}>
                        Submissions
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => closeAssignment(assignment.publicId)}>
                        Close
                      </Button>
                    </>
                  )}
                  {assignment.status === 'CLOSED' && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedAssignment(assignment)}>
                      View Results
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Assignment Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Assignment"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={creating}>Create</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Class</label>
            <select
              {...register('classPublicId')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.publicId} value={c.publicId}>
                  {c.subject} {format(new Date(c.scheduledStartUTC), 'MMM d, yyyy')}
                </option>
              ))}
            </select>
            {errors.classPublicId && <p className="text-xs text-red-500 mt-1">{errors.classPublicId.message}</p>}
          </div>
          <Input label="Title" error={errors.title?.message} {...register('title')} />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the assignment…"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Due Date" type="datetime-local" error={errors.dueDate?.message} {...register('dueDate')} />
            <Input label="Max Score" type="number" error={errors.maxScore?.message} {...register('maxScore')} />
          </div>
          {createError && <p className="text-xs text-red-500">{createError}</p>}
        </form>
      </Modal>

      {/* Submissions Modal */}
      <Modal
        open={!!selectedAssignment && !gradingSubmission}
        onClose={() => setSelectedAssignment(null)}
        title={selectedAssignment ? `Submissions ${selectedAssignment.title}` : ''}
        size="xl"
      >
        <Table
          columns={[
            {
              key: 'studentPublicId',
              header: 'Student',
              render: (s) => <span className="font-mono text-xs">{s.studentPublicId.slice(0, 8)}…</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (s) => <Badge variant={submissionVariant[s.status] ?? 'default'}>{s.status}</Badge>,
            },
            {
              key: 'submittedAt',
              header: 'Submitted',
              render: (s) => s.submittedAt ? format(new Date(s.submittedAt), 'MMM d, h:mm a') : '—',
            },
            {
              key: 'score',
              header: 'Score',
              render: (s) => s.score !== undefined ? `${s.score}/${selectedAssignment?.maxScore}` : '—',
            },
            {
              key: 'actions',
              header: '',
              render: (s) => (
                s.status === 'SUBMITTED' || s.status === 'LATE' ? (
                  <button
                    onClick={() => { setGradingSubmission(s); setGradeScore(''); setGradeFeedback(''); }}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Grade
                  </button>
                ) : null
              ),
            },
          ]}
          data={submissions}
          keyField="publicId"
          loading={loadingSubmissions}
          emptyMessage="No submissions yet"
        />
      </Modal>

      {/* Grade Modal */}
      <Modal
        open={!!gradingSubmission}
        onClose={() => setGradingSubmission(null)}
        title="Grade Submission"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGradingSubmission(null)}>Cancel</Button>
            <Button onClick={handleGrade} loading={grading} disabled={!gradeScore}>Save Grade</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label={`Score (max ${selectedAssignment?.maxScore})`}
            type="number"
            min={0}
            max={selectedAssignment?.maxScore}
            value={gradeScore}
            onChange={(e) => setGradeScore(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Feedback</label>
            <textarea
              value={gradeFeedback}
              onChange={(e) => setGradeFeedback(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Optional feedback…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
