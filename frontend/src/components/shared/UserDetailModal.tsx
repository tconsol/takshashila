import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Loader2, Mail, Phone, Globe, CalendarDays, LogIn, Wallet as WalletIcon,
  ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { adminUsersService } from '../../services/admin-users.service';

interface UserDetailModalProps {
  publicId: string | null;
  onClose: () => void;
  onSuspend: (publicId: string) => void;
  onActivate: (publicId: string) => void;
  mutating?: boolean;
}

type StatusVariant = 'success' | 'danger' | 'warning' | 'default';

const STATUS_VARIANT: Record<string, StatusVariant> = {
  ACTIVE: 'success',
  SUSPENDED: 'danger',
  PENDING_VERIFICATION: 'warning',
  INACTIVE: 'default',
};

function money(cents: number, currency = 'USD') {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency });
}

/** Role profiles differ per role; surface the fields worth an admin's attention. */
const PROFILE_FIELDS: { key: string; label: string; format?: (v: unknown) => string }[] = [
  { key: 'status', label: 'Profile status' },
  { key: 'grade', label: 'Grade' },
  { key: 'organizationName', label: 'Organization' },
  { key: 'commissionRatePercent', label: 'Commission', format: (v) => `${v}%` },
  { key: 'hourlyRateCents', label: 'Hourly rate', format: (v) => money(Number(v)) },
  { key: 'trustScore', label: 'Trust score' },
  { key: 'rating', label: 'Rating' },
  { key: 'totalStudents', label: 'Total students' },
  { key: 'totalTutors', label: 'Total tutors' },
  { key: 'attendanceRate', label: 'Attendance rate', format: (v) => `${v}%` },
  { key: 'demoClassesUsed', label: 'Demo classes used' },
  { key: 'isVerified', label: 'Verified', format: (v) => (v ? 'Yes' : 'No') },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

export function UserDetailModal({ publicId, onClose, onSuspend, onActivate, mutating }: UserDetailModalProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user-detail', publicId],
    queryFn: () => adminUsersService.detail(publicId!),
    enabled: !!publicId,
  });

  const user = data?.user;
  const suspended = user?.status === 'SUSPENDED';

  return (
    <Modal
      open={!!publicId}
      onClose={onClose}
      size="xl"
      title="User Detail"
      footer={
        user && (
          <>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            {suspended ? (
              <Button variant="success" loading={mutating} onClick={() => onActivate(user.publicId)}>
                <ShieldCheck className="h-4 w-4" /> Activate
              </Button>
            ) : (
              <Button variant="danger" loading={mutating} onClick={() => onSuspend(user.publicId)}>
                <ShieldAlert className="h-4 w-4" /> Suspend
              </Button>
            )}
          </>
        )
      }
    >
      {isLoading && (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      )}

      {isError && (
        <p className="py-8 text-center text-sm text-rose-500">Could not load this user.</p>
      )}

      {data && user && (
        <div className="space-y-6">
          {/* Identity */}
          <div className="flex items-start gap-4">
            <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl} size="xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {user.firstName} {user.lastName}
                </h3>
                <Badge variant="brand" tone="soft">{user.role.replace('_', ' ')}</Badge>
                <Badge variant={STATUS_VARIANT[user.status] ?? 'default'} tone="soft">{user.status}</Badge>
                {!user.emailVerified && <Badge variant="warning" tone="soft">Email unverified</Badge>}
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1 text-sm text-slate-500 sm:grid-cols-2">
                <span className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5" /> {user.email}</span>
                {user.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {user.phone}</span>}
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> {user.timezone}</span>
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1.5">
                  <LogIn className="h-3.5 w-3.5" />
                  {user.lastLoginAt
                    ? `Last login ${format(new Date(user.lastLoginAt), 'MMM d, yyyy h:mm a')}`
                    : 'Never logged in'}
                  {` · ${user.loginCount} total`}
                </span>
                {user.studentId && <span className="flex items-center gap-1.5">ID {user.studentId}</span>}
              </div>
            </div>
          </div>

          {/* Activity */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Activity</h4>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Stat label="Classes" value={data.activity.classesTotal} />
              <Stat label="Completed" value={data.activity.classesCompleted} />
              <Stat label="Upcoming" value={data.activity.classesUpcoming} />
              <Stat label="Cancelled" value={data.activity.classesCancelled} />
              <Stat
                label="Attendance"
                value={data.activity.attendanceRate === null ? '—' : `${data.activity.attendanceRate}%`}
              />
              <Stat label="Tickets" value={data.activity.ticketsOpened} />
            </div>
          </div>

          {/* Wallet */}
          {data.wallet && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <WalletIcon className="h-3.5 w-3.5" /> Wallet
                {data.wallet.isLocked && <Badge variant="danger" tone="soft">Locked</Badge>}
              </h4>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label="Balance" value={money(data.wallet.balanceCents, data.wallet.currency)} />
                <Stat label="Purchased" value={money(data.wallet.purchasedCreditsCents, data.wallet.currency)} />
                <Stat label="Demo" value={money(data.wallet.demoCreditsCents, data.wallet.currency)} />
                <Stat label="Earned" value={money(data.wallet.earnedCreditsCents, data.wallet.currency)} />
              </div>
            </div>
          )}

          {/* Role profile */}
          {data.profile && (
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Role profile</h4>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {PROFILE_FIELDS.filter((f) => data.profile![f.key] !== undefined && data.profile![f.key] !== null).map((f) => (
                  <div key={f.key} className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-1.5 dark:border-slate-800">
                    <dt className="text-sm text-slate-500">{f.label}</dt>
                    <dd className="text-sm font-semibold text-slate-900 dark:text-white">
                      {f.format ? f.format(data.profile![f.key]) : String(data.profile![f.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Audit trail */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Recent audit trail</h4>
            {data.recentAudit.length > 0 ? (
              <div className="space-y-1.5">
                {data.recentAudit.map((e) => (
                  <div key={e.publicId} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{e.action}</p>
                      <p className="truncate text-xs text-slate-400">{e.resourceType} · by {e.actorRole}</p>
                    </div>
                    <span className="flex-shrink-0 text-xs text-slate-400">
                      {format(new Date(e.createdAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No audit events for this user.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
