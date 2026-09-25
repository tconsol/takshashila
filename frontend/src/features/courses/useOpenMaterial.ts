// frontend/src/features/courses/useOpenMaterial.ts
import { useNavigate } from 'react-router-dom';
import { resourcesService } from '../../services/resources.service';
import { useToast } from '../../components/ui/Toast';
import type { StructureMaterial } from '../../services/courses.service';

type ViewerRole = 'STUDENT' | 'PARENT' | 'TUTOR' | 'ADMIN';

/** What clicking a material does, per role (curriculum-materials spec §7.3). */
export function useOpenMaterial(role: ViewerRole) {
  const navigate = useNavigate();
  const toast = useToast();

  return async (m: StructureMaterial) => {
    if (m.kind === 'resource') {
      // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
      const tab = window.open('', '_blank');
      try {
        const url = await resourcesService.getReadUrl(m.publicId);
        if (tab) tab.location.href = url; else window.location.href = url;
      } catch (err) {
        tab?.close();
        toast.error('Could not open file', (err as Error).message);
      }
      return;
    }
    if (role === 'ADMIN') return; // admins see titles only
    if (m.kind === 'worksheet') {
      if (role === 'STUDENT') navigate(`/dashboard/student/worksheets/${m.publicId}/test`);
      else if (role === 'TUTOR') navigate(`/dashboard/tutor/worksheets/${m.publicId}/results`);
      else navigate('/dashboard/parent/worksheets');
      return;
    }
    if (role === 'STUDENT') navigate(`/dashboard/student/assignments/${m.publicId}`);
    else if (role === 'TUTOR') navigate('/dashboard/tutor/assignments');
    else navigate('/dashboard/parent/assignments');
  };
}
