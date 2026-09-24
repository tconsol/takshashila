// frontend/src/pages/student/StudentCourseDetailPage.tsx
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckSquare, Square, BookOpen, Star, BadgeCheck, UserX } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useCourse, useCourseTutors } from '../../hooks/use-courses';
import { useCreateCourseRequest } from '../../hooks/use-course-requests';
import { formatCurrency } from '../../utils/currency';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StudentCourseDetailPage() {
  const { coursePublicId } = useParams<{ coursePublicId: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading } = useCourse(coursePublicId);
  const { data: tutors, isLoading: tutorsLoading } = useCourseTutors(coursePublicId);
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

  const canSubmit = selectedTopics.size > 0 && !!tutorPublicId && days.size > 0;

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
          <p className="text-sm font-semibold mb-3">Choose a tutor</p>
          {tutorsLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : !tutors || tutors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <UserX className="h-5 w-5 text-gray-400" />
              <p className="text-sm text-gray-500">No tutors teach {course.subject} for {course.grade} yet.</p>
            </div>
          ) : (
            <div role="radiogroup" aria-label="Tutor" className="grid gap-2 sm:grid-cols-2">
              {tutors.map((tutor) => {
                const selected = tutor.publicId === tutorPublicId;
                return (
                  <button
                    key={tutor.publicId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setTutorPublicId(tutor.publicId)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-gray-100 dark:border-gray-800 hover:border-brand-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {tutor.displayName}
                        {tutor.isVerified && <BadgeCheck className="h-3.5 w-3.5 text-brand-600" aria-label="Verified" />}
                      </span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(tutor.hourlyRateCents)}/hr
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {tutor.ratingCount > 0 ? `${tutor.rating.toFixed(1)} (${tutor.ratingCount})` : 'New'}
                    </p>
                    {tutor.bio && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{tutor.bio}</p>}
                  </button>
                );
              })}
            </div>
          )}
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
              tutorPublicId,
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
