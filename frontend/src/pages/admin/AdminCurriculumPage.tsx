// frontend/src/pages/admin/AdminCurriculumPage.tsx
//
// State curricula grouped by grade. Pick a country and state (the first state is selected by default),
// open a grade tile to see that grade's subject curricula, then open a curriculum to see its chapters and topics.
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Plus, Eye, EyeOff, Trash2, Pencil, ListTree, ChevronRight } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Spinner } from '../../components/ui/Loading';
import { useConfirm } from '../../hooks/use-confirm';
import {
  useAdminStates, useAdminOverview, useCurriculum, usePublishCurriculum, useDeleteCurriculum,
} from '../../hooks/use-curricula';
import { useUsStates } from '../../hooks/use-geo';
import { CurriculumEditorModal } from '../../features/curriculum/CurriculumEditorModal';
import { CountyAdditionsPanel } from '../../features/curriculum/CountyAdditionsPanel';
import { Tabs } from '../../components/ui/Tabs';
import { GRADE_LIST, HIGH_SCHOOL } from '../../constants/grades';
import type { AdminCurriculumSummary } from '../../services/curricula.service';

const gradeRank = (g: string) => {
  if (g === HIGH_SCHOOL) return GRADE_LIST.length;
  const i = (GRADE_LIST as readonly string[]).indexOf(g);
  return i < 0 ? GRADE_LIST.length + 1 : i;
};

function DeleteCurriculumModal({ curriculum, onClose }: { curriculum: AdminCurriculumSummary; onClose: () => void }) {
  const { mutate: remove, isPending } = useDeleteCurriculum();
  return (
    <Modal
      open
      onClose={onClose}
      title="Delete curriculum?"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => remove(curriculum.publicId, { onSuccess: onClose })}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-semibold">{curriculum.title}</span> will be removed from the catalog and this list.
        Curricula with pending or accepted requests can't be deleted — unpublish them instead.
      </p>
    </Modal>
  );
}

