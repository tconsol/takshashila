// frontend/src/pages/admin/AdminProgramsPage.tsx
import { useState } from 'react';
import { Sparkles, EyeOff } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { useAdminPrograms, useUnpublishProgram } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

const TABS = [{ key: 'PUBLISHED', label: 'Published' }, { key: 'DRAFT', label: 'Drafts' }, { key: 'ARCHIVED', label: 'Archived' }];

export function AdminProgramsPage() {
  const [status, setStatus] = useState('PUBLISHED');
  const { data, isLoading } = useAdminPrograms({ status, limit: '50' });
  const { mutate: unpublish } = useUnpublishProgram();
  const programs = data?.items ?? [];
  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Platform" title="Skill Programs" description="Tutor-created extracurricular programs." icon={<Sparkles className="h-5 w-5" />} />
      <Tabs className="mb-4" tabs={TABS} activeTab={status} onChange={setStatus} />
      {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : programs.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No programs.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {programs.map((p) => (
            <Card key={p.publicId}>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-xs text-gray-500">{p.tutorName} · {categoryLabel(p.category)} · {levelLabel(p.level)} · {p.sessionCount} sessions · {formatCurrency(p.priceCents)} · {p.activeEnrollmentCount} active</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="soft" variant={p.status === 'PUBLISHED' ? 'success' : 'default'}>{p.status}</Badge>
                    {p.status === 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => unpublish(p.publicId)}><EyeOff className="h-3.5 w-3.5" /> Unpublish</Button>
                    )}
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
