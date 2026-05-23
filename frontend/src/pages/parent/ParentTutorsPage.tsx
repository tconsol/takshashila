import { useState } from 'react';
import { Search, GraduationCap, Star, DollarSign, BookOpen, Send, X, CheckCircle } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useSearchTutors, useRequestTutor } from '../../hooks/use-parent';
import { useParentChildren } from '../../hooks/use-parent';
import type { TutorForParent } from '../../services/parent.service';
import type { ChildStudent } from '../../services/parent.service';

function TutorCard({
  tutor,
  onRequest,
}: {
  tutor: TutorForParent;
  onRequest: (tutor: TutorForParent) => void;
}) {
  return (
    <div className="rounded-[24px] border-2.5 border-clay-ink bg-white shadow-clay p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={tutor.displayName} size="lg" className="shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-clay-ink text-base truncate">{tutor.displayName}</span>
            {tutor.isVerified && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-clay-mint/40 border border-clay-ink/30 rounded-full px-2 py-0.5">
                <CheckCircle className="h-3 w-3 text-clay-green" /> Verified
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="h-3.5 w-3.5 text-clay-yellow fill-clay-yellow" />
            <span className="text-xs font-bold text-clay-ink/70">{tutor.rating?.toFixed(1) ?? '—'}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-extrabold text-clay-ink">
            ${((tutor.hourlyRateCents ?? 0) / 100).toFixed(0)}<span className="text-xs font-normal text-clay-ink/50">/hr</span>
          </div>
        </div>
      </div>

      {tutor.subjects?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tutor.subjects.slice(0, 4).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-[11px] font-bold bg-clay-sky/30 border border-clay-ink/20 rounded-full px-2 py-0.5">
              <BookOpen className="h-3 w-3" />{s}
            </span>
          ))}
          {tutor.subjects.length > 4 && (
            <span className="text-[11px] text-clay-ink/50">+{tutor.subjects.length - 4}</span>
          )}
        </div>
      )}

      <Button
        size="sm"
        className="w-full bg-clay-purple border-2 border-clay-ink shadow-clay-sm font-extrabold"
        onClick={() => onRequest(tutor)}
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        Request for My Child
      </Button>
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

export function ParentTutorsPage() {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [requestTarget, setRequestTarget] = useState<TutorForParent | null>(null);

  const params: Record<string, string> = {};
  if (search) params.q = search;
  if (subject) params.subject = subject;
  params.isVerified = 'true';
  params.limit = '20';

  const { data: tutorsData, isLoading } = useSearchTutors(params);
  const { data: children = [] } = useParentChildren();
  const tutors = tutorsData?.items ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Find Tutors"
        subtitle="Browse verified tutors and request one for your child"
        icon={<GraduationCap className="h-6 w-6" />}
      />

      {/* Search bar */}
      <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-surface shadow-clay p-4 flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
          className="flex-1"
        />
        <Input
          placeholder="Filter by subject…"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          leftIcon={<BookOpen className="h-4 w-4" />}
          className="flex-1"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-[24px] border-2.5 border-clay-ink bg-clay-surface shadow-clay h-44 animate-pulse" />
          ))}
        </div>
      ) : tutors.length === 0 ? (
        <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-yellow/20 shadow-clay p-10 text-center">
          <GraduationCap className="h-10 w-10 mx-auto text-clay-ink/30 mb-3" />
          <p className="font-extrabold text-clay-ink/50">No tutors found</p>
          <p className="text-sm text-clay-ink/40 mt-1">Try adjusting your search filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tutors.map((t) => (
            <TutorCard key={t.publicId} tutor={t} onRequest={setRequestTarget} />
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
