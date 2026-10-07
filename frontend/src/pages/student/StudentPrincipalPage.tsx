import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useStudentPrincipal } from '../../hooks/use-students';
import { PrincipalTutorsPanel } from '../../features/organizations/PrincipalTutorsPanel';

export function StudentPrincipalPage() {
  const navigate = useNavigate();
  const { data: myPrincipal, isLoading } = useStudentPrincipal();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="My Organization"
        subtitle="Your current principal and the tutors under them"
        icon={<Building2 className="h-6 w-6" />}
        actions={<Button size="sm" variant="gradient" onClick={() => navigate('/dashboard/student/my-organization/browse')}>Browse organizations</Button>}
      />

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !myPrincipal ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-amber-400 mb-3" />
          <p className="font-medium text-amber-700">You're not part of an organization yet</p>
          <p className="mt-1 text-sm text-amber-600">Browse organizations to see who's available.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                {myPrincipal.organizationName && (
                  <p className="font-semibold text-slate-900 text-base">{myPrincipal.organizationName}</p>
                )}
                <p className="text-sm text-slate-500">Principal: {myPrincipal.firstName} {myPrincipal.lastName}</p>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
          </div>
          <PrincipalTutorsPanel
            hideHeader
            principal={{
              publicId: myPrincipal.publicId,
              userPublicId: '',
              organizationName: myPrincipal.organizationName ?? '',
              firstName: myPrincipal.firstName,
              lastName: myPrincipal.lastName,
              totalTutors: 0,
            }}
          />
        </>
      )}
    </div>
  );
}
