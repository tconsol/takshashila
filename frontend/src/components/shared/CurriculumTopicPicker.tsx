// frontend/src/components/shared/CurriculumTopicPicker.tsx
//
// Required curriculum + topics choice for tutor-created materials (curriculum-materials
// spec §5.2). Lists only curricula the server says this tutor may attach to.
import { Select } from '../ui/Select';
import { useAttachableCurricula } from '../../hooks/use-curricula';

export interface CurriculumAttachmentValue {
  curriculumPublicId: string;
  topicPublicIds: string[];
}

export const EMPTY_ATTACHMENT: CurriculumAttachmentValue = { curriculumPublicId: '', topicPublicIds: [] };

export const isAttachmentComplete = (v: CurriculumAttachmentValue) => !!v.curriculumPublicId && v.topicPublicIds.length > 0;

export function CurriculumTopicPicker({ value, onChange }: {
  value: CurriculumAttachmentValue;
  onChange: (next: CurriculumAttachmentValue) => void;
}) {
  const { data: curricula = [], isLoading } = useAttachableCurricula();
  const current = curricula.find((c) => c.publicId === value.curriculumPublicId);

  if (!isLoading && curricula.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
        No curriculum matches your subjects and grades yet — set them in Profile or ask an admin to publish one.
      </p>
    );
  }

  const toggle = (id: string) =>
    onChange({
      ...value,
      topicPublicIds: value.topicPublicIds.includes(id)
        ? value.topicPublicIds.filter((t) => t !== id)
        : [...value.topicPublicIds, id],
    });

  return (
    <div className="space-y-2">
      <Select
        label="Curriculum"
        placeholder={isLoading ? 'Loading curricula…' : 'Select curriculum'}
        options={curricula.map((c) => ({
          value: c.publicId,
          label: `${c.title} · ${c.grade} · ${c.subject}${c.district ? ` · ${c.district}` : ''}`,
        }))}
        value={value.curriculumPublicId}
        onChange={(e) => onChange({ curriculumPublicId: e.target.value, topicPublicIds: [] })}
        disabled={isLoading}
      />
      {current && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Topics</p>
          <div className="flex flex-wrap gap-1.5">
            {current.topics.map((t) => {
              const on = value.topicPublicIds.includes(t.publicId);
              return (
                <button
                  key={t.publicId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.publicId)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                    on ? 'bg-accent text-accent-ink' : 'bg-surface-sunk text-ink-muted hover:text-ink'
                  }`}
                >
                  {t.title}
                </button>
              );
            })}
          </div>
          {value.topicPublicIds.length === 0 && <p className="mt-1 text-xs text-red-500">Pick at least one topic</p>}
        </div>
      )}
    </div>
  );
}
