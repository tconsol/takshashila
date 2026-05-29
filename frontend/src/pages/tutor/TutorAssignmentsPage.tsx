import { useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Upload, FileSpreadsheet, File, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import {
  useMyAssignments,
  useCreateAssignment,
  usePublishAssignment,
  useCloseAssignment,
  useSubmissions,
  useGradeSubmission,
} from '../../hooks/use-assignments';
import { useCreateWorksheet } from '../../hooks/use-worksheets';
import { useMyClassesAsTutor } from '../../hooks/use-classes';
import { api } from '../../lib/axios';
import type { Assignment, Submission } from '../../services/assignments.service';
import type { IQuestion } from '../../services/worksheets.service';

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

const EXCEL_EXTS = ['.xlsx', '.xls'];
function isExcelFile(file: File) {
  return EXCEL_EXTS.some((ext) => file.name.toLowerCase().endsWith(ext));
}

function parseExcel(file: File): Promise<IQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
        const questions: IQuestion[] = [];
        const errors: string[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.every((c) => !c)) continue;
          const [q, optA, optB, optC, optD, correct, explanation] = row.map((c) => String(c ?? '').trim());
          if (!q) { errors.push(`Row ${i + 1}: empty question`); continue; }
          if (!optA || !optB || !optC || !optD) { errors.push(`Row ${i + 1}: need 4 options`); continue; }
          const cu = correct?.toUpperCase();
          if (!['A', 'B', 'C', 'D'].includes(cu)) { errors.push(`Row ${i + 1}: correct must be A/B/C/D`); continue; }
          const correctIndex = ({ A: 0, B: 1, C: 2, D: 3 } as Record<string, 0 | 1 | 2 | 3>)[cu];
          questions.push({ questionText: q, options: [optA, optB, optC, optD], correctIndex, explanation: explanation || '' });
        }
        if (errors.length > 0) { reject(new Error(errors.slice(0, 5).join('\n'))); return; }
        if (questions.length === 0) { reject(new Error('No valid questions found')); return; }
        resolve(questions);
      } catch { reject(new Error('Invalid Excel file')); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function uploadFile(file: File): Promise<{ filePublicId: string; fileMimeType: string; fileOriginalName: string }> {
  const { data: urlData } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    mediaType: 'DOCUMENT',
  });
  const { uploadUrl, gcsObjectKey } = urlData.data;
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
  const { data: confirmData } = await api.post('/media/confirm', {
    gcsObjectKey,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    mediaType: 'DOCUMENT',
  });
  return { filePublicId: confirmData.data.publicId, fileMimeType: file.type || 'application/octet-stream', fileOriginalName: file.name };
}

type FileState =
  | { kind: 'none' }
  | { kind: 'parsing' | 'uploading' }
  | { kind: 'excel'; questions: IQuestion[]; name: string }
  | { kind: 'attachment'; filePublicId: string; fileMimeType: string; fileOriginalName: string }
  | { kind: 'error'; message: string };

