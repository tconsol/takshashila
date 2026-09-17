import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Star, MessageSquare, BookOpen, CheckCircle, Unlink, BadgeCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Spinner } from '../../components/ui/Loading';
import {
  useMyTutorLinks,
  useAcceptInvite,
  useDeclineInvite,
  useUnlinkTutor,
} from '../../hooks/use-students';
import { useStartConversation } from '../../features/chat/use-chat';
import { useNavigate } from 'react-router-dom';
import type { StudentTutorLink } from '../../services/students.service';

/**
 * A student can work with several tutors at once — one link each. Invites
 * waiting on the student are lifted to the top, because they are the only thing
 * on this page that needs a decision.
 */
export function StudentMyTutorPage() {
  const { data: links = [], isLoading } = useMyTutorLinks();
  const { mutate: acceptInvite, isPending: accepting } = useAcceptInvite();
  const { mutate: declineInvite, isPending: declining } = useDeclineInvite();
  const { mutate: unlinkTutor, isPending: unlinking } = useUnlinkTutor();
  const { mutateAsync: startConversation } = useStartConversation();
  const navigate = useNavigate();

  const [confirmUnlink, setConfirmUnlink] = useState<StudentTutorLink | null>(null);

  const invites = links.filter((l) => l.isPendingInvite);
  const active = links.filter((l) => !l.isPendingInvite && !!l.tutorPublicId);

  const message = async (link: StudentTutorLink) => {
    if (!link.tutorUserPublicId) return;
    const conv = await startConversation({
      recipientPublicId: link.tutorUserPublicId,
      recipientRole: 'TUTOR',
    });
    navigate(`/chat/${conv.publicId}`);
  };

  if (isLoading) {
    return <div className="flex justify-center py-24"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Tutors"
        subtitle={active.length > 0 ? `${active.length} connected` : 'Your connected tutors appear here'}
        icon={<GraduationCap className="h-5 w-5" />}
        actions={
          <Link to="/dashboard/student/tutors">
            <Button variant="outline" size="sm">
              <BookOpen className="h-4 w-4" /> Find tutors
            </Button>
          </Link>
        }
      />

      {invites.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="eyebrow">Invitations · {invites.length}</h2>
          {invites.map((link) => (
            <div
              key={link.studentProfilePublicId}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent-wash p-4"
            >
              <Avatar name={link.tutorName ?? 'Tutor'} src={link.tutorAvatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">
                  {link.tutorName ?? 'A tutor'} invited you
                </p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {link.subjects.length > 0 ? link.subjects.join(', ') : 'Accept to start booking classes'}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  loading={accepting}
                  onClick={() => acceptInvite(link.studentProfilePublicId)}
                >
                  <CheckCircle className="h-4 w-4" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={declining}
                  onClick={() => declineInvite(link.studentProfilePublicId)}
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {active.length === 0 && invites.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-8 w-8" />}
          title="No tutor connected yet"
          description="Browse tutors and request a demo class to get started."
          action={
            <Link to="/dashboard/student/tutors">
              <Button><BookOpen className="h-4 w-4" /> Browse tutors</Button>
            </Link>
          }
        />
      ) : (
        <section className="space-y-2.5">
          {active.length > 0 && <h2 className="eyebrow">Connected</h2>}
          <div className="grid gap-3 md:grid-cols-2">
            {active.map((link) => (
              <div
                key={link.studentProfilePublicId}
                className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={link.tutorName ?? 'Tutor'} src={link.tutorAvatarUrl} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-semibold text-ink">{link.tutorName ?? 'Tutor'}</p>
                      {link.isVerified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-ok" aria-label="Verified" />
                      )}
                      <Badge variant={link.status === 'ACTIVE' ? 'success' : 'default'} tone="soft">
                        {link.status}
                      </Badge>
                    </div>
                    {link.subjects.length > 0 && (
                      <p className="mt-1 truncate text-sm text-ink-muted">{link.subjects.join(', ')}</p>
                    )}
                    {link.rating > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {link.rating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => message(link)} disabled={!link.tutorUserPublicId}>
                    <MessageSquare className="h-4 w-4" /> Message
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-danger hover:bg-danger-wash"
                    onClick={() => setConfirmUnlink(link)}
                  >
                    <Unlink className="h-4 w-4" /> Unlink
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={!!confirmUnlink}
        onClose={() => setConfirmUnlink(null)}
        title="Unlink this tutor?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmUnlink(null)}>Keep tutor</Button>
            <Button
              variant="danger"
              loading={unlinking}
              onClick={() => {
                if (!confirmUnlink) return;
                unlinkTutor(confirmUnlink.studentProfilePublicId, {
                  onSuccess: () => setConfirmUnlink(null),
                });
              }}
            >
              <Unlink className="h-4 w-4" /> Unlink
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          You'll stop being {confirmUnlink?.tutorName ?? 'this tutor'}'s student and won't be able to
          book new classes with them. Classes already completed stay in your history, and your other
          tutors aren't affected. They can invite you again later.
        </p>
      </Modal>
    </div>
  );
}
