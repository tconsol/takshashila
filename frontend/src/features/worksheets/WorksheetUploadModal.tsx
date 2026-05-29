import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, Users, Eye, EyeOff, File, Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useCreateWorksheet } from '../../hooks/use-worksheets';
import type { IQuestion, CreateWorksheetDto } from '../../services/worksheets.service';
import type { ClassRecord } from '../../services/classes.service';
import { api } from '../../lib/axios';

interface Props {
  open: boolean;
  onClose: () => void;
  cls: ClassRecord | null;
  type: 'WORKSHEET' | 'ASSIGNMENT';
  students: { publicId: string; name: string }[];
}

const TEMPLATE_HEADERS = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer (A/B/C/D)', 'Explanation'];
const SAMPLE_ROW = [
  'What is the capital of India?',
  'Mumbai',
  'New Delhi',
  'Chennai',
  'Kolkata',
  'B',
  'New Delhi is the capital and seat of government of India.',
];

const EXCEL_MIME_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function isExcelFile(file: File): boolean {
  return (
    EXCEL_MIME_TYPES.includes(file.type) ||
    file.name.endsWith('.xlsx') ||
    file.name.endsWith('.xls')
  );
}

function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const wsData = [TEMPLATE_HEADERS, SAMPLE_ROW];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'worksheet_template.xlsx');
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
          if (!row || row.every((cell) => !cell)) continue;
          const [q, optA, optB, optC, optD, correct, explanation] = row.map((c) => String(c ?? '').trim());
          if (!q) { errors.push(`Row ${i + 1}: Question is empty`); continue; }
          if (!optA || !optB || !optC || !optD) { errors.push(`Row ${i + 1}: All 4 options required`); continue; }
          const correctUpper = correct.toUpperCase();
          if (!['A', 'B', 'C', 'D'].includes(correctUpper)) {
            errors.push(`Row ${i + 1}: Correct answer must be A, B, C, or D`); continue;
          }
          const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[correctUpper] as 0 | 1 | 2 | 3;
          questions.push({ questionText: q, options: [optA, optB, optC, optD], correctIndex, explanation: explanation || '' });
        }

        if (errors.length > 0) {
          reject(new Error(errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n…and ${errors.length - 5} more errors` : '')));
          return;
        }
        if (questions.length === 0) { reject(new Error('No valid questions found. Check the file format.')); return; }
        resolve(questions);
      } catch {
        reject(new Error('Failed to read Excel file. Make sure it is a valid .xlsx/.xls file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

async function uploadFileToGCS(file: File): Promise<{ filePublicId: string; fileMimeType: string; fileOriginalName: string }> {
  // Step 1: Get signed upload URL
  const { data: urlData } = await api.post('/media/upload-url', {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    mediaType: 'WORKSHEET',
  });
  const { uploadUrl, gcsObjectKey } = urlData.data;

  // Step 2: Upload directly to GCS
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });

  // Step 3: Confirm upload
  const { data: confirmData } = await api.post('/media/confirm', {
    gcsObjectKey,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    mediaType: 'WORKSHEET',
  });

  return {
    filePublicId: confirmData.data.publicId,
    fileMimeType: file.type || 'application/octet-stream',
    fileOriginalName: file.name,
  };
}

export function WorksheetUploadModal({ open, onClose, cls, type, students }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMode, setFileMode] = useState<'excel' | 'attachment' | null>(null);
  const [questions, setQuestions] = useState<IQuestion[]>([]);
  const [uploadedFile, setUploadedFile] = useState<{ filePublicId: string; fileMimeType: string; fileOriginalName: string } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [allStudents, setAllStudents] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: createWorksheet, isPending: creating } = useCreateWorksheet();

  const handleClose = () => {
    setStep('upload');
    setTitle(''); setSubject(''); setDueDate('');
    setSelectedFile(null); setFileMode(null);
    setQuestions([]); setUploadedFile(null);
    setParseError(null); setSelectedStudents([]); setAllStudents(true); setSubmitError(null);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setParseError(null);
    setQuestions([]);
    setUploadedFile(null);

    if (isExcelFile(file)) {
      setFileMode('excel');
      setParsing(true);
      try {
        const qs = await parseExcel(file);
        setQuestions(qs);
      } catch (err) {
        setParseError(err instanceof Error ? err.message : 'Parse error');
        setFileMode(null);
      } finally {
        setParsing(false);
      }
    } else {
      setFileMode('attachment');
      setUploading(true);
      try {
        const result = await uploadFileToGCS(file);
        setUploadedFile(result);
      } catch (err) {
        const e = err as { response?: { data?: { message?: string } }; message?: string };
        setParseError(e.response?.data?.message ?? e.message ?? 'Upload failed');
        setFileMode(null);
        setSelectedFile(null);
      } finally {
        setUploading(false);
      }
    }
  };

  const canProceed = title.trim().length >= 2 && !parseError && !uploading &&
    (fileMode === 'excel' ? questions.length > 0 : fileMode === 'attachment' ? !!uploadedFile : false);

  const handleSubmit = async () => {
    if (!canProceed) return;
    setSubmitError(null);
    const dto: CreateWorksheetDto = {
      classPublicId: cls?.publicId,
      title: title.trim(),
      subject: subject.trim() || undefined,
      type,
      dueDate: type === 'ASSIGNMENT' && dueDate ? dueDate : undefined,
      assignedToStudentPublicIds: allStudents ? [] : selectedStudents,
      ...(fileMode === 'excel'
        ? { questions }
        : { isFileAttachment: true, ...uploadedFile }),
    };
    try {
      await createWorksheet(dto);
      handleClose();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setSubmitError(e.response?.data?.message ?? e.message ?? 'Failed to create');
    }
  };

  const toggleStudent = (publicId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId],
    );
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Upload ${type === 'ASSIGNMENT' ? 'Assignment' : 'Worksheet'}`}
      size="xl"
      footer={
        step === 'upload' ? (
          <>
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            {fileMode === 'excel' ? (
              <Button onClick={() => setStep('preview')} disabled={!canProceed}>
                Preview Questions ({questions.length})
              </Button>
            ) : (
              <Button onClick={() => setStep('confirm')} disabled={!canProceed}>
                Choose Students
              </Button>
            )}
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={() => setStep('confirm')}>Choose Students</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(fileMode === 'excel' ? 'preview' : 'upload')}>Back</Button>
            <Button
              onClick={handleSubmit}
              loading={creating}
              disabled={!allStudents && selectedStudents.length === 0}
            >
              Publish {type === 'ASSIGNMENT' ? 'Assignment' : 'Worksheet'}
            </Button>
          </>
        )
      }
    >
      {step === 'upload' && (
        <div className="space-y-5">
          {/* Format hint */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">File Types</p>
              <Button size="sm" variant="outline" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Excel Template
              </Button>
            </div>
            <div className="flex gap-4 text-xs text-blue-700 dark:text-blue-400">
              <span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> <strong>Excel (.xlsx/.xls)</strong> → Interactive quiz for students</span>
              <span className="flex items-center gap-1"><File className="h-3.5 w-3.5" /> <strong>PDF / DOC / IMG</strong> → Students download & view</span>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'ASSIGNMENT' ? 'e.g. Chapter 3 Assignment' : 'e.g. Algebra Quiz — Week 2'}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {type === 'ASSIGNMENT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          {/* File drop zone */}
          <div
            className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 cursor-pointer hover:border-brand-500 dark:hover:border-brand-400 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif"
              className="hidden"
              onChange={handleFileChange}
            />
            {parsing && (
              <><Spinner size="sm" /><p className="text-sm text-gray-500">Parsing Excel…</p></>
            )}
            {uploading && (
              <><Loader2 className="h-8 w-8 animate-spin text-brand-500" /><p className="text-sm text-gray-500">Uploading file…</p></>
            )}
            {!parsing && !uploading && fileMode === 'excel' && questions.length > 0 && (
              <>
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">{selectedFile?.name}</p>
                <Badge variant="success">{questions.length} questions parsed</Badge>
                <p className="text-xs text-gray-400">Click to change file</p>
              </>
            )}
            {!parsing && !uploading && fileMode === 'attachment' && uploadedFile && (
              <>
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-600 dark:text-green-400">{uploadedFile.fileOriginalName}</p>
                <Badge variant="info">File uploaded — students can download</Badge>
                <p className="text-xs text-gray-400">Click to change file</p>
              </>
            )}
            {!parsing && !uploading && !fileMode && (
              <>
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to upload file</p>
                <p className="text-xs text-gray-400">Excel → quiz • PDF / DOC / IMG → download</p>
              </>
            )}
          </div>

          {parseError && (
            <div className="flex gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
              <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{parseError}</pre>
            </div>
          )}
        </div>
      )}

      {step === 'preview' && fileMode === 'excel' && (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{questions.length} questions — review before publishing</p>
          {questions.map((q, idx) => (
            <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{idx + 1}. {q.questionText}</p>
                <button onClick={() => setPreviewExpanded(previewExpanded === idx ? null : idx)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  {previewExpanded === idx ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={`rounded-lg px-3 py-1.5 text-xs ${oi === q.correctIndex ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold border border-green-300 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {String.fromCharCode(65 + oi)}. {opt}{oi === q.correctIndex && ' ✓'}
                  </div>
                ))}
              </div>
              {previewExpanded === idx && q.explanation && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                  <span className="font-medium">Explanation: </span>{q.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 flex flex-wrap gap-4 text-sm">
            <div><span className="text-gray-400">Title:</span> <span className="font-semibold text-gray-900 dark:text-white">{title}</span></div>
            {fileMode === 'excel' ? (
              <div><span className="text-gray-400">Questions:</span> <span className="font-semibold text-gray-900 dark:text-white">{questions.length}</span></div>
            ) : (
              <div><span className="text-gray-400">File:</span> <span className="font-semibold text-gray-900 dark:text-white">{uploadedFile?.fileOriginalName}</span></div>
            )}
            {subject && <div><span className="text-gray-400">Subject:</span> <span className="font-semibold">{subject}</span></div>}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Users className="h-4 w-4" /> Assign to
            </p>
            <div className="flex gap-3">
              <button onClick={() => setAllStudents(true)} className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${allStudents ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400'}`}>
                All my students
              </button>
              <button onClick={() => setAllStudents(false)} className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${!allStudents ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400'}`}>
                Specific students
              </button>
            </div>
          </div>

          {!allStudents && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {students.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No students found</p>
              ) : students.map((s) => (
                <label key={s.publicId} className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input type="checkbox" checked={selectedStudents.includes(s.publicId)} onChange={() => toggleStudent(s.publicId)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-gray-900 dark:text-white">{s.name}</span>
                </label>
              ))}
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" /> {submitError}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
