import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FileText, ClipboardList, Users, Calendar, Trophy,
  GraduationCap, Search, BookOpen,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Avatar } from '../../components/ui/Avatar';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { worksheetsService } from '../../services/worksheets.service';
import { assignmentsService } from '../../services/assignments.service';

const TYPE_TABS = [
  { key: 'WORKSHEET', label: 'Worksheets' },
  { key: 'ASSIGNMENT', label: 'Assignments' },
];

function WorksheetRow({
  w,
}: {
  w: { publicId: string; title: string; subject?: string; type: string; dueDate?: string; questions: unknown[]; isFileAttachment?: boolean; fileOriginalName?: string; assignedToStudentPublicIds: string[]; createdAt: string; tutorName: string; submissionCount: number };
}) {
  const isPast = w.type === 'ASSIGNMENT' && w.dueDate && new Date(w.dueDate) < new Date();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-start gap-3">
        <Avatar name={w.tutorName} size="sm" className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 truncate">{w.title}</p>
            {w.subject && <Badge variant="info">{w.subject}</Badge>}
            {w.type === 'ASSIGNMENT' && (
              <Badge variant={isPast ? 'danger' : 'warning'}>{isPast ? 'Past Due' : 'Active'}</Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-indigo-600 font-medium">
              <GraduationCap className="h-3.5 w-3.5" />{w.tutorName}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {w.isFileAttachment ? (w.fileOriginalName ?? 'File') : `${w.questions.length} questions`}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {w.assignedToStudentPublicIds.length === 0 ? 'All students' : `${w.assignedToStudentPublicIds.length} students`}
            </span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <Trophy className="h-3 w-3" />{w.submissionCount} submissions
            </span>
            {w.dueDate && (
              <span className={`flex items-center gap-1 ${isPast ? 'text-rose-500' : ''}`}>
                <Calendar className="h-3 w-3" />Due {format(new Date(w.dueDate), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">Created {format(new Date(w.createdAt), 'MMM d, yyyy')}</p>
        </div>
      </div>
    </div>
  );
}

function AssignmentRow({
  a,
}: {
  a: { publicId: string; title: string; description: string; dueDate: string; maxScore: number; status: string; isFileAttachment?: boolean; fileOriginalName?: string; createdAt: string; tutorName: string; submissionCount: number };
}) {
  const isPast = new Date(a.dueDate) < new Date();
  const statusVariant: Record<string, 'default' | 'info' | 'success'> = { DRAFT: 'default', PUBLISHED: 'info', CLOSED: 'success' };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-900 truncate">{a.title}</p>
            <Badge variant={statusVariant[a.status] ?? 'default'}>{a.status}</Badge>
            {a.isFileAttachment && <Badge variant="info">File: {a.fileOriginalName}</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500 line-clamp-2">{a.description}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-indigo-600 font-medium">
              <GraduationCap className="h-3.5 w-3.5" />{a.tutorName}
            </span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <Trophy className="h-3 w-3" />{a.submissionCount} submissions
            </span>
            <span className={`flex items-center gap-1 ${isPast ? 'text-rose-500' : ''}`}>
              <Calendar className="h-3 w-3" />Due {format(new Date(a.dueDate), 'MMM d, yyyy')}
            </span>
            <span>Max score: {a.maxScore}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrincipalContentPage() {
  const [activeType, setActiveType] = useState<'WORKSHEET' | 'ASSIGNMENT'>('WORKSHEET');
  const [search, setSearch] = useState('');

  const { data: worksheetData, isLoading: wsLoading } = useQuery({
    queryKey: ['principal', 'worksheets', activeType],
    queryFn: () => worksheetsService.getAsPrincipal({ type: activeType, limit: '200' }),
    enabled: activeType === 'WORKSHEET',
  });

  const { data: assignments = [], isLoading: aLoading } = useQuery({
    queryKey: ['principal', 'assignments'],
    queryFn: () => assignmentsService.getAsPrincipal({}),
    enabled: activeType === 'ASSIGNMENT',
  });

  const worksheets = worksheetData?.items ?? [];
  const q = search.toLowerCase().trim();

  const filteredWorksheets = q
    ? worksheets.filter((w) => w.title.toLowerCase().includes(q) || w.tutorName.toLowerCase().includes(q) || (w.subject ?? '').toLowerCase().includes(q))
    : worksheets;

  const filteredAssignments = q
    ? assignments.filter((a) => a.title.toLowerCase().includes(q) || a.tutorName.toLowerCase().includes(q))
    : assignments;

  const isLoading = activeType === 'WORKSHEET' ? wsLoading : aLoading;
  const isEmpty = activeType === 'WORKSHEET' ? filteredWorksheets.length === 0 : filteredAssignments.length === 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Tutor Content"
        subtitle="Worksheets and assignments created by your tutors"
        icon={<ClipboardList className="h-6 w-6" />}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs tabs={TYPE_TABS} activeTab={activeType} onChange={(k) => setActiveType(k as 'WORKSHEET' | 'ASSIGNMENT')} />
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-300 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-colors sm:w-72">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by title, tutor or subject…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : isEmpty ? (
        <EmptyState
          icon={activeType === 'WORKSHEET' ? <BookOpen className="h-8 w-8" /> : <ClipboardList className="h-8 w-8" />}
          title={`No ${activeType === 'WORKSHEET' ? 'worksheets' : 'assignments'} yet`}
          description={`When your tutors create ${activeType === 'WORKSHEET' ? 'worksheets' : 'assignments'}, they will appear here.`}
        />
      ) : activeType === 'WORKSHEET' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredWorksheets.map((w) => (
            <WorksheetRow key={w.publicId} w={w} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredAssignments.map((a) => (
            <AssignmentRow key={a.publicId} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
