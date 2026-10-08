// frontend/src/pages/tutor/TutorNewProgramPage.tsx
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { ProgramForm } from '../../features/programs/ProgramForm';

export function TutorNewProgramPage() {
  const navigate = useNavigate();
  // New programs start as drafts, so land on the Drafts tab after saving.
  const toDrafts = () => navigate('/dashboard/tutor/programs?tab=DRAFT');
  const back = () => navigate('/dashboard/tutor/programs');

  return (
    <div className="animate-fade-in">
      <Link to="/dashboard/tutor/programs" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Skill Programs
      </Link>
      <PageHeader
        eyebrow="Tutor Studio"
        title="New skill program"
        description="Set up the program, its chapters and topics. It stays a draft until you publish it."
        icon={<Sparkles className="h-5 w-5" />}
      />
      <ProgramForm onDone={toDrafts} onCancel={back} />
    </div>
  );
}
