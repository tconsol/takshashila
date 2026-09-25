// frontend/src/features/courses/AdminMaterialForms.tsx
import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAddCurriculumMaterial } from '../../hooks/use-curricula';
import { uploadResourceFile, uploadDocument } from '../../lib/media-upload';
import { isExcelFile, parseExcelQuestions } from '../../lib/excel-questions';
import type { MaterialKind } from '../../services/curricula.service';

const TITLES: Record<MaterialKind, string> = { resource: 'Add resource', assignment: 'Add assignment', worksheet: 'Add worksheet' };

export function AddMaterialModal({ curriculumPublicId, topics, initialTopicId, kind, onClose }: {
  curriculumPublicId: string;
  topics: { publicId: string; title: string }[];
  initialTopicId: string;
  kind: MaterialKind;
  onClose: () => void;
}) {
  const { mutate: add, isPending } = useAddCurriculumMaterial();
  const [topicIds, setTopicIds] = useState<string[]>([initialTopicId]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsFile = kind !== 'assignment';
  const ready = !!title.trim() && topicIds.length > 0 && (!needsFile || !!file) && (kind !== 'assignment' || !!description.trim());

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { title: title.trim(), topicPublicIds: topicIds };
      if (kind === 'resource' && file) {
        Object.assign(body, { description: description.trim() || undefined, ...(await uploadResourceFile(file, () => undefined)) });
      } else if (kind === 'assignment') {
        Object.assign(body, { description: description.trim(), maxScore, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined });
        if (file) Object.assign(body, { isFileAttachment: true, ...(await uploadDocument(file)) });
      } else if (kind === 'worksheet' && file) {
        if (isExcelFile(file)) Object.assign(body, { type: 'WORKSHEET', questions: await parseExcelQuestions(file) });
        else Object.assign(body, { type: 'WORKSHEET', isFileAttachment: true, ...(await uploadDocument(file)) });
      }
      add({ curriculumPublicId, kind, body }, { onSuccess: onClose });
    } catch (err) {
      setError((err as Error).message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => setTopicIds((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <Modal
      open
      onClose={onClose}
      title={TITLES[kind]}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" loading={busy || isPending} disabled={!ready} onClick={save}>Save</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {kind !== 'worksheet' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description{kind === 'resource' ? ' (optional)' : ''}
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          </div>
        )}
        {kind === 'assignment' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Due date (optional)" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Input label="Max score" type="number" value={String(maxScore)} onChange={(e) => setMaxScore(Number(e.target.value) || 100)} />
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {kind === 'worksheet' ? 'Excel questions or a file' : kind === 'assignment' ? 'Attachment (optional)' : 'File'}
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-brand-400">
            <Upload className="h-4 w-4" /> {file ? file.name : 'Choose file'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              accept={kind === 'worksheet' ? '.xlsx,.xls,.pdf,.doc,.docx' : undefined} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {topics.map((t) => (
              <button key={t.publicId} type="button" aria-pressed={topicIds.includes(t.publicId)} onClick={() => toggle(t.publicId)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${topicIds.includes(t.publicId) ? 'bg-accent text-accent-ink' : 'bg-surface-sunk text-ink-muted hover:text-ink'}`}>
                {t.title}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
