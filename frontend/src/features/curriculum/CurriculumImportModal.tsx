// frontend/src/features/curriculum/CurriculumImportModal.tsx
//
// Admin: import a state's curricula from a Word file. Two steps: Preview reads the file and shows
// what would change without saving anything; Import then saves it. Imports create DRAFTS only,
// published curricula are never touched, and re-importing rewrites drafts from the file.
import { useRef, useState } from 'react';
import { AlertTriangle, FileText, Upload } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useImportCurriculumDocx } from '../../hooks/use-curricula';
import { useUsStates } from '../../hooks/use-geo';
import type { ImportReport } from '../../services/curricula.service';

const KINDS = [
  { value: 'revised', label: 'Revised curriculum' },
  { value: 'master', label: 'Master syllabus (with county additions)' },
];

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-rule px-3 py-2">
      <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Warnings({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-900 dark:bg-amber-900/20">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" /> {title} ({items.length})
      </summary>
      <ul className="mt-1.5 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-amber-900 dark:text-amber-200">
        {items.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </details>
  );
}

export function CurriculumImportModal({ defaultState, onClose }: { defaultState?: string; onClose: () => void }) {
  const { data: states = [] } = useUsStates();
  const { mutate, isPending } = useImportCurriculumDocx();
  const fileInput = useRef<HTMLInputElement>(null);

  const [stateCode, setStateCode] = useState(defaultState ?? '');
  const [kind, setKind] = useState<'revised' | 'master'>('revised');
  const [countyOnly, setCountyOnly] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [done, setDone] = useState(false);

  const stateName = states.find((s) => s.code === stateCode)?.name ?? stateCode;
  const ready = !!stateCode && !!file;
  // Any change to the inputs makes an earlier preview stale.
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setReport(null); setDone(false); };

  const run = (commit: boolean) => {
    if (!file) return;
    mutate(
      { file, stateCode, kind, countyOnly, commit },
      { onSuccess: (res) => { setReport(res.report); setDone(res.committed); } },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Import curricula from Word"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>{done ? 'Close' : 'Cancel'}</Button>
          {!done && (
            <Button variant={report ? 'outline' : 'gradient'} loading={isPending && !report} disabled={!ready || isPending} onClick={() => run(false)}>
              {report ? 'Preview again' : 'Preview'}
            </Button>
          )}
          {report && !done && (
            <Button variant="gradient" loading={isPending} onClick={() => run(true)}>
              <Upload className="h-3.5 w-3.5" /> Import as drafts
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="State"
            placeholder="Select state"
            options={states.map((s) => ({ value: s.code, label: s.name }))}
            value={stateCode}
            onChange={(e) => edit(setStateCode)(e.target.value)}
          />
          <Select label="File type" options={KINDS} value={kind} onChange={(e) => edit(setKind)(e.target.value as 'revised' | 'master')} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={countyOnly} onChange={(e) => edit(setCountyOnly)(e.target.checked)} />
          Only import county additions from this file
        </label>

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-rule px-4 py-6 text-center transition-colors hover:border-brand-300 hover:bg-surface-hover"
        >
          <FileText className="h-6 w-6 text-gray-400" />
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{file ? file.name : 'Choose a .docx file'}</span>
          <span className="text-xs text-gray-500">
            {file ? `${(file.size / 1024).toFixed(0)} KB · click to replace` : 'Grades as Heading 1, subjects as Heading 2, chapters as Heading 3, topics as plain lines'}
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { edit(setFile)(e.target.files?.[0] ?? null); e.target.value = ''; }}
        />

        {report && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {done ? `Imported for ${stateName}` : `Preview for ${stateName}: nothing is saved yet`}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={done ? 'Created' : 'Will create'} value={report.created} />
              <Stat label={done ? 'Updated' : 'Will update'} value={report.updated} />
              <Stat label="Unchanged" value={report.unchanged} />
              <Stat label="Published, skipped" value={report.skippedPublished} />
              <Stat label="Chapters" value={report.chapters} />
              <Stat label="Topics" value={report.topics} />
              {report.countyAdditions > 0 && <Stat label="County additions" value={report.countyAdditions} />}
            </div>
            <Warnings title="Subjects skipped (marked not verified)" items={report.subjectsSkippedNotVerified} />
            <Warnings title="Subjects with no chapters" items={report.emptySubjects} />
            <Warnings title="Chapters with no topics" items={report.emptyChapters} />
            <Warnings title="Subjects listed twice in one grade" items={report.duplicateSubjects} />
            <Warnings title="No source citation" items={report.missingCitation} />
            {done && <p className="text-xs text-gray-500">Imported curricula are drafts. Publish each one from the list when it is ready.</p>}
          </div>
        )}

        {!done && (
          <p className="flex items-start gap-1.5 text-xs text-gray-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            Importing rewrites this state's draft curricula from the file, so edits made to drafts by hand are replaced.
            Published curricula are never changed.
          </p>
        )}
      </div>
    </Modal>
  );
}
