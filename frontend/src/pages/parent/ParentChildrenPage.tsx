import { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Trash2, ArrowUpRight, Users } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Loading';
import { EmptyState } from '../../components/shared/EmptyState';
import { useParentChildren, useLinkChild, useUnlinkChild } from '../../hooks/use-parent';

const statusColors: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  ACTIVE: 'success',
  PENDING_APPROVAL: 'warning',
  INVITED: 'info' as 'default',
  INACTIVE: 'default',
  SUSPENDED: 'danger',
};

export function ParentChildrenPage() {
  const [showLink, setShowLink] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const { data: children = [], isLoading } = useParentChildren();
  const { mutateAsync: linkChild, isPending: linking } = useLinkChild();
  const { mutateAsync: unlinkChild, isPending: unlinking } = useUnlinkChild();

  const handleLink = async () => {
    setLinkError(null);
    if (!studentId.trim()) { setLinkError('Please enter a Student ID'); return; }
    try {
      await linkChild(studentId.trim());
      setStudentId('');
      setShowLink(false);
    } catch (e: unknown) {
      setLinkError(e instanceof Error ? (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? e.message : 'Failed to link child');
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    try {
      await unlinkChild(confirmRemove);
    } finally {
      setConfirmRemove(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="My Children"
          subtitle={`${children.length} child${children.length !== 1 ? 'ren' : ''} linked to your account`}
        />
        <Button onClick={() => setShowLink(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" /> Add Child
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : children.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No children linked"
          description="Ask your child's tutor for their Student ID, then add it here to start monitoring their progress."
          action={
            <Button onClick={() => setShowLink(true)} variant="gradient">
              <UserPlus className="h-4 w-4 mr-1.5" /> Add Child
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => {
            const fullName = `${child.firstName} ${child.lastName}`.trim() || 'Student';
            return (
            <div key={child.publicId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={fullName} size="md" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {fullName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {child.grade ?? '—'}
                    </p>
                  </div>
                </div>
                <Badge variant={statusColors[child.status] ?? 'default'}>{child.status.replace('_', ' ')}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 py-2">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{child.attendanceRate}%</p>
                  <p className="text-[10px] text-gray-500">Attendance</p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 py-2">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{child.totalClassesAttended}</p>
                  <p className="text-[10px] text-gray-500">Classes</p>
                </div>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
                <Link to={`/dashboard/parent/children/${child.publicId}`} className="flex-1">
                  <Button size="sm" variant="secondary" fullWidth>
                    View <ArrowUpRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmRemove(child.publicId)}
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );})}
        </div>
      )}

      {/* Link child modal */}
      <Modal
        open={showLink}
        onClose={() => { setShowLink(false); setLinkError(null); setStudentId(''); }}
        title="Add Child"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowLink(false)}>Cancel</Button>
            <Button onClick={handleLink} loading={linking}>Link Child</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter your child's <strong>Student Public ID</strong>. Ask their tutor or check the student's profile to find it.
          </p>
          <Input
            label="Student ID"
            placeholder="e.g. 3f9a2b1c-..."
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            error={linkError ?? undefined}
          />
        </div>
      </Modal>

      {/* Confirm remove modal */}
      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove Child"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="outline" onClick={handleRemove} loading={unlinking} className="text-red-600 border-red-300 hover:bg-red-50">
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to remove this child from your account? You can re-link them later using their Student ID.
        </p>
      </Modal>
    </div>
  );
}
