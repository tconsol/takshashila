// frontend/src/pages/admin/AdminCurriculumStructurePage.tsx
//
// Admin/SuperAdmin view of a curriculum: topics with every attached material.
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { AddMaterialModal } from '../../features/courses/AdminMaterialForms';
import type { MaterialKind } from '../../services/curricula.service';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Loading';
import { useCurriculumStructure, useDeleteCurriculumMaterial } from '../../hooks/use-curricula';
import { CourseStructureTree } from '../../features/courses/CourseStructureTree';
import { useOpenMaterial } from '../../features/courses/useOpenMaterial';

export function AdminCurriculumStructurePage() {
  const { curriculumPublicId } = useParams<{ curriculumPublicId: string }>();
  const base = useLocation().pathname.startsWith('/dashboard/super-admin') ? '/dashboard/super-admin/curriculum' : '/dashboard/admin/curriculum';
  const { data, isLoading, isError } = useCurriculumStructure(curriculumPublicId ?? '');
  const openMaterial = useOpenMaterial('ADMIN');
  const [adding, setAdding] = useState<{ kind: MaterialKind; topicId: string } | null>(null);
  const { mutate: remove } = useDeleteCurriculumMaterial();

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
            renderTopicActions={(topic) => (
              <div className="flex flex-wrap gap-2">
                {(['resource', 'assignment', 'worksheet'] as const).map((kind) => (
                  <Button key={kind} size="sm" variant="outline" onClick={() => setAdding({ kind, topicId: topic.publicId })}>
                    <Plus className="h-3.5 w-3.5" /> Add {kind}
                  </Button>
                ))}
              </div>
            )}
            renderMaterialExtra={(m) => m.authorRole === 'ADMIN' && (
              <button
                type="button"
                aria-label={`Delete ${m.title}`}
                className="ml-auto text-gray-400 hover:text-red-500"
                onClick={(e) => { e.stopPropagation(); remove({ curriculumPublicId: data.curriculum.publicId, kind: m.kind, materialPublicId: m.publicId }); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          />
        </CardContent>
      </Card>
      {adding && (
        <AddMaterialModal
          curriculumPublicId={data.curriculum.publicId}
          topics={data.topics}
          initialTopicId={adding.topicId}
          kind={adding.kind}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}
