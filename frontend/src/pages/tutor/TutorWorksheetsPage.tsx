import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { FileText, Plus, Eye, EyeOff, Trash2, Share2, Globe } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import {
  useMyWorksheetsAsTutor,
  useCreateWorksheet,
  usePublishWorksheet,
  useUnpublishWorksheet,
  useDeleteWorksheet,
  useUpdateWorksheet,
} from '../../hooks/use-worksheets';
import type { Worksheet } from '../../services/worksheets.service';

const TABS = [
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PUBLISHED', label: 'Published' },
];

const createSchema = z.object({
  title: z.string().min(2, 'Title required').max(200),
  description: z.string().min(5, 'Description required').max(2000),
  content: z.string().max(50000).default(''),
  subject: z.string().optional(),
  fileUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});
type CreateForm = z.infer<typeof createSchema>;

export function TutorWorksheetsPage() {
  const [activeTab, setActiveTab] = useState('DRAFT');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewWorksheet, setViewWorksheet] = useState<Worksheet | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading } = useMyWorksheetsAsTutor({ limit: '50' });
  const { mutateAsync: createWorksheet, isPending: creating } = useCreateWorksheet();
  const { mutateAsync: updateWorksheet, isPending: updating } = useUpdateWorksheet();
  const { mutateAsync: publish } = usePublishWorksheet();
  const { mutateAsync: unpublish } = useUnpublishWorksheet();
  const { mutateAsync: deleteWorksheet } = useDeleteWorksheet();

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { content: '' },
  });

  const allItems = data?.items ?? [];
  const filtered = allItems.filter((w) => w.status === activeTab);

  const openCreate = () => {
    reset({ title: '', description: '', content: '', subject: '', fileUrl: '' });
    setEditingId(null);
    setCreateError(null);
    setShowCreate(true);
  };

  const openEdit = (w: Worksheet) => {
    reset({ title: w.title, description: w.description, content: w.content, subject: w.subject ?? '', fileUrl: w.fileUrl ?? '' });
    setEditingId(w.publicId);
    setCreateError(null);
    setShowCreate(true);
  };

  const onSubmit = async (data: CreateForm) => {
    setCreateError(null);
    const dto = { ...data, fileUrl: data.fileUrl || undefined };
    try {
      if (editingId) {
        await updateWorksheet({ id: editingId, dto });
      } else {
        await createWorksheet(dto);
      }
      setShowCreate(false);
      reset();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Failed to save');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Worksheets" subtitle="Create and share learning materials with students" />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> New Worksheet</Button>
      </div>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title={`No ${activeTab.toLowerCase()} worksheets`}
          description={activeTab === 'DRAFT' ? 'Create a new worksheet to get started.' : 'Publish a draft worksheet to share it with students.'}
          action={activeTab === 'DRAFT' ? <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1.5" /> New Worksheet</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => (
            <div key={w.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{w.title}</p>
                    {w.subject && <Badge variant="info">{w.subject}</Badge>}
                    <Badge variant={w.status === 'PUBLISHED' ? 'success' : 'default'}>{w.status}</Badge>
                    {w.sharedWithStudentPublicIds.length === 0 && w.status === 'PUBLISHED' && (
                      <Badge variant="warning"><Globe className="h-2.5 w-2.5 mr-1" />All Students</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{w.description}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>Created {format(new Date(w.createdAt), 'MMM d, yyyy')}</span>
                    {w.sharedWithStudentPublicIds.length > 0 && (
                      <span><Share2 className="h-3 w-3 inline mr-0.5" />{w.sharedWithStudentPublicIds.length} students</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setViewWorksheet(w)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(w)}>Edit</Button>
                  {w.status === 'DRAFT' ? (
                    <Button size="sm" onClick={() => publish(w.publicId)}>Publish</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => unpublish(w.publicId)}>
                      <EyeOff className="h-3.5 w-3.5 mr-1" />Unpublish
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteWorksheet(w.publicId)}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={editingId ? 'Edit Worksheet' : 'New Worksheet'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={creating || updating}>
              {editingId ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Title" placeholder="e.g. Algebra Basics" error={errors.title?.message} {...register('title')} />
            <Input label="Subject (optional)" placeholder="e.g. Mathematics" error={errors.subject?.message} {...register('subject')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Brief overview of this worksheet…"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Content</label>
            <textarea
              {...register('content')}
              rows={8}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="Paste or type the worksheet content here (questions, instructions, notes)…"
            />
            {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
          </div>
          <Input label="File URL (optional)" placeholder="https://..." error={errors.fileUrl?.message} {...register('fileUrl')} />
          {createError && <p className="text-xs text-red-500">{createError}</p>}
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        open={!!viewWorksheet}
        onClose={() => setViewWorksheet(null)}
        title={viewWorksheet?.title ?? ''}
        size="xl"
      >
        {viewWorksheet && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {viewWorksheet.subject && <Badge variant="info">{viewWorksheet.subject}</Badge>}
              <Badge variant={viewWorksheet.status === 'PUBLISHED' ? 'success' : 'default'}>{viewWorksheet.status}</Badge>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{viewWorksheet.description}</p>
            {viewWorksheet.content && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto">
                {viewWorksheet.content}
              </div>
            )}
            {viewWorksheet.fileUrl && (
              <a href={viewWorksheet.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:underline text-sm font-medium">
                <FileText className="h-4 w-4" /> Download / Open File
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
