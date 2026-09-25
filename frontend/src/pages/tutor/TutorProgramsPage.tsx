// frontend/src/pages/tutor/TutorProgramsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Plus, Eye, Archive, Trash2, Pencil } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { Tabs } from '../../components/ui/Tabs';
import { ProgramForm } from '../../features/programs/ProgramForm';
import { useMyPrograms, useSetProgramStatus, useDeleteProgram } from '../../hooks/use-programs';
import { categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';
import type { Program } from '../../services/programs.service';

const TABS = [
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'ARCHIVED', label: 'Archived' },
];

export function TutorProgramsPage() {
  const [tab, setTab] = useState('PUBLISHED');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const { data: programs = [], isLoading } = useMyPrograms();
  const { mutate: setStatus } = useSetProgramStatus();
  const { mutate: remove } = useDeleteProgram();
  const list = programs.filter((p) => p.status === tab);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Tutor Studio"
        title="Skill Programs"
        description="Your own programs outside the school curriculum — arts, games, coding, AI and more."
        icon={<Sparkles className="h-5 w-5" />}
        actions={<Button variant="gradient" onClick={() => { setEditing(null); setCreating(true); }}><Plus className="h-3.5 w-3.5" /> New program</Button>}
      />
      {creating && <ProgramForm onDone={() => setCreating(false)} />}
      {editing && <ProgramForm key={editing.publicId} program={editing} onDone={() => setEditing(null)} />}
      <Tabs className="mb-4" tabs={TABS} activeTab={tab} onChange={setTab} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : list.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No {tab.toLowerCase()} programs.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.publicId}>
              <CardContent>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link to={`/dashboard/tutor/programs/${p.publicId}`} className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">{p.title}</p>
                    <p className="text-xs text-gray-500">
                      {categoryLabel(p.category)} · {levelLabel(p.level)} · {p.sessionCount} sessions · {formatCurrency(p.priceCents)}
                      {' · '}{p.activeEnrollmentCount}{p.maxEnrollees ? `/${p.maxEnrollees}` : ''} active students
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    {p.isFull && <Badge variant="warning" tone="soft">Full</Badge>}
                    <Button size="sm" variant="outline" onClick={() => { setCreating(false); setEditing(p); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    {p.status !== 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus({ id: p.publicId, action: 'publish' })}><Eye className="h-3.5 w-3.5" /> Publish</Button>
                    )}
                    {p.status === 'PUBLISHED' && (
                      <Button size="sm" variant="outline" onClick={() => setStatus({ id: p.publicId, action: 'archive' })}><Archive className="h-3.5 w-3.5" /> Archive</Button>
                    )}
                    {p.activeEnrollmentCount === 0 && (
                      <Button size="sm" variant="outline" aria-label={`Delete ${p.title}`} onClick={() => remove(p.publicId)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
