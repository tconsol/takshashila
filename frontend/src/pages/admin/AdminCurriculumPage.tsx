// frontend/src/pages/admin/AdminCurriculumPage.tsx
import { useState } from 'react';
import { GraduationCap, Plus, Eye, EyeOff, Trash2, Save } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { useAdminCourses, useCreateCourse, usePublishCourse } from '../../hooks/use-courses';
import type { CourseTopic } from '../../services/courses.service';

function NewCourseForm({ onDone }: { onDone: () => void }) {
  const { mutate: create, isPending } = useCreateCourse();
  const [county, setCounty] = useState('');
  const [grade, setGrade] = useState('Grade 8');
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState<Array<Omit<CourseTopic, 'publicId'>>>([]);

  const addTopic = () => setTopics((t) => [...t, { title: '', order: t.length, resourceIds: [], assignmentIds: [], worksheetIds: [] }]);
  const updateTopicTitle = (i: number, value: string) =>
    setTopics((t) => t.map((topic, idx) => (idx === i ? { ...topic, title: value } : topic)));
  const removeTopic = (i: number) => setTopics((t) => t.filter((_, idx) => idx !== i));

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="County" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
          <input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Grade (e.g. Grade 8)" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Course title" className="rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm bg-white dark:bg-gray-900" />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Topics (in order)</p>
          {topics.map((topic, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6">{i + 1}.</span>
              <input value={topic.title} onChange={(e) => updateTopicTitle(i, e.target.value)} placeholder="Topic title" className="flex-1 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-1.5 text-sm bg-white dark:bg-gray-900" />
              <button onClick={() => removeTopic(i)} type="button" className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addTopic}><Plus className="h-3.5 w-3.5" /> Add topic</Button>
        </div>

        <Button
          variant="gradient"
          loading={isPending}
          disabled={!county || !grade || !subject || !title || topics.some((t) => !t.title)}
          onClick={() =>
            create(
              { county, grade, subject, title, topics: topics.map((t, i) => ({ ...t, order: i })) },
              { onSuccess: onDone },
            )
          }
        >
          <Save className="h-3.5 w-3.5" /> Save course
        </Button>
      </CardContent>
    </Card>
  );
}

export function AdminCurriculumPage() {
  const [showNew, setShowNew] = useState(false);
  const { data, isLoading } = useAdminCourses({ limit: '100' });
  const { mutate: setPublished, isPending: publishing } = usePublishCourse();
  const courses = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Platform"
        title="Curriculum"
        description="Author county+grade curricula for students to browse and request."
        icon={<GraduationCap className="h-5 w-5" />}
        actions={<Button variant="gradient" onClick={() => setShowNew((v) => !v)}><Plus className="h-3.5 w-3.5" /> New course</Button>}
      />

      {showNew && <NewCourseForm onDone={() => setShowNew(false)} />}

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
                    </div>
                    <p className="text-xs text-gray-500">{course.county} · {course.grade} · {course.subject} · {course.topics.length} topics</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={publishing}
                    onClick={() => setPublished({ coursePublicId: course.publicId, publish: !course.isPublished })}
                  >
                    {course.isPublished ? <><EyeOff className="h-3.5 w-3.5" /> Unpublish</> : <><Eye className="h-3.5 w-3.5" /> Publish</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
