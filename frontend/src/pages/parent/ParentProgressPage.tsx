import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Users, CheckCircle2, XCircle, BookOpen, GraduationCap } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatsCard } from '../../components/shared/StatsCard';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import { useParentChildren, useChildAttendance, useChildAssignments } from '../../hooks/use-parent';
import { cn } from '../../lib/utils';

export function ParentProgressPage() {
  const { data: children = [], isLoading: childrenLoading } = useParentChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && children.length > 0) setSelectedId(children[0].publicId);
  }, [children, selectedId]);

  const { data: attData, isLoading: attLoading } = useChildAttendance(selectedId ?? '', { limit: '200' });
  const { data: assignments = [], isLoading: assLoading } = useChildAssignments(selectedId ?? '');
  const selectedChild = children.find((c) => c.publicId === selectedId);

  const attItems = attData?.items ?? [];
  const present = attItems.filter((a) => a.status === 'PRESENT' || a.status === 'PARTIAL').length;
  const absent = attItems.filter((a) => a.status === 'ABSENT').length;
  const attRate = selectedChild?.attendanceRate ?? (attItems.length > 0 ? Math.round((present / attItems.length) * 100) : 0);

  const totalAssignments = assignments.length;
  const submitted = assignments.filter((a) => a.submission?.status === 'SUBMITTED' || a.submission?.status === 'GRADED').length;
  const graded = assignments.filter((a) => a.submission?.status === 'GRADED').length;
  const avgScore = graded > 0
    ? Math.round(
        assignments
          .filter((a) => a.submission?.score !== undefined)
          .reduce((sum, a) => sum + (a.submission!.score! / a.maxScore) * 100, 0) / graded,
      )
    : null;

  const isLoading = attLoading || assLoading;

  if (childrenLoading) return <div className="flex justify-center py-20"><Spinner /></div>;

  if (children.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="No children linked"
        description="Add your child's Student ID to track their progress."
        action={<Link to="/dashboard/parent/children"><Button variant="gradient"><Users className="h-4 w-4 mr-1.5" /> My Children</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress"
        subtitle={selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}`.trim() : 'Loading…'}
        icon={<BarChart3 className="h-5 w-5" />}
      />

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((child) => {
            const name = `${child.firstName} ${child.lastName}`.trim();
            return (
              <button
                key={child.publicId}
                onClick={() => setSelectedId(child.publicId)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                  selectedId === child.publicId
                    ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-900/20 dark:text-brand-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                )}
              >
                <Avatar name={name} size="xs" />
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Attendance Rate"
          value={isLoading ? '—' : `${attRate}%`}
          icon={<BarChart3 className="h-5 w-5 text-brand-600" />}
          change={attRate >= 75 ? { value: 'Good standing', positive: true } : { value: 'Needs improvement', positive: false }}
        />
        <StatsCard
          title="Classes Attended"
          value={isLoading ? '—' : (selectedChild?.totalClassesAttended ?? present)}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50 dark:bg-green-900/20"
        />
        <StatsCard
          title="Classes Missed"
          value={isLoading ? '—' : (selectedChild?.totalClassesMissed ?? absent)}
          icon={<XCircle className="h-5 w-5 text-red-500" />}
          iconBg="bg-red-50 dark:bg-red-900/20"
        />
        <StatsCard
          title="Assignments"
          value={isLoading ? '—' : `${submitted}/${totalAssignments}`}
          icon={<BookOpen className="h-5 w-5 text-violet-600" />}
          iconBg="bg-violet-50 dark:bg-violet-900/20"
          change={totalAssignments > 0 ? { value: `${Math.round((submitted / totalAssignments) * 100)}% submitted`, positive: submitted / totalAssignments >= 0.7 } : undefined}
        />
      </div>

      {/* Attendance progress bar */}
      {!isLoading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Attendance Standing</span>
            <span className={`font-semibold ${attRate >= 75 ? 'text-green-600 dark:text-green-400' : attRate >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
              {attRate}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${attRate >= 75 ? 'bg-green-500' : attRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(attRate, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">75% minimum required for good standing</p>
        </div>
      )}

      {/* Assignment summary */}
      {!isLoading && totalAssignments > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-4 w-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Assignment Overview</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 py-3">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalAssignments}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total</p>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 py-3">
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{submitted}</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">Submitted</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 py-3">
              <p className="text-xl font-bold text-green-700 dark:text-green-400">{graded}</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Graded</p>
            </div>
            <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 py-3">
              <p className="text-xl font-bold text-violet-700 dark:text-violet-400">{avgScore !== null ? `${avgScore}%` : '—'}</p>
              <p className="text-xs text-violet-600 dark:text-violet-500 mt-0.5">Avg Score</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
