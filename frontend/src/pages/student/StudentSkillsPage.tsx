// frontend/src/pages/student/StudentSkillsPage.tsx
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { MyProgramsSection } from '../../features/programs/MyProgramsSection';

export function StudentSkillsPage() {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Beyond school"
        title="My skill programs"
        description="Programs you're enrolled in: arts, music, chess, coding, AI and more."
        icon={<Sparkles className="h-5 w-5" />}
        actions={<Button size="sm" variant="gradient" onClick={() => navigate('/dashboard/student/skills/browse')}>Browse skills</Button>}
      />
      <MyProgramsSection showBrowseLink={false} />
    </div>
  );
}
