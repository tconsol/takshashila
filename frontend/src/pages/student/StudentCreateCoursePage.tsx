// frontend/src/pages/student/StudentCreateCoursePage.tsx
//
// Last step of "bundle chapters/topics into a course": shows the selection made on the curriculum
// page, then tutor + availability. Also used by parents (route has :studentPublicId), who request
// the course for one of their children.
import { useState } from 'react';
import { Link, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { BookOpen, Star, BadgeCheck, UserX } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useCurriculum, useCurriculumTutors } from '../../hooks/use-curricula';
import { useCreateCourse, useCreateCourseForChild } from '../../hooks/use-courses';
import { useTutorSlots } from '../../hooks/use-schedules';
import { formatInTimeZone } from 'date-fns-tz';
import { formatCurrency } from '../../utils/currency';
import type { CourseSelection } from '../../features/curriculum/CurriculumBrowser';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StudentCreateCoursePage() {
  const { curriculumPublicId, studentPublicId } = useParams<{ curriculumPublicId: string; studentPublicId?: string }>();
  const forChild = !!studentPublicId;
  const browseHref = forChild ? `/dashboard/parent/curriculum?child=${studentPublicId}` : '/dashboard/student/curriculum';
  const doneHref = forChild ? '/dashboard/parent/courses' : '/dashboard/student/courses';
  const navigate = useNavigate();
  const selection = useLocation().state as CourseSelection | null;
  const { data: curriculum, isLoading } = useCurriculum(curriculumPublicId);
  const { data: tutors, isLoading: tutorsLoading } = useCurriculumTutors(curriculumPublicId);
  const own = useCreateCourse();
  const forKid = useCreateCourseForChild();
  const isPending = forChild ? forKid.isPending : own.isPending;

  const [tutorPublicId, setTutorPublicId] = useState('');
  // Start with no day chosen: tapping a day switches it ON, which is what people expect.
  const [days, setDays] = useState<Set<number>>(new Set());
  const [startLocalTime, setStartLocalTime] = useState('16:00');
  const [endLocalTime, setEndLocalTime] = useState('19:00');
  const [pickedSlotId, setPickedSlotId] = useState('');
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data: tutorSlots = [], isLoading: slotsLoading } = useTutorSlots(tutorPublicId);
  const availableSlots = tutorSlots.filter((sl) => sl.status === 'AVAILABLE' && new Date(sl.startUTC) > new Date());

  // Opened without a selection (a bookmark, a refresh): go back and choose chapters/topics first.
  if (!selection || selection.curriculumPublicId !== curriculumPublicId || selection.chapterPublicIds.length === 0) {
    return <Navigate to={browseHref} replace />;
  }
  if (isLoading || !curriculum) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const toggleDay = (day: number) => {
    setDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  };

  const canSubmit = !!tutorPublicId && days.size > 0;

  const chosen = (curriculum.chapters?.length ? curriculum.chapters : curriculum.topics.map((t) => ({ ...t, topics: [] })))
    .filter((ch) => selection.chapterPublicIds.includes(ch.publicId))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Curriculum" title={curriculum.title} description={`${curriculum.subject} · ${curriculum.grade}`} icon={<BookOpen className="h-5 w-5" />} />

      <Card className="mb-4">
        <CardContent>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Your course</p>
            <Link to={browseHref} className="text-xs text-brand-600 hover:underline">Change selection</Link>
          </div>
          <ul className="space-y-2">
            {chosen.map((ch) => {
              const topics = ch.topics.filter((t) => selection.topicPublicIds.includes(t.publicId));
              return (
                <li key={ch.publicId} className="rounded-lg border border-rule p-3">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ch.title}</p>
                  {topics.length > 0 && (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-gray-600 dark:text-gray-400">
                      {topics.map((t) => <li key={t.publicId}>{t.title}</li>)}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-1">Choose a tutor</p>
          <p className="mb-3 text-xs text-gray-500">
            Every class is 60 minutes and costs the tutor's hourly rate shown below. The tutor decides how many classes your topics need,
            and the whole amount (rate × number of classes) is taken from {forChild ? "your child's" : 'your'} wallet when they accept. Free demo credits
            cannot be used for this. Nothing is charged until then.
          </p>
          {tutorsLoading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : !tutors || tutors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <UserX className="h-5 w-5 text-gray-400" />
              <p className="text-sm text-gray-500">No tutors teach {curriculum.subject} for {curriculum.grade} yet.</p>
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
                    onClick={() => { setTutorPublicId(tutor.publicId); setPickedSlotId(''); }}
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

      {tutorPublicId && (
        <Card className="mb-4">
          <CardContent>
            <p className="text-sm font-semibold mb-1">Tutor's available times</p>
            <p className="mb-3 text-xs text-gray-500">
              Pick a time that suits {forChild ? 'your child' : 'you'}; it fills in the free times below. If none suit, or there are none, propose your own times below.
            </p>
            {slotsLoading ? (
              <Spinner />
            ) : availableSlots.length === 0 ? (
              <p className="text-sm text-gray-500">This tutor has no open slots right now. Tell them when {forChild ? 'your child is' : 'you are'} free below.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSlots.slice(0, 24).map((sl) => {
                  const on = sl.publicId === pickedSlotId;
                  return (
                    <button
                      key={sl.publicId}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setPickedSlotId(sl.publicId);
                        setDays(new Set([Number(formatInTimeZone(new Date(sl.startUTC), userTz, 'i')) % 7]));
                        setStartLocalTime(formatInTimeZone(new Date(sl.startUTC), userTz, 'HH:mm'));
                        setEndLocalTime(formatInTimeZone(new Date(sl.endUTC), userTz, 'HH:mm'));
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'}`}
                    >
                      {formatInTimeZone(new Date(sl.startUTC), userTz, 'EEE MMM d, h:mm a')} – {formatInTimeZone(new Date(sl.endUTC), userTz, 'h:mm a')}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent>
          <p className="text-sm font-semibold mb-3">When {forChild ? 'is your child' : 'are you'} free? <span className="font-normal text-gray-500">(propose your own times if the tutor's don't suit)</span></p>
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
          <p className="mb-3 -mt-1 text-xs text-gray-500">
            {days.size === 0 ? 'Tap the available days (highlighted days are on).' : 'Highlighted days are the available ones.'}
          </p>
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
        onClick={() => {
          const dto = {
            curriculumPublicId: curriculum.publicId,
            topicPublicIds: selection.chapterPublicIds,
            pickedTopicPublicIds: selection.topicPublicIds,
            tutorPublicId,
            availabilityWindow: {
              daysOfWeek: [...days],
              startLocalTime,
              endLocalTime,
              ianaTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          };
          const onSuccess = () => navigate(doneHref);
          if (forChild) forKid.mutate({ studentPublicId: studentPublicId!, dto }, { onSuccess });
          else own.mutate(dto, { onSuccess });
        }}
      >
        Send course to tutor
      </Button>
    </div>
  );
}
