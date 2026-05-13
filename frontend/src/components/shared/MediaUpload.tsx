import { useRef, useState } from 'react';
import { mediaService } from '../../services/media.service';
import type { MediaFile } from '../../services/media.service';

interface MediaUploadProps {
  mediaType: string;
  entityPublicId?: string;
  entityType?: string;
  accept?: string;
  label?: string;
  onUploaded?: (file: MediaFile) => void;
}

const BYTES_MB = 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < BYTES_MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / BYTES_MB).toFixed(1)} MB`;
}

export function MediaUpload({ mediaType, entityPublicId, entityType, accept, label = 'Upload file', onUploaded }: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<MediaFile | null>(null);

  const handleFile = async (file: File) => {
    setProgress('uploading');
    setErrorMsg(null);
    try {
      const result = await mediaService.uploadFile(file, mediaType, entityPublicId, entityType);
      setUploadedFile(result);
      setProgress('done');
      onUploaded?.(result);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Upload failed');
      setProgress('error');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="w-full">
      {progress === 'done' && uploadedFile ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{uploadedFile.originalName}</p>
            <p className="text-xs text-green-600 dark:text-green-400">{formatBytes(uploadedFile.sizeBytes)}</p>
          </div>
          <button
            onClick={() => { setProgress('idle'); setUploadedFile(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="text-xs text-green-600 dark:text-green-400 hover:underline"
          >
            Replace
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => progress !== 'uploading' && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
            progress === 'uploading'
              ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/10 cursor-wait'
              : progress === 'error'
              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50 dark:bg-gray-800/50'
          }`}
        >
          {progress === 'uploading' ? (
            <>
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-indigo-600 dark:text-indigo-400">Uploading…</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium text-indigo-600 dark:text-indigo-400">{label}</span> or drag & drop
              </p>
              {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
            </>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={handleChange} />
    </div>
  );
}
