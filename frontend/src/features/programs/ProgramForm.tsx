// frontend/src/features/programs/ProgramForm.tsx
import { useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PROGRAM_CATEGORIES, PROGRAM_LEVELS } from '../../constants/programs';
import { useCreateProgram, useUpdateProgram } from '../../hooks/use-programs';
import type { Program, ProgramInput } from '../../services/programs.service';
import { formatCurrency } from '../../utils/currency';

/** Must match PLATFORM_FEE_CENTS on the server (server/src/utils/currency.ts). */
const PLATFORM_FEE_CENTS = 100;

type ModuleDraft = { publicId?: string; title: string; description?: string };
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/** Create or edit a program. Price/sessions are locked server-side once students enrol. */
export function ProgramForm({ program, onDone }: { program?: Program; onDone: () => void }) {
  const { mutate: create, isPending: creating } = useCreateProgram();
  const { mutate: update, isPending: updating } = useUpdateProgram();
  const [title, setTitle] = useState(program?.title ?? '');
  const [category, setCategory] = useState(program?.category ?? 'GAMES');
  const [level, setLevel] = useState(program?.level ?? 'BEGINNER');
  const [description, setDescription] = useState(program?.description ?? '');
  const [ageMin, setAgeMin] = useState(program?.ageMin?.toString() ?? '');
  const [ageMax, setAgeMax] = useState(program?.ageMax?.toString() ?? '');
  const [sessionCount, setSessionCount] = useState(String(program?.sessionCount ?? 8));
  const [sessionMinutes, setSessionMinutes] = useState(String(program?.sessionMinutes ?? 60));
  const [price, setPrice] = useState(program ? (program.priceCents / 100).toFixed(2) : '');
  const [maxEnrollees, setMaxEnrollees] = useState(program?.maxEnrollees?.toString() ?? '');
  const [modules, setModules] = useState<ModuleDraft[]>(program ? [...program.modules].sort((a, b) => a.order - b.order) : [{ title: '' }]);
  const locked = !!program && program.activeEnrollmentCount > 0;

  const priceCents = price === '' ? 0 : Math.round(Number(price) * 100);
  const perSession = Number(sessionCount) > 0 ? Math.floor(priceCents / Number(sessionCount)) : 0;
  // Mirrors the server rule: free, or at least the platform fee per session.
  const priceOk = priceCents === 0 || priceCents >= Number(sessionCount) * PLATFORM_FEE_CENTS;
  const ready = priceOk && title.trim() && modules.length > 0 && modules.every((m) => m.title.trim()) && Number(sessionCount) >= 1 && price !== '';

  const save = () => {
    const dto: ProgramInput = {
      title: title.trim(),
      category,
      level,
      description: description.trim() || undefined,
      ageMin: num(ageMin),
      ageMax: num(ageMax),
      sessionCount: Number(sessionCount),
      sessionMinutes: Number(sessionMinutes),
      priceCents: Math.round(Number(price) * 100),
      maxEnrollees: num(maxEnrollees),
      modules: modules.map((m) => ({ publicId: m.publicId, title: m.title.trim(), description: m.description?.trim() || undefined })),
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Min age (optional)" type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
          <Input label="Max age (optional)" type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
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
        {locked && <p className="text-xs text-gray-500">Students have enrolled: sessions, session length and price are locked, and modules can only be added.</p>}

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Modules (in order)</p>
          {modules.map((m, i) => (
            <div key={m.publicId ?? `new-${i}`} className="flex items-center gap-2">
              <span className="w-6 text-xs text-gray-400">{i + 1}.</span>
              <input value={m.title} onChange={(e) => setModules((ms) => ms.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                placeholder="Module title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" />
              {!(locked && m.publicId) && (
                <button type="button" aria-label="Remove module" onClick={() => setModules((ms) => ms.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setModules((ms) => [...ms, { title: '' }])}><Plus className="h-3.5 w-3.5" /> Add module</Button>
        </div>

        <div className="flex gap-2">
          <Button variant="gradient" loading={creating || updating} disabled={!ready} onClick={save}>
            <Save className="h-3.5 w-3.5" /> {program ? 'Save changes' : 'Save program'}
          </Button>
          <Button variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
