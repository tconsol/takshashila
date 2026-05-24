import { useState } from 'react';
import { Building2, GraduationCap, Users, Send, X, CheckCircle, ChevronRight, ArrowLeft, Star, BookOpen } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/Select';
import { useActivePrincipals, useTutorsByPrincipal, useRequestTutor, useParentChildren } from '../../hooks/use-parent';
import type { ActivePrincipal, TutorForParent } from '../../services/parent.service';
import type { ChildStudent } from '../../services/parent.service';

function PrincipalCard({
  principal,
  onSelect,
}: {
  principal: ActivePrincipal;
  onSelect: (p: ActivePrincipal) => void;
}) {
  return (
    <button
      className="w-full text-left rounded-[24px] border-2.5 border-clay-ink bg-white shadow-clay p-5 flex items-center gap-4 hover:translate-y-[-2px] transition-transform"
      onClick={() => onSelect(principal)}
    >
      <div className="w-12 h-12 rounded-[14px] border-2 border-clay-ink bg-clay-purple/30 flex items-center justify-center shrink-0">
        <Building2 className="h-6 w-6 text-clay-ink" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-extrabold text-clay-ink truncate">{principal.organizationName}</p>
        <p className="text-sm text-clay-ink/60">{principal.firstName} {principal.lastName}</p>
        <div className="flex gap-3 mt-1">
          <span className="text-xs text-clay-ink/50 flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />{principal.totalTutors ?? 0} tutors
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-clay-ink/40 shrink-0" />
    </button>
  );
}

function TutorRow({
  tutor,
  onRequest,
}: {
  tutor: TutorForParent;
  onRequest: (t: TutorForParent) => void;
}) {
  return (
    <div className="rounded-[18px] border-2 border-clay-ink bg-white shadow-clay-sm p-4 flex items-center gap-3">
      <Avatar name={tutor.displayName} size="md" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-clay-ink text-sm truncate">{tutor.displayName}</span>
          {tutor.isVerified && (
            <span className="text-[10px] font-bold bg-clay-mint/40 border border-clay-ink/30 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
              <CheckCircle className="h-2.5 w-2.5 text-clay-green" />Verified
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="flex items-center gap-0.5 text-xs text-clay-ink/60">
            <Star className="h-3 w-3 text-clay-yellow fill-clay-yellow" />{tutor.rating?.toFixed(1) ?? '—'}
          </span>
          <span className="text-xs text-clay-ink/60">
            ${((tutor.hourlyRateCents ?? 0) / 100).toFixed(0)}/hr
          </span>
        </div>
        {tutor.subjects?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {tutor.subjects.slice(0, 3).map((s) => (
              <span key={s} className="text-[10px] font-bold bg-clay-sky/30 border border-clay-ink/20 rounded-full px-1.5 py-0.5">{s}</span>
            ))}
          </div>
        )}
      </div>
      <Button
        size="sm"
        className="bg-clay-purple border-2 border-clay-ink shadow-clay-sm font-extrabold shrink-0"
        onClick={() => onRequest(tutor)}
      >
        <Send className="h-3.5 w-3.5 mr-1" />Request
      </Button>
    </div>
  );
}

function PrincipalTutorsPanel({
  principal,
  children,
  onBack,
}: {
  principal: ActivePrincipal;
  children: ChildStudent[];
  onBack: () => void;
}) {
  const [requestTarget, setRequestTarget] = useState<TutorForParent | null>(null);
  const { data: tutorsData, isLoading } = useTutorsByPrincipal(principal.publicId);
  const tutors = tutorsData?.items ?? [];

  return (
    <div className="space-y-4">
      <button
        className="flex items-center gap-2 text-sm font-extrabold text-clay-ink/70 hover:text-clay-ink"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />Back to Principals
      </button>

      <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-purple/20 shadow-clay p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-[14px] border-2 border-clay-ink bg-clay-purple/40 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-clay-ink" />
        </div>
        <div>
          <p className="font-extrabold text-clay-ink text-lg">{principal.organizationName}</p>
          <p className="text-sm text-clay-ink/60">{principal.firstName} {principal.lastName}</p>
        </div>
      </div>

      <p className="text-sm font-bold text-clay-ink/60 px-1">Tutors under this principal</p>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-[18px] border-2 border-clay-ink bg-clay-surface h-20 animate-pulse" />
          ))}
        </div>
      ) : tutors.length === 0 ? (
        <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-yellow/20 shadow-clay p-8 text-center">
          <GraduationCap className="h-8 w-8 mx-auto text-clay-ink/30 mb-2" />
          <p className="font-extrabold text-clay-ink/50">No tutors listed yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tutors.map((t) => (
            <TutorRow key={t.publicId} tutor={t} onRequest={setRequestTarget} />
          ))}
        </div>
      )}

      {requestTarget && (
        <RequestModal
          tutor={requestTarget}
          children={children}
          onClose={() => setRequestTarget(null)}
        />
      )}
    </div>
  );
}

