// frontend/src/pages/admin/AdminCurriculumStructurePage.tsx
//
// Admin/SuperAdmin view of a curriculum: topics with every attached material.
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useCurriculumStructure } from '../../hooks/use-curricula';
import { CourseStructureTree } from '../../features/courses/CourseStructureTree';
import { useOpenMaterial } from '../../features/courses/useOpenMaterial';

export function AdminCurriculumStructurePage() {
  const { curriculumPublicId } = useParams<{ curriculumPublicId: string }>();
  const base = useLocation().pathname.startsWith('/dashboard/super-admin') ? '/dashboard/super-admin/curriculum' : '/dashboard/admin/curriculum';
  const { data, isLoading, isError } = useCurriculumStructure(curriculumPublicId ?? '');
  const openMaterial = useOpenMaterial('ADMIN');

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (isError || !data) return <div className="py-16 text-center text-sm text-gray-500">Curriculum not found.</div>;

  return (
    <div className="animate-fade-in">
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> Curriculum
      </Link>
      <PageHeader
        eyebrow="Curriculum structure"
        title={data.curriculum.title}
        description={`${data.curriculum.subject} · ${data.curriculum.grade}${data.curriculum.district ? ` · ${data.curriculum.district}` : ''}`}
        icon={<GraduationCap className="h-5 w-5" />}
      />
      <Card>
        <CardContent>
          <CourseStructureTree
            topics={data.topics.map((t) => ({ ...t, classes: [] }))}
            otherClasses={[]}
            showStatus={false}
            hideClasses
            onOpenMaterial={openMaterial}
          />
        </CardContent>
      </Card>
    </div>
  );
}
