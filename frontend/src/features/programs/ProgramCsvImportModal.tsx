// frontend/src/features/programs/ProgramCsvImportModal.tsx
import { useRef, useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useCreateProgram } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';
import { isCsvFile, downloadProgramCsvTemplate, parseProgramCsv } from '../../lib/csv-program';
import type { ProgramInput } from '../../services/programs.service';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function ProgramCsvImportModal({ open, onClose, onDone }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ProgramInput | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: create, isPending: creating } = useCreateProgram();

  const handleClose = () => {
    setSelectedFile(null); setParsed(null); setParseError(null); setSubmitError(null);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setParsed(null);
    setParseError(null);
    if (!isCsvFile(file)) {
      setParseError('Please choose a .csv file — use the template below if you need one.');
      return;
    }
    setParsing(true);
    try {
      setParsed(await parseProgramCsv(file));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not parse that file');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async () => {
    if (!parsed) return;
    setSubmitError(null);
    try {
      await create(parsed);
      onDone();
      handleClose();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setSubmitError(e.response?.data?.message ?? e.message ?? 'Failed to create program');
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Program from CSV"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={creating} disabled={!parsed}>
            Create Program
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Fill one row per module. Program details (title, category, price…) only need to be
              on the first row.
            </p>
            <Button size="sm" variant="outline" onClick={downloadProgramCsvTemplate}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download template
            </Button>
          </div>
        </div>

        <div
          className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-8 cursor-pointer hover:border-brand-500 dark:hover:border-brand-400 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
          {parsing && <p className="text-sm text-gray-500">Reading file…</p>}
          {!parsing && parsed && (
            <>
              <CheckCircle className="h-8 w-8 text-green-500" />
              <p className="text-sm font-medium text-green-600 dark:text-green-400">{selectedFile?.name}</p>
              <Badge variant="success">{parsed.modules.length} module{parsed.modules.length !== 1 ? 's' : ''} parsed</Badge>
              <p className="text-xs text-gray-400">Click to change file</p>
            </>
          )}
          {!parsing && !parsed && (
            <>
              <Upload className="h-8 w-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Click to upload your filled-in CSV</p>
              <p className="text-xs text-gray-400 flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> .csv only</p>
            </>
          )}
        </div>

        {parseError && (
          <div className="flex gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{parseError}</pre>
          </div>
        )}

        {parsed && (
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{parsed.title}</p>
            <p className="text-xs text-gray-500">
              {categoryLabel(parsed.category)} · {levelLabel(parsed.level)} · {parsed.sessionCount} sessions × {parsed.sessionMinutes}min · {formatCurrency(parsed.priceCents)}
              {parsed.maxEnrollees ? ` · max ${parsed.maxEnrollees} students` : ''}
            </p>
            {parsed.description && <p className="text-xs text-gray-500">{parsed.description}</p>}
            <ol className="mt-2 space-y-1 list-decimal list-inside">
              {parsed.modules.map((m, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                  {m.title}
                  {m.description && <span className="text-gray-400"> — {m.description}</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        {submitError && (
          <p className="text-sm text-red-500 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> {submitError}
          </p>
        )}
      </div>
    </Modal>
  );
}
