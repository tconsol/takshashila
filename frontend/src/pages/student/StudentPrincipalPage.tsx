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
      <button className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />Back to Principals
      </button>

      <div className="rounded-2xl border border-slate-200 bg-violet-50 p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0">
          <Building2 className="h-6 w-6 text-violet-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-lg">{principal.organizationName}</p>
          <p className="text-sm text-slate-500">{principal.firstName} {principal.lastName}</p>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-500 px-1">Tutors under this organization</p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : tutors.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <GraduationCap className="h-8 w-8 mx-auto text-amber-400 mb-2" />
          <p className="font-medium text-amber-700">No tutors listed yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tutors.map((t) => (
            <div key={t.publicId} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex items-center gap-3">
              <Avatar name={t.displayName} size="md" className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 text-sm truncate">{t.displayName}</span>
                  {t.isVerified && (
                    <span className="text-[10px] font-medium bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 text-emerald-700">
                      <CheckCircle className="h-2.5 w-2.5" />Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-0.5 text-xs text-slate-500">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />{t.rating?.toFixed(1) ?? '—'}
                  </span>
                  <span className="text-xs text-slate-500">${((t.hourlyRateCents ?? 0) / 100).toFixed(0)}/hr</span>
                </div>
                {t.subjects?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.subjects.slice(0, 3).map((s) => (
                      <span key={s} className="text-[10px] font-medium bg-sky-50 border border-sky-200 rounded-full px-1.5 py-0.5 text-sky-700">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <Link to="/dashboard/student/tutors">
                <Button size="sm">
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
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 mb-3">My Organization</p>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              {myPrincipal.organizationName && (
                <p className="font-semibold text-slate-900 text-base">{myPrincipal.organizationName}</p>
              )}
              <p className="text-sm text-slate-500">Principal: {myPrincipal.firstName} {myPrincipal.lastName}</p>
            </div>
            <Badge variant="success">Connected</Badge>
          </div>
        </div>
      )}

      {selected ? (
        <PrincipalTutorsPanel principal={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Browse Organizations</p>
          {listLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-100 h-24 animate-pulse" />
              ))}
            </div>
          ) : principals.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
              <Building2 className="h-10 w-10 mx-auto text-amber-400 mb-3" />
              <p className="font-medium text-amber-700">No active organizations yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {principals.map((p) => {
                const isMine = myPrincipal?.publicId === p.publicId;
                return (
                  <button
                    key={p.publicId}
                    className="w-full text-left rounded-2xl border border-slate-200 bg-white shadow-sm p-5 flex items-center gap-4 hover:-translate-y-0.5 transition-transform"
                    onClick={() => setSelected(p)}
                  >
                    <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
                      <Building2 className="h-6 w-6 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-800 truncate">{p.organizationName}</p>
                        {isMine && <Badge variant="success" tone="soft">Mine</Badge>}
                      </div>
                      <p className="text-sm text-slate-500">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <GraduationCap className="h-3 w-3" />{p.totalTutors ?? 0} tutors
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" />
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
