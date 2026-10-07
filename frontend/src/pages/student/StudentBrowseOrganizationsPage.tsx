// frontend/src/pages/student/StudentBrowseOrganizationsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, GraduationCap, ChevronRight, ArrowLeft } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { useStudentPrincipal } from '../../hooks/use-students';
import { PrincipalTutorsPanel, useActivePrincipals, type ActivePrincipal } from '../../features/organizations/PrincipalTutorsPanel';

export function StudentBrowseOrganizationsPage() {
  const [selected, setSelected] = useState<ActivePrincipal | null>(null);
  const { data: myPrincipal } = useStudentPrincipal();
  const { data: principals = [], isLoading: listLoading } = useActivePrincipals();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Link to="/dashboard/student/my-organization" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-3.5 w-3.5" /> My organization
      </Link>
      <PageHeader
        title="Browse organizations"
        subtitle="All active organizations"
        icon={<Building2 className="h-6 w-6" />}
      />

      {selected ? (
        <PrincipalTutorsPanel principal={selected} onBack={() => setSelected(null)} />
      ) : listLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-100 h-24 animate-pulse" />
          ))}
        </div>
      ) : principals.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-amber-400 mb-3" />
          <p className="font-medium text-amber-700">No active organizations yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {principals.map((p) => {
            const isMine = myPrincipal?.publicId === p.publicId;
            return (
              <button
                key={p.publicId}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
                onClick={() => setSelected(p)}
              >
                <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 truncate">{p.organizationName}</p>
                    {isMine && <Badge variant="success" tone="soft">Mine</Badge>}
                  </div>
                  <p className="text-sm text-slate-500">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <GraduationCap className="h-3 w-3" />{p.totalTutors ?? 0} tutors
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
