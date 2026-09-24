import { ClassStatus } from '../schedules/schedule.types';

export type TopicProgressStatus = 'COMPLETED' | 'SCHEDULED' | 'NOT_SCHEDULED';

export interface ProgressClass {
  publicId: string;
  status: string;
  startUTC: Date;
  endUTC: Date;
}

interface TopicInput {
  publicId: string;
  title: string;
  order: number;
}

interface ClassInput extends ProgressClass {
  courseTopicPublicId?: string;
}

export interface TopicProgress extends TopicInput {
  status: TopicProgressStatus;
  nextClass?: ProgressClass;
  classes: ProgressClass[];
}

// Replaced or called off — they say nothing about whether the topic was taught.
const IGNORED = new Set<string>([ClassStatus.CANCELLED, ClassStatus.RESCHEDULED]);
const UPCOMING = new Set<string>([ClassStatus.SCHEDULED, ClassStatus.LIVE]);

const byStart = (a: ProgressClass, b: ProgressClass) => a.startUTC.getTime() - b.startUTC.getTime();
const view = (c: ClassInput): ProgressClass => ({ publicId: c.publicId, status: c.status, startUTC: c.startUTC, endUTC: c.endUTC });

/**
 * Per-topic status for a course request. A topic is COMPLETED when it has at least
 * one counted class and all of them are COMPLETED (MISSED/FAILED count as not done).
 * Otherwise it's SCHEDULED if a class is upcoming (or LIVE), else NOT_SCHEDULED.
 * Classes not tagged to one of `topics` come back as `otherClasses`.
 */
export function computeTopicProgress(topics: TopicInput[], classes: ClassInput[], now: Date) {
  const counted = classes.filter((c) => !IGNORED.has(c.status));
  const topicIds = new Set(topics.map((t) => t.publicId));

  const result: TopicProgress[] = [...topics]
    .sort((a, b) => a.order - b.order)
    .map((topic) => {
      const own = counted.filter((c) => c.courseTopicPublicId === topic.publicId).map(view).sort(byStart);
      const next = own.find((c) => c.status === ClassStatus.LIVE || (UPCOMING.has(c.status) && c.startUTC >= now));
      const done = own.length > 0 && own.every((c) => c.status === ClassStatus.COMPLETED);
      return {
        ...topic,
        status: done ? 'COMPLETED' : next ? 'SCHEDULED' : 'NOT_SCHEDULED',
        ...(next && !done ? { nextClass: next } : {}),
        classes: own,
      };
    });

  const otherClasses = counted
    .filter((c) => !c.courseTopicPublicId || !topicIds.has(c.courseTopicPublicId))
    .map(view)
    .sort(byStart);

  return { topics: result, otherClasses };
}
