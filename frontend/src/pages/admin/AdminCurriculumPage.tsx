// frontend/src/pages/admin/AdminCurriculumPage.tsx
import { useState } from 'react';
import { GraduationCap, Plus, Eye, EyeOff, Trash2, Save, AlertTriangle, MapPin, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useAdminCourses, useCreateCourse, usePublishCourse, useUpdateCourse, useDeleteCourse } from '../../hooks/use-courses';
import { Modal } from '../../components/ui/Modal';
import type { Course, CourseTopic } from '../../services/courses.service';
import type { Location } from '../../services/geo.service';
import { Select } from '../../components/ui/Select';
import { LocationSelect, EMPTY_LOCATION } from '../../components/shared/LocationSelect';
import { GRADE_OPTIONS } from '../../constants/grades';

type TopicDraft = Omit<CourseTopic, 'publicId'> & { publicId?: string };

const inputClass = 'rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900';

/** Create a course, or edit `course` when given. Existing topics keep their publicId and
 *  attached resources/assignments/worksheets, so renaming one doesn't detach its content. */
function CourseForm({ course, onDone }: { course?: Course; onDone: () => void }) {
  const { mutate: create, isPending: creating } = useCreateCourse();
  const { mutate: update, isPending: updating } = useUpdateCourse();
  const [location, setLocation] = useState<Location>(
    course
      ? { country: 'US', state: course.state ?? '', countyFips: course.countyFips ?? '', districtId: course.districtId ?? '' }
      : EMPTY_LOCATION,
  );
  const [grade, setGrade] = useState(course?.grade ?? 'Grade 8');
  const [subject, setSubject] = useState(course?.subject ?? '');
  const [title, setTitle] = useState(course?.title ?? '');
  const [description, setDescription] = useState(course?.description ?? '');
  const [topics, setTopics] = useState<TopicDraft[]>(
    course ? [...course.topics].sort((a, b) => a.order - b.order) : [],
  );

  const addTopic = () => setTopics((t) => [...t, { title: '', order: t.length, resourceIds: [], assignmentIds: [], worksheetIds: [] }]);
  const updateTopicTitle = (i: number, value: string) =>
    setTopics((t) => t.map((topic, idx) => (idx === i ? { ...topic, title: value } : topic)));
  const removeTopic = (i: number) => setTopics((t) => t.filter((_, idx) => idx !== i));

  const save = () => {
    const dto = {
      districtId: location.districtId,
      grade,
      subject,
      title,
      description: description || undefined,
      topics: topics.map((t, i) => ({ ...t, order: i })),
    };
    if (course) update({ coursePublicId: course.publicId, dto }, { onSuccess: onDone });
    else create(dto, { onSuccess: onDone });
  };

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3">
        {course && <p className="text-sm font-semibold text-gray-900 dark:text-white">Edit course</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <LocationSelect value={location} onChange={setLocation} requireDistrict />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Grade" options={GRADE_OPTIONS} value={grade} onChange={(e) => setGrade(e.target.value)} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputClass} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" className={inputClass} />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          maxLength={2000}
          className={`w-full ${inputClass}`}
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Topics (in order)</p>
          {topics.map((topic, i) => (
            <div key={topic.publicId ?? `new-${i}`} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
              <input value={topic.title} onChange={(e) => updateTopicTitle(i, e.target.value)} placeholder="Topic title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm bg-white dark:bg-gray-900" />
              <button onClick={() => removeTopic(i)} type="button" className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addTopic}><Plus className="h-3.5 w-3.5" /> Add topic</Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="gradient"
            loading={creating || updating}
            disabled={!location.districtId || !grade || !subject || !title || topics.some((t) => !t.title)}
            onClick={save}
          >
            <Save className="h-3.5 w-3.5" /> {course ? 'Save changes' : 'Save course'}
          </Button>
          <Button variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteCourseModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { mutate: remove, isPending } = useDeleteCourse();
  return (
    <Modal
      open
      onClose={onClose}
      title="Delete course?"
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={isPending} onClick={() => remove(course.publicId, { onSuccess: onClose })}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-semibold">{course.title}</span> will be removed from the catalog and this list.
        Courses with pending or accepted requests can't be deleted — unpublish them instead.
      </p>
    </Modal>
  );
}

/** For courses authored before districts existed (see migrate-course-districts.ts). */
function AssignDistrictModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { mutate: update, isPending } = useUpdateCourse();
  const [location, setLocation] = useState<Location>({
    country: 'US',
    state: course.state ?? '',
    countyFips: course.countyFips ?? '',
    districtId: '',
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign district — ${course.title}`}
      footer={
        <Button
          variant="gradient"
          loading={isPending}
          disabled={!location.districtId}
          onClick={() =>
            update({ coursePublicId: course.publicId, dto: { districtId: location.districtId } }, { onSuccess: onClose })
          }
        >
          <Save className="h-3.5 w-3.5" /> Save district
        </Button>
      }
    >
      <div className="grid gap-3">
        <LocationSelect value={location} onChange={setLocation} requireDistrict />
      </div>
    </Modal>
  );
}

export function AdminCurriculumPage() {
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<Location>(EMPTY_LOCATION);
  const [assigning, setAssigning] = useState<Course | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const params: Record<string, string> = { limit: '100' };
  if (filter.state) params.state = filter.state;
  if (filter.countyFips) params.countyFips = filter.countyFips;
  if (filter.districtId) params.districtId = filter.districtId;
  const { data, isLoading } = useAdminCourses(params);
  const { mutate: setPublished, isPending: publishing } = usePublishCourse();
  const courses = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Platform"
        title="Curriculum"
        description="Author curricula per US school district and grade for students to browse and request."
        icon={<GraduationCap className="h-5 w-5" />}
        actions={<Button variant="gradient" onClick={() => { setEditing(null); setShowNew((v) => !v); }}><Plus className="h-3.5 w-3.5" /> New course</Button>}
      />

      {showNew && <CourseForm onDone={() => setShowNew(false)} />}
      {editing && <CourseForm key={editing.publicId} course={editing} onDone={() => setEditing(null)} />}

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <LocationSelect value={filter} onChange={setFilter} />
      </div>
      {assigning && <AssignDistrictModal course={assigning} onClose={() => setAssigning(null)} />}
      {deleting && <DeleteCourseModal course={deleting} onClose={() => setDeleting(null)} />}

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Card key={course.publicId}>
              <CardContent>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-white">{course.title}</p>
                      {course.isPublished ? <Badge variant="success" tone="soft">Published</Badge> : <Badge variant="default" tone="soft">Draft</Badge>}
                      {!course.districtId && (
                        <Badge variant="warning" tone="soft"><AlertTriangle className="h-3 w-3" /> No district</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {course.district ? `${course.district} · ` : ''}{course.county ?? '—'}, {course.state ?? '—'} · {course.grade} · {course.subject} · {course.topics.length} topics
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!course.districtId && (
                      <Button size="sm" variant="outline" onClick={() => setAssigning(course)}>
                        <MapPin className="h-3.5 w-3.5" /> Assign district
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setEditing(course); }}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={publishing}
                      onClick={() => setPublished({ coursePublicId: course.publicId, publish: !course.isPublished })}
                    >
                      {course.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleting(course)} aria-label={`Delete ${course.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