function RequestModal({
  tutor,
  children,
  onClose,
}: {
  tutor: TutorForParent;
  children: ChildStudent[];
  onClose: () => void;
}) {
  const [selectedChild, setSelectedChild] = useState('');
  const [done, setDone] = useState(false);
  const { mutateAsync: requestTutor, isPending } = useRequestTutor();

  const handleSubmit = async () => {
    if (!selectedChild) return;
    await requestTutor({ studentPublicId: selectedChild, tutorPublicId: tutor.publicId });
    setDone(true);
  };

  return (
    <Modal isOpen onClose={onClose} title="Request Tutor for Child">
      {done ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-14 h-14 rounded-full bg-clay-mint/40 border-2 border-clay-ink flex items-center justify-center">
            <CheckCircle className="h-7 w-7 text-clay-green" />
          </div>
          <p className="font-extrabold text-clay-ink">Request sent!</p>
          <p className="text-sm text-clay-ink/60 text-center">The tutor will be notified and can approve your child.</p>
          <Button onClick={onClose} className="bg-clay-green border-2 border-clay-ink shadow-clay-sm font-extrabold">Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-[18px] border-2 border-clay-ink bg-clay-sky/20 p-4 flex items-center gap-3">
            <Avatar name={tutor.displayName} size="md" />
            <div>
              <p className="font-extrabold text-clay-ink">{tutor.displayName}</p>
              <p className="text-xs text-clay-ink/60">{tutor.subjects?.slice(0, 3).join(', ')}</p>
            </div>
          </div>

          <Select
            label="Select Child"
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            options={[
              { value: '', label: 'Pick a child…' },
              ...children.map((c) => ({ value: c.publicId, label: `${c.firstName} ${c.lastName}` })),
            ]}
          />

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-2 border-clay-ink" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />Cancel
            </Button>
            <Button
              className="flex-1 bg-clay-purple border-2 border-clay-ink shadow-clay-sm font-extrabold"
              disabled={!selectedChild || isPending}
              isLoading={isPending}
              onClick={handleSubmit}
            >
              <Send className="h-4 w-4 mr-1" />Send Request
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function ParentPrincipalsPage() {
  const [selectedPrincipal, setSelectedPrincipal] = useState<ActivePrincipal | null>(null);
  const { data: principalsData, isLoading } = useActivePrincipals();
  const { data: children = [] } = useParentChildren();
  const principals = principalsData?.items ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Find Principals"
        subtitle="Browse principals and request a tutor from their network for your child"
        icon={<Building2 className="h-6 w-6" />}
      />

      {selectedPrincipal ? (
        <PrincipalTutorsPanel
          principal={selectedPrincipal}
          children={children}
          onBack={() => setSelectedPrincipal(null)}
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-[24px] border-2.5 border-clay-ink bg-clay-surface shadow-clay h-24 animate-pulse" />
          ))}
        </div>
      ) : principals.length === 0 ? (
        <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-yellow/20 shadow-clay p-10 text-center">
          <Building2 className="h-10 w-10 mx-auto text-clay-ink/30 mb-3" />
          <p className="font-extrabold text-clay-ink/50">No principals available</p>
          <p className="text-sm text-clay-ink/40 mt-1">Check back later for registered principals</p>
        </div>
      ) : (
        <div className="space-y-3">
          {principals.map((p) => (
            <PrincipalCard key={p.publicId} principal={p} onSelect={setSelectedPrincipal} />
          ))}
        </div>
      )}
    </div>
  );
}