export function TutorAssignmentsPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('PUBLISHED');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [fileState, setFileState] = useState<FileState>({ kind: 'none' });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assignments = [], isLoading } = useMyAssignments();
  const { data: classData } = useMyClassesAsTutor({ limit: '100' });
  const { mutateAsync: createAssignment, isPending: creating } = useCreateAssignment();
  const { mutateAsync: createWorksheet, isPending: creatingWs } = useCreateWorksheet();
  const { mutateAsync: publishAssignment } = usePublishAssignment();
  const { mutateAsync: closeAssignment } = useCloseAssignment();
  const { data: submissions = [], isLoading: loadingSubmissions } = useSubmissions(selectedAssignment?.publicId ?? '');
  const { mutateAsync: gradeSubmission, isPending: grading } = useGradeSubmission();

  const { register, control, handleSubmit, formState: { errors }, reset, getValues } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { maxScore: 100 },
  });

  const filtered = assignments.filter((a) => a.status === activeTab);
  const classes = classData?.items ?? [];
  const isBusy = creating || creatingWs;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (isExcelFile(file)) {
      setFileState({ kind: 'parsing' });
      try {
        const questions = await parseExcel(file);
        setFileState({ kind: 'excel', questions, name: file.name });
      } catch (err) {
        setFileState({ kind: 'error', message: err instanceof Error ? err.message : 'Parse failed' });
      }
    } else {
      setFileState({ kind: 'uploading' });
      try {
        const result = await uploadFile(file);
        setFileState({ kind: 'attachment', ...result });
      } catch (err) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setFileState({ kind: 'error', message: e.response?.data?.message ?? e.message ?? 'Upload failed' });
      }
    }
  };

  const clearFile = () => setFileState({ kind: 'none' });

  const onSubmit = async (data: CreateForm) => {
    setCreateError(null);
    try {
      if (fileState.kind === 'excel') {
        // Excel → create as worksheet of type ASSIGNMENT (quiz)
        await createWorksheet({
          classPublicId: data.classPublicId,
          title: data.title,
          subject: undefined,
          type: 'ASSIGNMENT',
          dueDate: data.dueDate,
          questions: fileState.questions,
          assignedToStudentPublicIds: [],
        });
        toast.success('Quiz assignment created in Worksheets');
      } else if (fileState.kind === 'attachment') {
        await createAssignment({
          ...data,
          isFileAttachment: true,
          filePublicId: fileState.filePublicId,
          fileMimeType: fileState.fileMimeType,
          fileOriginalName: fileState.fileOriginalName,
        });
      } else {
        await createAssignment(data);
      }
      reset();
      setFileState({ kind: 'none' });
      setShowCreate(false);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setCreateError(e.response?.data?.message ?? e.message ?? 'Failed to create assignment');
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
                    {assignment.isFileAttachment && (
                      <Badge variant="info">File: {assignment.fileOriginalName}</Badge>
                    )}
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
        onClose={() => { setShowCreate(false); reset(); setFileState({ kind: 'none' }); setCreateError(null); }}
        title="New Assignment"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowCreate(false); reset(); setFileState({ kind: 'none' }); }}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={isBusy}>
              {fileState.kind === 'excel' ? 'Create Quiz Assignment' : 'Create Assignment'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="classPublicId"
            control={control}
            render={({ field }) => (
              <Select
                label="Class"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                options={[
                  { value: '', label: 'Select a class…' },
                  ...classes.map((c) => ({
                    value: c.publicId,
                    label: `${c.subject || 'Class'} — ${c.scheduledStartUTC ? format(new Date(c.scheduledStartUTC), 'MMM d, yyyy') : ''}`.trim(),
                  })),
                ]}
                error={errors.classPublicId?.message}
              />
            )}
          />

          <Input label="Title" error={errors.title?.message} {...register('title')} />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the assignment…"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Due Date" type="datetime-local" error={errors.dueDate?.message} {...register('dueDate')} />
            <Input label="Max Score" type="number" error={errors.maxScore?.message} {...register('maxScore')} />
          </div>

          {/* File upload section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Attachment <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>

            <div className="rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/20 p-3 mb-3 text-xs text-sky-700 dark:text-sky-400 flex gap-3">
              <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /><strong>Excel</strong> → quiz created in Worksheets</span>
              <span className="flex items-center gap-1"><File className="h-3.5 w-3.5" /><strong>PDF / DOC / IMG</strong> → students download</span>
            </div>

            {fileState.kind === 'none' || fileState.kind === 'error' ? (
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-5 cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="h-6 w-6 text-gray-400" />
                <p className="text-sm text-gray-500">Click to upload file</p>
                {fileState.kind === 'error' && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{fileState.message}
                  </p>
                )}
              </div>
            ) : fileState.kind === 'parsing' ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 p-4">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                <span className="text-sm text-gray-500">Parsing Excel…</span>
              </div>
            ) : fileState.kind === 'uploading' ? (
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-800 p-4">
                <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                <span className="text-sm text-gray-500">Uploading file…</span>
              </div>
            ) : fileState.kind === 'excel' ? (
              <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">{fileState.name}</span>
                  <Badge variant="success">{fileState.questions.length} questions</Badge>
                </div>
                <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : fileState.kind === 'attachment' ? (
              <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/20 p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-sky-500" />
                  <span className="text-sm font-medium text-sky-700 dark:text-sky-400">{fileState.fileOriginalName}</span>
                  <Badge variant="info">Downloadable</Badge>
                </div>
                <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>

          {createError && (
            <div className="flex gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>
            </div>
          )}
        </form>
      </Modal>

      {/* Submissions Modal */}
      <Modal
        open={!!selectedAssignment && !gradingSubmission}
        onClose={() => setSelectedAssignment(null)}
        title={selectedAssignment ? `Submissions — ${selectedAssignment.title}` : ''}
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
