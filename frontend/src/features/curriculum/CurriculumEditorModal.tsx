// frontend/src/features/curriculum/CurriculumEditorModal.tsx
//
// Admin editor for a state curriculum: state (fixed once created), grade, subject, title and the
// ordered chapters with their topics. Existing chapters/topics keep their publicId, so renaming
// one never detaches the materials, courses or progress that point at it.
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useCreateCurriculum, useUpdateCurriculum } from '../../hooks/use-curricula';
import { useUsStates } from '../../hooks/use-geo';
import { GRADE_OPTIONS, HIGH_SCHOOL } from '../../constants/grades';
import type { ChapterInput, Curriculum } from '../../services/curricula.service';

/** Subject names used by the state standards. */
export const CURRICULUM_SUBJECTS = [
  'English Language Arts', 'Mathematics', 'Science', 'Social Studies', 'Computer Science',
  'Health Education', 'Physical Education', 'Music', 'Visual Arts', 'Dance', 'Theatre', 'Media Arts',
];

const GRADE_CHOICES = [...GRADE_OPTIONS, { value: HIGH_SCHOOL, label: HIGH_SCHOOL }];

const inputClass = 'rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm bg-white dark:bg-gray-900';

interface TopicDraft { key: string; publicId?: string; title: string }
interface ChapterDraft { key: string; publicId?: string; title: string; topics: TopicDraft[] }

let counter = 0;
const nextKey = () => `k${++counter}`;

const toDrafts = (c?: Curriculum): ChapterDraft[] =>
  [...(c?.chapters ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((ch) => ({
      key: nextKey(), publicId: ch.publicId, title: ch.title,
      topics: [...ch.topics].sort((a, b) => a.order - b.order).map((t) => ({ key: nextKey(), publicId: t.publicId, title: t.title })),
    }));

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export function CurriculumEditorModal({ curriculum, defaultState, onClose }: {
  curriculum?: Curriculum;
  defaultState?: string;
  onClose: () => void;
}) {
  const { mutate: create, isPending: creating } = useCreateCurriculum();
  const { mutate: update, isPending: updating } = useUpdateCurriculum();
  const { data: states = [] } = useUsStates();

  const [stateCode, setStateCode] = useState(curriculum?.stateCode ?? defaultState ?? '');
  const [grade, setGrade] = useState(curriculum?.grade ?? 'Grade 1');
  const [subject, setSubject] = useState(curriculum?.subject ?? '');
  const [title, setTitle] = useState(curriculum?.title ?? '');
  const [description, setDescription] = useState(curriculum?.description ?? '');
  const [courseName, setCourseName] = useState(curriculum?.courseName ?? '');
  const [chapters, setChapters] = useState<ChapterDraft[]>(() => toDrafts(curriculum));

  const isHighSchool = grade === HIGH_SCHOOL;
  const patchChapter = (i: number, patch: Partial<ChapterDraft>) =>
    setChapters((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const patchTopic = (ci: number, ti: number, title: string) =>
    patchChapter(ci, { topics: chapters[ci].topics.map((t, idx) => (idx === ti ? { ...t, title } : t)) });

  const valid = !!stateCode && !!grade && !!subject && !!title.trim()
    && chapters.every((c) => c.title.trim() && c.topics.every((t) => t.title.trim()));

  const save = () => {
    const payload: ChapterInput[] = chapters.map((c) => ({
      publicId: c.publicId,
      title: c.title.trim(),
      topics: c.topics.map((t) => ({ publicId: t.publicId, title: t.title.trim() })),
    }));
    const common = {
      grade, subject, title: title.trim(),
      description: description.trim() || undefined,
      courseName: isHighSchool ? courseName.trim() || undefined : undefined,
      chapters: payload,
    };
    if (curriculum) update({ curriculumPublicId: curriculum.publicId, dto: common }, { onSuccess: onClose });
    else create({ stateCode, ...common }, { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={curriculum ? `Edit — ${curriculum.title}` : 'New curriculum'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" loading={creating || updating} disabled={!valid} onClick={save}>
            <Save className="h-3.5 w-3.5" /> {curriculum ? 'Save changes' : 'Save curriculum'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {curriculum ? (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-500">State</p>
              <p className="py-2 text-sm text-gray-800 dark:text-gray-200">{states.find((s) => s.code === stateCode)?.name ?? stateCode}</p>
            </div>
          ) : (
            <Select
              label="State"
              placeholder="Select state"
              options={states.map((s) => ({ value: s.code, label: s.name }))}
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
            />
          )}
          <Select label="Grade" options={GRADE_CHOICES} value={grade} onChange={(e) => setGrade(e.target.value)} />
          <Select
            label="Subject"
            placeholder="Select subject"
            options={[...new Set([...CURRICULUM_SUBJECTS, ...(subject ? [subject] : [])])].map((s) => ({ value: s, label: s }))}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Curriculum title" aria-label="Curriculum title" className={`self-end ${inputClass}`} />
        </div>
        {isHighSchool && (
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} placeholder="Course name (e.g. Algebra I)" aria-label="Course name" className={`w-full ${inputClass}`} />
        )}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          aria-label="Description"
          rows={2}
          maxLength={2000}
          className={`w-full ${inputClass}`}
        />

        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500">Chapters and topics (in order)</p>
          <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
            {chapters.map((ch, ci) => (
              <div key={ch.key} className="rounded-lg border border-rule p-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-xs text-gray-400">{ci + 1}.</span>
                  <input value={ch.title} onChange={(e) => patchChapter(ci, { title: e.target.value })} placeholder="Chapter title" aria-label={`Chapter ${ci + 1} title`} className={`flex-1 ${inputClass}`} />
                  <button type="button" aria-label="Move chapter up" disabled={ci === 0} onClick={() => setChapters((cs) => move(cs, ci, -1))} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label="Move chapter down" disabled={ci === chapters.length - 1} onClick={() => setChapters((cs) => move(cs, ci, 1))} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label="Remove chapter" onClick={() => setChapters((cs) => cs.filter((_, i) => i !== ci))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 space-y-1.5 pl-8">
                  {ch.topics.map((t, ti) => (
                    <div key={t.key} className="flex items-center gap-2">
                      <input value={t.title} onChange={(e) => patchTopic(ci, ti, e.target.value)} placeholder="Topic title" aria-label={`Chapter ${ci + 1} topic ${ti + 1}`} className={`flex-1 ${inputClass}`} />
                      <button type="button" aria-label="Move topic up" disabled={ti === 0} onClick={() => patchChapter(ci, { topics: move(ch.topics, ti, -1) })} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Move topic down" disabled={ti === ch.topics.length - 1} onClick={() => patchChapter(ci, { topics: move(ch.topics, ti, 1) })} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Remove topic" onClick={() => patchChapter(ci, { topics: ch.topics.filter((_, i) => i !== ti) })} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => patchChapter(ci, { topics: [...ch.topics, { key: nextKey(), title: '' }] })}>
                    <Plus className="h-3.5 w-3.5" /> Add topic
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => setChapters((cs) => [...cs, { key: nextKey(), title: '', topics: [] }])}>
            <Plus className="h-3.5 w-3.5" /> Add chapter
          </Button>
        </div>
      </div>
    </Modal>
  );
}
