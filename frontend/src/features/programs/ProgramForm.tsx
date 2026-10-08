// frontend/src/features/programs/ProgramForm.tsx
import { useRef, useState } from 'react';
import { Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PROGRAM_CATEGORIES, PROGRAM_LEVELS } from '../../constants/programs';
import { useCreateProgram, useUpdateProgram } from '../../hooks/use-programs';
import type { Program, ProgramInput } from '../../services/programs.service';
import { formatCurrency } from '../../utils/currency';
import { isCsvFile, parseChaptersCsv, downloadChaptersCsvTemplate } from '../../lib/csv-program';

/** Must match PLATFORM_FEE_CENTS on the server (server/src/utils/currency.ts). */
const PLATFORM_FEE_CENTS = 100;

type TopicDraft = { publicId?: string; title: string };
type ModuleDraft = { publicId?: string; title: string; description?: string; topics: TopicDraft[] };
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** Create or edit a program. Price/sessions are locked server-side once students enrol. */
export function ProgramForm({ program, onDone, onCancel }: { program?: Program; onDone: () => void; onCancel?: () => void }) {
  const { mutate: create, isPending: creating } = useCreateProgram();
  const { mutate: update, isPending: updating } = useUpdateProgram();
  const [title, setTitle] = useState(program?.title ?? '');
  const [category, setCategory] = useState(program?.category ?? 'GAMES');
  const [level, setLevel] = useState(program?.level ?? 'BEGINNER');
  const [description, setDescription] = useState(program?.description ?? '');
  const [sessionCount, setSessionCount] = useState(String(program?.sessionCount ?? 8));
  const [sessionMinutes, setSessionMinutes] = useState(String(program?.sessionMinutes ?? 60));
  const [price, setPrice] = useState(program ? (program.priceCents / 100).toFixed(2) : '');
  const [maxEnrollees, setMaxEnrollees] = useState(program?.maxEnrollees?.toString() ?? '');
  const [modules, setModules] = useState<ModuleDraft[]>(program
    ? [...program.modules].sort((a, b) => a.order - b.order).map((m) => ({ ...m, topics: [...(m.topics ?? [])].sort((a, b) => a.order - b.order) }))
    : [{ title: '', topics: [] }]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const locked = !!program && program.activeEnrollmentCount > 0;

  const priceCents = price === '' ? 0 : Math.round(Number(price) * 100);
  const perSession = Number(sessionCount) > 0 ? Math.floor(priceCents / Number(sessionCount)) : 0;
  // Mirrors the server rule: free, or at least the platform fee per session.
  const priceOk = priceCents === 0 || priceCents >= Number(sessionCount) * PLATFORM_FEE_CENTS;
  const ready = priceOk && title.trim() && modules.length > 0 && modules.every((m) => m.title.trim() && m.topics.every((t) => t.title.trim())) && Number(sessionCount) >= 1 && price !== '';

  // Adds the chapters/topics from a CSV after the existing ones (blank placeholder chapters are dropped).
  const importChapters = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCsvError(null);
    if (!isCsvFile(file)) { setCsvError('Please choose a .csv file — use the template if you need one.'); return; }
    try {
      const imported = await parseChaptersCsv(file);
      setModules((ms) => [
        ...ms.filter((m) => m.title.trim() || m.topics.length > 0),
        ...imported.map((c) => ({ title: c.title, description: c.description, topics: c.topics })),
      ]);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Could not parse that file');
    }
  };

  const save = () => {
    const dto: ProgramInput = {
      title: title.trim(),
      category,
      level,
      description: description.trim() || undefined,
      sessionCount: Number(sessionCount),
      sessionMinutes: Number(sessionMinutes),
      priceCents: Math.round(Number(price) * 100),
      maxEnrollees: num(maxEnrollees),
      modules: modules.map((m) => ({
        publicId: m.publicId,
        title: m.title.trim(),
        description: m.description?.trim() || undefined,
        topics: m.topics.map((t) => ({ publicId: t.publicId, title: t.title.trim() })),
      })),
    };
    if (program) update({ id: program.publicId, dto }, { onSuccess: onDone });
    else create(dto, { onSuccess: onDone });
  };

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{program ? 'Edit program' : 'New skill program'}</p>
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chess for Beginners" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Category" options={[...PROGRAM_CATEGORIES]} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Select label="Level" options={[...PROGRAM_LEVELS]} value={level} onChange={(e) => setLevel(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={4000}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-3">
          <Input label="Max students (optional)" type="number" value={maxEnrollees} onChange={(e) => setMaxEnrollees(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Sessions" type="number" value={sessionCount} onChange={(e) => setSessionCount(e.target.value)} disabled={locked} />
          <Input label="Minutes per session" type="number" value={sessionMinutes} onChange={(e) => setSessionMinutes(e.target.value)} disabled={locked} />
          <Input label="Total price ($)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} disabled={locked} />
        </div>
        {priceCents > 0 && Number(sessionCount) > 0 && (
          <p className={`text-xs ${priceOk ? 'text-gray-500' : 'text-red-500'}`}>
            {priceOk
              ? `Each session is ${formatCurrency(perSession)}; you earn ${formatCurrency(Math.max(0, perSession - PLATFORM_FEE_CENTS))} per completed session after the ${formatCurrency(PLATFORM_FEE_CENTS)} platform fee.`
              : `A paid program must be at least ${formatCurrency(PLATFORM_FEE_CENTS)} per session (${formatCurrency(PLATFORM_FEE_CENTS * Number(sessionCount))} total), or free.`}
          </p>
        )}
        {locked && <p className="text-xs text-gray-500">Students have enrolled: sessions, session length and price are locked, and chapters can only be added.</p>}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-gray-500">Chapters (in order), each with its topics</p>
            <div className="flex gap-2">
              <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importChapters} />
              <Button size="sm" variant="ghost" onClick={downloadChaptersCsvTemplate}><Download className="h-3.5 w-3.5" /> Template</Button>
              <Button size="sm" variant="outline" onClick={() => csvRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload chapters CSV</Button>
            </div>
          </div>
          {csvError && <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{csvError}</pre>}
          {modules.map((m, i) => {
            const setModule = (patch: Partial<ModuleDraft>) => setModules((ms) => ms.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={m.publicId ?? `new-${i}`} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-xs text-gray-400">{i + 1}.</span>
                  <input value={m.title} onChange={(e) => setModule({ title: e.target.value })}
                    placeholder="Chapter title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium" />
                  {!(locked && m.publicId) && (
                    <button type="button" aria-label="Remove chapter" onClick={() => setModules((ms) => ms.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-2 space-y-1.5 pl-8">
                  {m.topics.map((t, k) => (
                    <div key={t.publicId ?? `t-${k}`} className="flex items-center gap-2">
                      <span className="w-8 text-xs text-gray-400">{i + 1}.{k + 1}</span>
                      <input value={t.title}
                        onChange={(e) => setModule({ topics: m.topics.map((x, n) => (n === k ? { ...x, title: e.target.value } : x)) })}
                        placeholder="Topic title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1 text-sm" />
                      <button type="button" aria-label="Remove topic" onClick={() => setModule({ topics: m.topics.filter((_, n) => n !== k) })} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => setModule({ topics: [...m.topics, { title: '' }] })}><Plus className="h-3.5 w-3.5" /> Add topic</Button>
                </div>
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => setModules((ms) => [...ms, { title: '', topics: [] }])}><Plus className="h-3.5 w-3.5" /> Add chapter</Button>
        </div>

        <div className="flex gap-2">
          <Button variant="gradient" loading={creating || updating} disabled={!ready} onClick={save}>
            <Save className="h-3.5 w-3.5" /> {program ? 'Save changes' : 'Save program'}
          </Button>
          <Button variant="outline" onClick={onCancel ?? onDone}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
