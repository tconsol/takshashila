// frontend/src/features/courses/CourseStructureTree.tsx
//
// Course › Topic › (classes + materials), shared by the student, parent, tutor and
// admin views (curriculum-materials spec §7.1). Status is shown only when
// `showStatus` is set — the server omits it for tutors and admins anyway.
import { useState, type ReactNode, type KeyboardEvent } from 'react';
import { CheckCircle2, Clock, CircleDashed, ChevronRight, FileText, ClipboardList, PenSquare, Video } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import type { ProgressClass, StructureMaterial, StructureTopic } from '../../services/courses.service';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const CLASS_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Completed',
  SCHEDULED: 'Scheduled',
  LIVE: 'Live now',
  MISSED: 'Missed',
  FAILED: 'Failed',
};

const KIND = {
  resource: { label: 'Resource', icon: FileText },
  assignment: { label: 'Assignment', icon: ClipboardList },
  worksheet: { label: 'Worksheet', icon: PenSquare },
} as const;

function ClassRow({ cls }: { cls: ProgressClass }) {
  return (
    <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
      <Video className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      <span>{formatWhen(cls.startUTC)}</span>
      <Badge
        variant={cls.status === 'COMPLETED' ? 'success' : cls.status === 'LIVE' ? 'danger' : cls.status === 'SCHEDULED' ? 'info' : 'warning'}
        tone="soft"
      >
        {CLASS_STATUS_LABEL[cls.status] ?? cls.status}
      </Badge>
    </li>
  );
}

function TopicStatus({ topic }: { topic: StructureTopic }) {
  if (!topic.status) return null;
  if (topic.status === 'COMPLETED') {
    return <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="h-4 w-4" /> Completed</span>;
  }
  if (topic.status === 'SCHEDULED' && topic.nextClass) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-brand-600">
        <Clock className="h-4 w-4" /> {topic.nextClass.status === 'LIVE' ? 'Live now' : formatWhen(topic.nextClass.startUTC)}
      </span>
    );
  }
  return <span className="flex items-center gap-1 text-xs text-gray-400"><CircleDashed className="h-4 w-4" /> Not scheduled yet</span>;
}

interface NodeProps {
  topic: StructureTopic;
  index: number;
  showStatus: boolean;
  hideClasses?: boolean;
  hideMaterials?: boolean;
  onOpenMaterial: (m: StructureMaterial) => void;
  renderMaterialExtra?: (m: StructureMaterial) => ReactNode;
  renderTopicActions?: (topic: StructureTopic) => ReactNode;
}

function MaterialRow({ m, onOpen, extra }: { m: StructureMaterial; onOpen: () => void; extra?: ReactNode }) {
  const { label, icon: Icon } = KIND[m.kind];
  // A div, not a <button>: `extra` may itself contain buttons (admin delete, tutor submissions).
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } };
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={onKey}
        className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs text-gray-600 hover:bg-surface-hover dark:text-gray-300"
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="font-medium text-gray-800 dark:text-gray-200">{m.title}</span>
        <span className="text-gray-400">· {label}</span>
        {m.authorRole === 'ADMIN' && <Badge variant="purple" tone="soft">Curriculum</Badge>}
        {extra}
      </div>
    </li>
  );
}

function TopicNode({ topic, index, showStatus, hideClasses, hideMaterials, onOpenMaterial, renderMaterialExtra, renderTopicActions }: NodeProps) {
  const [open, setOpen] = useState(!showStatus || topic.status !== 'COMPLETED');
  const done = showStatus && topic.status === 'COMPLETED';

  return (
    <li className="rounded-lg border border-rule">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <ChevronRight className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
        <span className="w-6 text-xs text-gray-400">{index + 1}.</span>
        <span className={`flex-1 text-sm font-medium ${done ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900 dark:text-white'}`}>
          {topic.title}
        </span>
        {showStatus && <TopicStatus topic={topic} />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-rule px-3 pb-3 pl-12 pt-3">
          {renderTopicActions?.(topic)}
          {!hideClasses && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Classes</p>
              {topic.classes.length === 0 ? (
                <p className="text-xs text-gray-400">No class booked for this topic yet.</p>
              ) : (
                <ul className="space-y-1.5">{topic.classes.map((c) => <ClassRow key={c.publicId} cls={c} />)}</ul>
              )}
            </div>
          )}
          {!hideMaterials && <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Materials</p>
            {topic.materials.length === 0 ? (
              <p className="text-xs text-gray-400">No materials yet.</p>
            ) : (
              <ul className="space-y-1">
                {topic.materials.map((m) => (
                  <MaterialRow key={`${m.kind}-${m.publicId}`} m={m} onOpen={() => onOpenMaterial(m)} extra={renderMaterialExtra?.(m)} />
                ))}
              </ul>
            )}
          </div>}
        </div>
      )}
    </li>
  );
}

export function CourseStructureTree({
  topics, otherClasses, showStatus, hideClasses, hideMaterials, onOpenMaterial, renderMaterialExtra, renderTopicActions,
}: {
  topics: StructureTopic[];
  otherClasses: ProgressClass[];
  showStatus: boolean;
  hideClasses?: boolean;
  hideMaterials?: boolean;
  onOpenMaterial: (m: StructureMaterial) => void;
  renderMaterialExtra?: (m: StructureMaterial) => ReactNode;
  renderTopicActions?: (topic: StructureTopic) => ReactNode;
}) {
  return (
    <>
      <ul className="space-y-2">
        {topics.map((t, i) => (
          <TopicNode
            key={t.publicId}
            topic={t}
            index={i}
            showStatus={showStatus}
            hideClasses={hideClasses}
            hideMaterials={hideMaterials}
            onOpenMaterial={onOpenMaterial}
            renderMaterialExtra={renderMaterialExtra}
            renderTopicActions={renderTopicActions}
          />
        ))}
      </ul>
      {!hideClasses && otherClasses.length > 0 && (
        <div className="mt-5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Other classes</p>
          <p className="mb-2 text-xs text-gray-400">Classes in this course the tutor didn't link to a topic.</p>
          <ul className="space-y-1.5">{otherClasses.map((c) => <ClassRow key={c.publicId} cls={c} />)}</ul>
        </div>
      )}
    </>
  );
}
