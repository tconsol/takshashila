import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { FileText, Upload, Trash2, Edit2, Download, FolderOpen, AlertCircle, X } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useMyResourcesAsTutor, useCreateResource, useUpdateResource, useDeleteResource } from '../../hooks/use-resources';
import { resourcesService } from '../../services/resources.service';
import type { Resource } from '../../services/resources.service';
import { api } from '../../lib/axios';

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/jpeg', 'image/png', 'image/webp',
]);

function mimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/vnd.ms-powerpoint': 'PPT',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPT',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'text/plain': 'Text',
    'image/jpeg': 'Image', 'image/png': 'Image', 'image/webp': 'Image',
  };
  return map[mimeType] ?? 'File';
}

async function uploadFile(file: File, onProgress: (pct: number) => void): Promise<{ mediaPublicId: string; fileName: string; mimeType: string; sizeBytes: number }> {
  const { data: urlRes } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    mediaType: 'RESOURCE',
  });
  const { uploadUrl, gcsObjectKey } = urlRes.data as { uploadUrl: string; gcsObjectKey: string };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });

  const { data: confirmRes } = await api.post('/media/confirm', { gcsObjectKey });
  return {
    mediaPublicId: (confirmRes.data as { publicId: string }).publicId,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function TutorResourcesPage() {
  const [showUpload, setShowUpload] = useState(false);
  const [editTarget, setEditTarget] = useState<Resource | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useMyResourcesAsTutor({ limit: '100' });
  const { mutateAsync: createResource, isPending: creating } = useCreateResource();
  const { mutateAsync: updateResource, isPending: updating } = useUpdateResource();
  const { mutateAsync: deleteResource } = useDeleteResource();

  const items = data?.items ?? [];

  const openUpload = () => {
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    setFileError(null);
    setSubmitError(null);
    setShowUpload(true);
    setEditTarget(null);
  };

  const openEdit = (r: Resource) => {
    setEditTarget(r);
    setTitle(r.title);
    setDescription(r.description ?? '');
    setShowUpload(true);
    setSubmitError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_MIME.has(file.type)) { setFileError('File type not supported.'); return; }
    if (file.size > MAX_BYTES) { setFileError(`File too large (max 50 MB).`); return; }
    setFileError(null);
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setSubmitError('Title is required'); return; }
    setSubmitError(null);
    try {
      if (editTarget) {
        await updateResource({ id: editTarget.publicId, dto: { title: title.trim(), description: description.trim() || undefined } });
      } else {
        if (!selectedFile) { setSubmitError('Please select a file'); return; }
        setUploading(true);
        const uploaded = await uploadFile(selectedFile, setUploadPct);
        setUploading(false);
        await createResource({ title: title.trim(), description: description.trim() || undefined, ...uploaded });
      }
      setShowUpload(false);
    } catch (err) {
      setUploading(false);
      setSubmitError(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDownload = async (r: Resource) => {
    try {
      const url = await resourcesService.getReadUrl(r.publicId);
      window.open(url, '_blank');
    } catch { /* silent */ }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Resources" subtitle="Upload study materials for your students" />
        <Button onClick={openUpload}>
          <Upload className="h-4 w-4 mr-1.5" /> Upload Resource
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No resources yet"
          description="Upload PDFs, Word docs, presentations, and other study materials for your students."
          action={<Button onClick={openUpload}><Upload className="h-4 w-4 mr-1.5" /> Upload First Resource</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((r) => (
            <div key={r.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-bold">
                  {mimeLabel(r.mimeType)}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(r)} className="text-gray-400 hover:text-brand-500 transition-colors p-1">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteResource(r.publicId)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-900 dark:text-white leading-snug">{r.title}</p>
                {r.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{r.description}</p>}
                <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                  <span>{r.fileName}</span>
                  <span>{(r.sizeBytes / 1024).toFixed(0)} KB</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{format(new Date(r.createdAt), 'MMM d, yyyy')}</p>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700 mt-auto">
                <button
                  onClick={() => handleDownload(r)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Open / Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload / Edit modal */}
      <Modal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        title={editTarget ? 'Edit Resource' : 'Upload Resource'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={uploading || creating || updating}>
              {editTarget ? 'Save Changes' : 'Upload'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chapter 4 Notes"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this resource…"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {!editTarget && (
            <>
              <div
                className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 cursor-pointer hover:border-brand-400 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleFileChange} />
                {uploading ? (
                  <>
                    <Spinner size="sm" />
                    <p className="text-sm text-gray-500">Uploading… {uploadPct}%</p>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                      <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
                    </div>
                  </>
                ) : selectedFile ? (
                  <>
                    <FileText className="h-7 w-7 text-brand-500" />
                    <p className="text-sm font-medium text-brand-600 dark:text-brand-400">{selectedFile.name}</p>
                    <p className="text-xs text-gray-400">Click to change</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-gray-400" />
                    <p className="text-sm text-gray-500">Click to select file</p>
                    <p className="text-xs text-gray-400">PDF, Word, PPT, Excel, images — max 50 MB</p>
                  </>
                )}
              </div>
              {fileError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {fileError}
                </p>
              )}
            </>
          )}

          {submitError && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> {submitError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
