// frontend/src/pages/student/StudentCourseProgressPage.tsx
//
// Nested progress for one course the student is taking:
//   Course › Topic (status) › classes + materials
// A topic is done when all its counted classes are COMPLETED (computed server-side
// in server/src/modules/courses/course-progress.ts).
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookOpen, CheckCircle2, Clock, CircleDashed, ChevronRight, FileText, ClipboardList, PenSquare, Video, ArrowLeft,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useCourseProgress } from '../../hooks/use-courses';
import type { ProgressClass, TopicProgress } from '../../services/courses.service';

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const CLASS_STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Completed',
  SCHEDULED: 'Scheduled',
  LIVE: 'Live now',
  MISSED: 'Missed',
  FAILED: 'Failed',
};

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

function TopicStatus({ topic }: { topic: TopicProgress }) {
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

function TopicNode({ topic, index }: { topic: TopicProgress; index: number }) {
  const [open, setOpen] = useState(topic.status !== 'COMPLETED');
  const materials = [
    ...topic.materials.resources.map((m) => ({ ...m, kind: 'Resource', icon: FileText })),
    ...topic.materials.assignments.map((m) => ({ ...m, kind: 'Assignment', icon: ClipboardList })),
    ...topic.materials.worksheets.map((m) => ({ ...m, kind: 'Worksheet', icon: PenSquare })),
  ];

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
        <span className={`flex-1 text-sm font-medium ${topic.status === 'COMPLETED' ? 'text-gray-500 line-through decoration-gray-300' : 'text-gray-900 dark:text-white'}`}>
          {topic.title}
        </span>
        <TopicStatus topic={topic} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-rule px-3 pb-3 pl-12 pt-3">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Classes</p>
            {topic.classes.length === 0 ? (
              <p className="text-xs text-gray-400">Your tutor hasn't booked a class for this topic yet.</p>
            ) : (
              <ul className="space-y-1.5">{topic.classes.map((c) => <ClassRow key={c.publicId} cls={c} />)}</ul>
            )}
          </div>
          {materials.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Materials</p>
              <ul className="space-y-1.5">
                {materials.map(({ publicId, title, kind, icon: Icon }) => (
                  <li key={publicId} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>{title}</span>
                    <span className="text-gray-400">· {kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function StudentCourseProgressPage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  const { data, isLoading, isError } = useCourseProgress(coursePublicId);

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        Course not found. <Link to="/dashboard" className="text-brand-600 hover:underline">Back to dashboard</Link>
      </div>
    );
  }

  const { curriculum, course, topics, otherClasses } = data;
  const doneTopics = topics.filter((t) => t.status === 'COMPLETED').length;
  const pct = topics.length ? Math.round((doneTopics / topics.length) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <Link to="/dashboard" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>
      <PageHeader
        eyebrow="My courses"
        title={curriculum.title}
        description={`${curriculum.subject} · ${curriculum.grade}${curriculum.district ? ` · ${curriculum.district}` : ''} · with ${course.tutorName}`}
        icon={<BookOpen className="h-5 w-5" />}
      />

      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium text-gray-900 dark:text-white">{doneTopics}/{topics.length} topics completed</span>
            <span className="text-xs text-gray-500">{course.classesCompletedCount}/{course.classesRequired} classes completed</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <BookOpen className="h-4 w-4 text-gray-400" /> {curriculum.title}
          </p>
          <ul className="space-y-2">
            {topics.map((t, i) => <TopicNode key={t.publicId} topic={t} index={i} />)}
          </ul>

          {otherClasses.length > 0 && (
            <div className="mt-5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Other classes</p>
              <p className="mb-2 text-xs text-gray-400">Classes in this course your tutor didn't link to a topic.</p>
              <ul className="space-y-1.5">{otherClasses.map((c) => <ClassRow key={c.publicId} cls={c} />)}</ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
