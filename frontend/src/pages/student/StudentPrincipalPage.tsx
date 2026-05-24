import { useState } from 'react';
import { Building2, GraduationCap, Users, ChevronRight, ArrowLeft, Star, Send, CheckCircle, MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/shared/PageHeader';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Loading';
import { useStudentPrincipal } from '../../hooks/use-students';

interface ActivePrincipal {
  publicId: string;
  userPublicId: string;
  organizationName: string;
  firstName: string;
  lastName: string;
  totalTutors: number;
}

interface TutorEntry {
  publicId: string;
  displayName: string;
  subjects: string[];
  rating: number;
  hourlyRateCents: number;
  isVerified: boolean;
}

function useActivePrincipals() {
  return useQuery({
    queryKey: ['student', 'activePrincipals'],
    queryFn: async () => {
      const { data } = await api.get('/principals/active', { params: { limit: '50' } });
      return (data?.data?.items ?? data?.items ?? []) as ActivePrincipal[];
    },
  });
}

function usePrincipalTutors(profilePublicId: string) {
  return useQuery({
    queryKey: ['student', 'principalTutors', profilePublicId],
    queryFn: async () => {
      const { data } = await api.get(`/tutors/parent/by-principal/${profilePublicId}`, { params: { limit: '50' } });
      return (data?.data?.items ?? []) as TutorEntry[];
    },
    enabled: !!profilePublicId,
  });
}

function PrincipalTutorsPanel({
  principal,
  onBack,
}: {
  principal: ActivePrincipal;
  onBack: () => void;
}) {
  const { data: tutors = [], isLoading } = usePrincipalTutors(principal.publicId);

  return (
    <div className="space-y-4">
      <button className="flex items-center gap-2 text-sm font-extrabold text-clay-ink/70 hover:text-clay-ink" onClick={onBack}>
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

      <p className="text-sm font-bold text-clay-ink/60 px-1">Tutors under this organization</p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : tutors.length === 0 ? (
        <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-yellow/20 shadow-clay p-8 text-center">
          <GraduationCap className="h-8 w-8 mx-auto text-clay-ink/30 mb-2" />
          <p className="font-extrabold text-clay-ink/50">No tutors listed yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tutors.map((t) => (
            <div key={t.publicId} className="rounded-[18px] border-2 border-clay-ink bg-white shadow-clay-sm p-4 flex items-center gap-3">
              <Avatar name={t.displayName} size="md" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-clay-ink text-sm truncate">{t.displayName}</span>
                  {t.isVerified && (
                    <span className="text-[10px] font-bold bg-clay-mint/40 border border-clay-ink/30 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                      <CheckCircle className="h-2.5 w-2.5 text-clay-green" />Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-0.5 text-xs text-clay-ink/60">
                    <Star className="h-3 w-3 text-clay-yellow fill-clay-yellow" />{t.rating?.toFixed(1) ?? '—'}
                  </span>
                  <span className="text-xs text-clay-ink/60">${((t.hourlyRateCents ?? 0) / 100).toFixed(0)}/hr</span>
                </div>
                {t.subjects?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.subjects.slice(0, 3).map((s) => (
                      <span key={s} className="text-[10px] font-bold bg-clay-sky/30 border border-clay-ink/20 rounded-full px-1.5 py-0.5">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <Link to="/dashboard/student/tutors">
                <Button size="sm" className="bg-clay-sky border-2 border-clay-ink shadow-clay-sm font-extrabold shrink-0">
                  <Send className="h-3.5 w-3.5 mr-1" />Request
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentPrincipalPage() {
  const [selected, setSelected] = useState<ActivePrincipal | null>(null);
  const { data: myPrincipal, isLoading: principalLoading } = useStudentPrincipal();
  const { data: principals = [], isLoading: listLoading } = useActivePrincipals();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="My Organization"
        subtitle="Your current principal and all active organizations"
        icon={<Building2 className="h-6 w-6" />}
      />

      {/* Current principal */}
      {!principalLoading && myPrincipal && (
        <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-mint/30 shadow-clay p-5">
          <p className="text-xs font-extrabold uppercase tracking-widest text-clay-green mb-3">My Organization</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-[14px] border-2 border-clay-ink bg-clay-purple/30 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-clay-ink" />
            </div>
            <div className="flex-1 min-w-0">
              {myPrincipal.organizationName && (
                <p className="font-extrabold text-clay-ink text-base">{myPrincipal.organizationName}</p>
              )}
              <p className="text-sm text-clay-ink/60">Principal: {myPrincipal.firstName} {myPrincipal.lastName}</p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        </div>
      )}

      {selected ? (
        <PrincipalTutorsPanel principal={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          <p className="text-sm font-extrabold text-clay-ink/50 uppercase tracking-widest">Browse Organizations</p>
          {listLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-[24px] border-2.5 border-clay-ink bg-clay-surface shadow-clay h-24 animate-pulse" />
              ))}
            </div>
          ) : principals.length === 0 ? (
            <div className="rounded-[24px] border-2.5 border-clay-ink bg-clay-yellow/20 shadow-clay p-10 text-center">
              <Building2 className="h-10 w-10 mx-auto text-clay-ink/30 mb-3" />
              <p className="font-extrabold text-clay-ink/50">No active organizations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {principals.map((p) => {
                const isMine = myPrincipal?.publicId === p.publicId;
                return (
                  <button
                    key={p.publicId}
                    className="w-full text-left rounded-[24px] border-2.5 border-clay-ink bg-white shadow-clay p-5 flex items-center gap-4 hover:translate-y-[-2px] transition-transform"
                    onClick={() => setSelected(p)}
                  >
                    <div className="w-12 h-12 rounded-[14px] border-2 border-clay-ink bg-clay-purple/30 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-clay-ink" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-clay-ink truncate">{p.organizationName}</p>
                        {isMine && <Badge variant="success" tone="soft">Mine</Badge>}
                      </div>
                      <p className="text-sm text-clay-ink/60">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-clay-ink/50 flex items-center gap-1 mt-0.5">
                        <GraduationCap className="h-3 w-3" />{p.totalTutors ?? 0} tutors
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-clay-ink/40 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
