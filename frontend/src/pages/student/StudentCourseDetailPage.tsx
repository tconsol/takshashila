// frontend/src/pages/student/StudentCourseDetailPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckSquare, Square, BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useCourse } from '../../hooks/use-courses';
import { useCreateCourseRequest } from '../../hooks/use-course-requests';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StudentCourseDetailPage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(coursePublicId);
  const { mutate: createRequest, isPending } = useCreateCourseRequest();

  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [tutorPublicId, setTutorPublicId] = useState('');
  const [days, setDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [startLocalTime, setStartLocalTime] = useState('16:00');
  const [endLocalTime, setEndLocalTime] = useState('19:00');

  if (isLoading || !course) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleDay = (day: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const canSubmit = selectedTopics.size > 0 && tutorPublicId.trim().length > 0 && days.size > 0;

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Courses" title={course.title} description={`${course.subject} · ${course.grade}`} icon={<BookOpen className="h-5 w-5" />} />

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">Select the topics you want covered</p>
          <div className="space-y-2">
            {[...course.topics].sort((a, b) => a.order - b.order).map((topic) => (
              <button
                key={topic.publicId}
                type="button"
                onClick={() => toggleTopic(topic.publicId)}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-left hover:border-brand-300"
              >
                {selectedTopics.has(topic.publicId) ? (
                  <CheckSquare className="h-4 w-4 text-brand-600" />
                ) : (
                  <Square className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm text-gray-800 dark:text-gray-200">{topic.title}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">Tutor</p>
          <input
            value={tutorPublicId}
            onChange={(e) => setTutorPublicId(e.target.value)}
            placeholder="Paste tutor ID (from their profile page)"
            className="w-full rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900"
          />
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">When are you free?</p>
          <div className="flex gap-1.5 mb-3">
            {DAY_LABELS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(i)}
                className={`h-8 w-10 rounded-lg text-xs font-medium ${days.has(i) ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="time" value={startLocalTime} onChange={(e) => setStartLocalTime(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
            <span className="text-xs text-gray-400">to</span>
            <input type="time" value={endLocalTime} onChange={(e) => setEndLocalTime(e.target.value)} className="rounded-lg border border-gray-200 dark:border-gray-800 px-2 py-1.5 text-sm bg-white dark:bg-gray-900" />
          </div>
        </CardContent>
      </Card>

      <Button
        variant="gradient"
        disabled={!canSubmit}
        loading={isPending}
        onClick={() =>
          createRequest(
            {
              coursePublicId: course.publicId,
              selectedTopicPublicIds: [...selectedTopics],
              tutorPublicId: tutorPublicId.trim(),
              availabilityWindow: {
                daysOfWeek: [...days],
                startLocalTime,
                endLocalTime,
                ianaTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              },
            },
            { onSuccess: () => navigate('/dashboard/student/course-requests') },
          )
        }
      >
        Request this course
      </Button>
    </div>
  );
}
