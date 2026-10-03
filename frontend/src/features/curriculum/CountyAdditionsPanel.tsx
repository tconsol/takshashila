// frontend/src/features/curriculum/CountyAdditionsPanel.tsx
//
// Admin view of the extra programs a county offers on top of the state curriculum (information only).
// Imported records start as drafts; an admin links them to a county if needed, then publishes.
import { useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Loading';
import { useConfirm } from '../../hooks/use-confirm';
import { useUsCounties } from '../../hooks/use-geo';
import {
  useAdminCountyAdditions, useCreateCountyAddition, useUpdateCountyAddition, usePublishCountyAddition, usePublishAllCountyAdditions, useDeleteCountyAddition,
} from '../../hooks/use-county-additions';
import { gradeLabel, gradeRangeLabel, type CountyAddition } from '../../services/county-additions.service';

const GRADE_CHOICES = Array.from({ length: 13 }, (_, n) => ({ value: String(n), label: gradeLabel(n) }));
const inputClass = 'w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900';

function AdditionEditor({ stateCode, addition, defaultCounty, onClose }: {
  stateCode: string;
  addition?: CountyAddition;
  defaultCounty?: string;
  onClose: () => void;
}) {
  const { data: counties = [] } = useUsCounties(stateCode);
  const { mutate: create, isPending: creating } = useCreateCountyAddition();
  const { mutate: update, isPending: updating } = useUpdateCountyAddition();

  const [countyFips, setCountyFips] = useState(addition?.countyFips ?? defaultCounty ?? '');
  const [district, setDistrict] = useState(addition?.district ?? '');
  const [gradeFrom, setGradeFrom] = useState(String(addition?.gradeFrom ?? 0));
  const [gradeTo, setGradeTo] = useState(String(addition?.gradeTo ?? 12));
  const [category, setCategory] = useState(addition?.category ?? '');
  const [subjectName, setSubjectName] = useState(addition?.subjectName ?? '');
  const [description, setDescription] = useState(addition?.description ?? '');
  const [topics, setTopics] = useState((addition?.topics ?? []).join('\n'));

  const rangeOk = Number(gradeTo) >= Number(gradeFrom);
  const valid = !!countyFips && !!category.trim() && rangeOk;

  const save = () => {
    const dto = {
      countyFips,
      district: district.trim(),
      gradeFrom: Number(gradeFrom),
      gradeTo: Number(gradeTo),
      category: category.trim(),
      subjectName: subjectName.trim(),
      description: description.trim(),
      topics: topics.split('\n').map((t) => t.trim()).filter(Boolean),
    };
    if (addition) update({ publicId: addition.publicId, dto }, { onSuccess: onClose });
    else create({ stateCode, ...dto }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={addition ? 'Edit county program' : 'Add county program'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" loading={creating || updating} disabled={!valid} onClick={save}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Select
          label="County"
          placeholder="Select county"
          options={counties.map((c) => ({ value: c.fips, label: c.name }))}
          value={countyFips}
          onChange={(e) => setCountyFips(e.target.value)}
        />
        <input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="School district (optional)" aria-label="School district" className={inputClass} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="First grade" options={GRADE_CHOICES} value={gradeFrom} onChange={(e) => setGradeFrom(e.target.value)} />
          <Select label="Last grade" options={GRADE_CHOICES} value={gradeTo} onChange={(e) => setGradeTo(e.target.value)} />
        </div>
        {!rangeOk && <p className="text-xs text-red-500">The last grade cannot be before the first grade.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g. Computer Science)" aria-label="Category" className={inputClass} />
          <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Subject name (optional)" aria-label="Subject name" className={inputClass} />
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the county offers" aria-label="Description" rows={3} maxLength={4000} className={inputClass} />
        <textarea value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={'Extra topics, one per line (optional)'} aria-label="Topics" rows={4} className={inputClass} />
      </div>
    </Modal>
  );
}

export function CountyAdditionsPanel({ stateCode }: { stateCode: string }) {
  const { confirm, confirmDialog } = useConfirm();
  const { data: counties = [] } = useUsCounties(stateCode);
  const { data: items = [], isLoading } = useAdminCountyAdditions(stateCode);
  const { mutate: setPublished, isPending: publishing } = usePublishCountyAddition();
  const { mutate: remove } = useDeleteCountyAddition();
  const { mutate: publishAll, isPending: publishingAll } = usePublishAllCountyAdditions();

  const [countyFilter, setCountyFilter] = useState('');
  const [editing, setEditing] = useState<CountyAddition | 'new' | null>(null);

  const visible = countyFilter ? items.filter((i) => i.countyFips === countyFilter) : items;
  // Drafts the "Publish all" button would publish: linked to a county, in the current view.
  const draftsReady = visible.filter((i) => !i.isPublished && i.countyFips).length;
  const unlinked = visible.filter((i) => !i.isPublished && !i.countyFips).length;
  const byCounty = new Map<string, CountyAddition[]>();
  for (const i of visible) byCounty.set(i.county, [...(byCounty.get(i.county) ?? []), i]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="w-64">
          <Select
            label="County"
            options={[{ value: '', label: 'All counties' }, ...counties.map((c) => ({ value: c.fips, label: c.name }))]}
            value={countyFilter}
            onChange={(e) => setCountyFilter(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={publishingAll}
            disabled={draftsReady === 0}
            title={draftsReady === 0 ? 'No linked drafts to publish' : undefined}
            onClick={async () => {
              const where = countyFilter ? (counties.find((c) => c.fips === countyFilter)?.name ?? 'this county') : 'this state';
              const { confirmed } = await confirm({
                title: `Publish ${draftsReady} draft program${draftsReady === 1 ? '' : 's'}?`,
                message: `Students and parents in ${where} will see ${draftsReady === 1 ? 'it' : 'them'} straight away.${unlinked > 0 && !countyFilter ? ` ${unlinked} draft${unlinked === 1 ? '' : 's'} not linked to a county will stay as draft.` : ''}`,
                confirmLabel: 'Publish all',
              });
              if (confirmed) publishAll({ stateCode, countyFips: countyFilter || undefined });
            }}
          >
            <Eye className="h-4 w-4" /> Publish all drafts ({draftsReady})
          </Button>
          <Button variant="gradient" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Add county program</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : visible.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No county programs yet. Use Add county program to create one.</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {[...byCounty.entries()].map(([county, list]) => (
            <section key={county}>
              <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{county}</h2>
              <ul className="space-y-2">
                {list.map((a) => (
                  <li key={a.publicId} className="rounded-lg border border-rule p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{a.category}{a.subjectName ? ` · ${a.subjectName}` : ''}</span>
                          <Badge variant="info" tone="soft">{gradeRangeLabel(a.gradeFrom, a.gradeTo)}</Badge>
                          {a.isPublished ? <Badge variant="success" tone="soft">Published</Badge> : <Badge variant="default" tone="soft">Draft</Badge>}
                          {!a.countyFips && <Badge variant="warning" tone="soft"><AlertTriangle className="mr-1 inline h-3 w-3" />Pick a county</Badge>}
                        </div>
                        {a.district && <p className="mt-0.5 text-xs text-gray-500">{a.district}</p>}
                        {a.description && <p className="mt-1 whitespace-pre-line text-xs text-gray-600 dark:text-gray-400">{a.description}</p>}
                        {a.topics.length > 0 && (
                          <ul className="mt-1 list-disc pl-5 text-xs text-gray-700 dark:text-gray-300">{a.topics.map((t, i) => <li key={i}>{t}</li>)}</ul>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={publishing}
                          disabled={!a.isPublished && !a.countyFips}
                          title={!a.isPublished && !a.countyFips ? 'Pick the county first' : undefined}
                          onClick={async () => {
                            const publish = !a.isPublished;
                            const { confirmed } = await confirm({
                              title: publish ? 'Publish this program?' : 'Unpublish this program?',
                              message: publish
                                ? `Students and parents in ${a.county} will see "${a.category}" for ${gradeRangeLabel(a.gradeFrom, a.gradeTo)}.`
                                : `"${a.category}" will no longer be shown to students and parents in ${a.county}.`,
                              confirmLabel: publish ? 'Publish' : 'Unpublish',
                              tone: publish ? 'primary' : 'danger',
                            });
                            if (confirmed) setPublished({ publicId: a.publicId, publish });
                          }}
                        >
                          {a.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Delete ${a.category}`}
                          onClick={async () => {
                            const { confirmed } = await confirm({
                              title: 'Delete this program?',
                              message: `"${a.category}" for ${a.county} will be removed.`,
                              confirmLabel: 'Delete',
                              tone: 'danger',
                            });
                            if (confirmed) remove(a.publicId);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <AdditionEditor
          key={editing === 'new' ? 'new' : editing.publicId}
          stateCode={stateCode}
          addition={editing === 'new' ? undefined : editing}
          defaultCounty={countyFilter || undefined}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmDialog}
    </div>
  );
}
