import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { useLinkedParents, useParentLinkRequests } from '../../hooks/use-student-parent-requests';

export function StudentParentsPage() {
  const navigate = useNavigate();
  const { data: parents = [], isLoading } = useLinkedParents();
  const { data: pending = [] } = useParentLinkRequests();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Parents"
        subtitle="Parents linked to your account who can follow your progress"
        icon={<Users className="h-6 w-6" />}
        actions={
          <Button size="sm" variant="gradient" onClick={() => navigate('/dashboard/student/parents/requests')}>
            Pending requests{pending.length > 0 ? ` (${pending.length})` : ''}
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-slate-100 h-24 animate-pulse" />
          ))}
        </div>
      ) : parents.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto mb-4">
            <Users className="h-7 w-7 text-indigo-400" />
          </div>
          <p className="font-medium text-slate-700">No linked parents yet</p>
          <p className="text-sm text-slate-400 mt-1">Parents you accept will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parents.map((p) => {
            const name = `${p.firstName} ${p.lastName}`.trim() || 'Unknown';
            return (
              <div key={p.userPublicId} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4">
                <Avatar name={name} size="lg" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-base">{name}</p>
                  {p.email && <p className="text-sm text-slate-500 truncate">{p.email}</p>}
                </div>
                <Badge variant="success" tone="soft">Linked</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