/** The chapters and topics of one curriculum (loaded when its row is opened). */
function StructureExpansion({ curriculumPublicId }: { curriculumPublicId: string }) {
  const { data, isLoading } = useCurriculum(curriculumPublicId);
  if (isLoading) return <div className="flex justify-center py-4"><Spinner /></div>;
  const chapters = [...(data?.chapters ?? [])].sort((a, b) => a.order - b.order);
  if (chapters.length === 0) return <p className="py-2 text-xs text-gray-500">No chapters yet. Use Edit to add some.</p>;
  return (
    <ol className="space-y-2">
      {chapters.map((ch, i) => (
        <li key={ch.publicId} className="rounded-lg border border-rule p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">{i + 1}. {ch.title}</p>
          {ch.topics.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-9 text-xs text-gray-700 dark:text-gray-300">
              {[...ch.topics].sort((a, b) => a.order - b.order).map((t) => <li key={t.publicId}>{t.title}</li>)}
            </ul>
          ) : (
            <p className="mt-1 pl-5 text-xs text-gray-400">No topics.</p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function AdminCurriculumPage() {
  const base = useLocation().pathname.startsWith('/dashboard/super-admin') ? '/dashboard/super-admin/curriculum' : '/dashboard/admin/curriculum';
  const { confirm, confirmDialog } = useConfirm();
  const { data: usStates = [] } = useUsStates();
  const { data: adminStates, isLoading: statesLoading } = useAdminStates();

  // States that have curricula, alphabetical by name; the first one is selected until the admin picks another.
  const nameOf = (code: string) => usStates.find((s) => s.code === code)?.name ?? code;
  const stateOptions = [...(adminStates ?? [])].sort((a, b) => nameOf(a.stateCode).localeCompare(nameOf(b.stateCode)));
  const [pickedState, setPickedState] = useState<string | undefined>();
  const stateCode = pickedState ?? stateOptions[0]?.stateCode;

  const { data: curricula = [], isLoading } = useAdminOverview(stateCode);
  const { mutate: setPublished, isPending: publishing } = usePublishCurriculum();

  const [tab, setTab] = useState<'state' | 'county'>('state');
  const [openGrade, setOpenGrade] = useState<string | null>(null);
  const [openCurriculum, setOpenCurriculum] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminCurriculumSummary | null>(null);

  const byGrade = new Map<string, AdminCurriculumSummary[]>();
  for (const c of curricula) byGrade.set(c.grade, [...(byGrade.get(c.grade) ?? []), c]);
  const grades = [...byGrade.keys()].sort((a, b) => gradeRank(a) - gradeRank(b));

  const editTarget = editing && editing !== 'new' ? curricula.find((c) => c.publicId === editing) : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Platform"
        title="Curriculum"
        description={tab === 'state'
          ? 'State standards by grade. Open a grade to see its subjects, then a subject to see its chapters and topics.'
          : 'Extra programs counties offer on top of the state curriculum. Shown to students and parents in that county once published.'}
        icon={<GraduationCap className="h-5 w-5" />}
        actions={tab === 'state' ? <Button variant="gradient" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> New curriculum</Button> : undefined}
      />

      <div className="mb-5 grid max-w-xl gap-3 sm:grid-cols-2">
        <Select label="Country" options={[{ value: 'US', label: 'United States' }]} value="US" disabled />
        <Select
          label="State"
          placeholder={statesLoading ? 'Loading…' : 'No curricula yet'}
          options={stateOptions.map((s) => ({ value: s.stateCode, label: `${nameOf(s.stateCode)} (${s.published}/${s.total} published)` }))}
          value={stateCode ?? ''}
          onChange={(e) => { setPickedState(e.target.value); setOpenGrade(null); setOpenCurriculum(null); }}
          disabled={stateOptions.length === 0}
        />
      </div>

      <Tabs
        className="mb-5"
        tabs={[{ key: 'state', label: 'State curriculum' }, { key: 'county', label: 'County add-ons' }]}
        activeTab={tab}
        onChange={(key) => setTab(key as 'state' | 'county')}
      />

      {tab === 'county' && stateCode ? (
        <CountyAdditionsPanel stateCode={stateCode} />
      ) : statesLoading || (stateCode && isLoading) ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : grades.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No curricula yet. Use New curriculum to add one.</p></CardContent></Card>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grades.map((grade) => {
            const list = byGrade.get(grade)!;
            const open = openGrade === grade;
            const published = list.filter((c) => c.isPublished).length;
            return (
              <div key={grade} className={`rounded-xl border border-rule bg-surface ${open ? 'col-span-full' : ''}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => { setOpenGrade(open ? null : grade); setOpenCurriculum(null); }}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">{grade}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{list.length} {list.length === 1 ? 'curriculum' : 'curricula'} · {published} published</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>

                {open && (
                  <ul className="space-y-2 border-t border-rule p-4">
                    {list.map((c) => {
                      const expanded = openCurriculum === c.publicId;
                      return (
                        <li key={c.publicId} className="rounded-lg border border-rule">
                          <div className="flex flex-wrap items-center gap-3 p-3">
                            <button
                              type="button"
                              aria-expanded={expanded}
                              onClick={() => setOpenCurriculum(expanded ? null : c.publicId)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">{c.subject}</span>
                                  {c.isPublished ? <Badge variant="success" tone="soft">Published</Badge> : <Badge variant="default" tone="soft">Draft</Badge>}
                                </span>
                                <span className="block text-xs text-gray-500">
                                  {[c.courseName && c.courseName !== c.subject && c.courseName, c.usualGrade && `usually ${c.usualGrade}`, `${c.chapterCount} chapters`, `${c.topicCount} topics`].filter(Boolean).join(' · ')}
                                </span>
                              </span>
                            </button>
                            <div className="flex flex-wrap gap-2">
                              <Link to={`${base}/${c.publicId}`}>
                                <Button size="sm" variant="outline"><ListTree className="h-3.5 w-3.5" /> Materials</Button>
                              </Link>
                              <Button size="sm" variant="outline" onClick={() => setEditing(c.publicId)}>
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={publishing}
                                onClick={async () => {
                                  const publish = !c.isPublished;
                                  const { confirmed } = await confirm({
                                    title: publish ? 'Publish this curriculum?' : 'Unpublish this curriculum?',
                                    message: publish
                                      ? `Students in ${nameOf(stateCode!)} will see "${c.title}" straight away, and tutors can attach worksheets and assignments to it.`
                                      : `Students will no longer see "${c.title}", and tutors cannot attach new work to it. Existing work stays.`,
                                    confirmLabel: publish ? 'Publish' : 'Unpublish',
                                    tone: publish ? 'primary' : 'danger',
                                  });
                                  if (confirmed) setPublished({ curriculumPublicId: c.publicId, publish });
                                }}
                              >
                                {c.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setDeleting(c)} aria-label={`Delete ${c.title}`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          {expanded && (
                            <div className="border-t border-rule p-3">
                              <StructureExpansion curriculumPublicId={c.publicId} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (editing === 'new' || editTarget) && (
        <EditorLoader
          key={editing}
          curriculumPublicId={editing === 'new' ? undefined : editing}
          defaultState={stateCode}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && <DeleteCurriculumModal curriculum={deleting} onClose={() => setDeleting(null)} />}
      {confirmDialog}
    </div>
  );
}

/** The editor needs the full curriculum (chapters and topics), so load it before opening. */
function EditorLoader({ curriculumPublicId, defaultState, onClose }: { curriculumPublicId?: string; defaultState?: string; onClose: () => void }) {
  const { data, isLoading } = useCurriculum(curriculumPublicId);
  if (curriculumPublicId && (isLoading || !data)) {
    return <Modal open onClose={onClose} title="Edit curriculum"><div className="flex justify-center py-10"><Spinner /></div></Modal>;
  }
  return <CurriculumEditorModal curriculum={data} defaultState={defaultState} onClose={onClose} />;
}
