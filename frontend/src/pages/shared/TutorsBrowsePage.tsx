import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, Star, Award, Languages, Clock, Filter, ArrowRight,
  GraduationCap, ShieldCheck, Sparkles, BookOpen,
} from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Loading';
import { BookClassModal } from '../../components/shared/BookClassModal';
import type { TutorProfile } from '../../services/tutors.service';

interface TutorListing {
  publicId: string;
  userPublicId: string;
  displayName?: string;
  subjects: string[];
  languages: string[];
  hourlyRateCents: number;
  bio?: string;
  qualifications: string[];
  rating: number;
  ratingCount: number;
  totalStudents: number;
  totalClassesCompleted: number;
  isVerified: boolean;
  status: string;
  timezone?: string;
}

function listingToProfile(t: TutorListing): TutorProfile {
  return {
    publicId: t.publicId,
    userPublicId: t.userPublicId,
    displayName: t.displayName ?? `Tutor ${t.publicId.slice(0, 6)}`,
    bio: t.bio,
    subjects: t.subjects,
    status: t.status,
    isVerified: t.isVerified,
    rating: t.rating,
    totalStudents: t.totalStudents,
    totalClassesCompleted: t.totalClassesCompleted,
    commissionRatePercent: 0,
    trustScore: 0,
    createdAt: '',
  };
}

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'History', 'Economics'];
const PRICE_BUCKETS: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Any price' },
  { label: 'Under ₹500/hr', max: 50000 },
  { label: '₹500–1,000/hr', min: 50000, max: 100000 },
  { label: '₹1,000–2,000/hr', min: 100000, max: 200000 },
  { label: 'Over ₹2,000/hr', min: 200000 },
];

const formatINR = (cents: number) =>
  cents > 0 ? `₹${(cents / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Free intro';

interface TutorsBrowsePageProps {
  variant?: 'public' | 'student';
}

export function TutorsBrowsePage({ variant = 'public' }: TutorsBrowsePageProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<string>('');
  const [priceIdx, setPriceIdx] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [bookingTutor, setBookingTutor] = useState<TutorListing | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tutors', 'search', { subject, minRating, priceIdx }],
    queryFn: async () => {
      const params: Record<string, unknown> = { limit: 24 };
      if (subject) params.subject = subject;
      if (minRating > 0) params.minRating = minRating;
      const bucket = PRICE_BUCKETS[priceIdx];
      if (bucket.max !== undefined) params.maxHourlyRateCents = bucket.max;
      const { data } = await api.get('/tutors/search', { params });
      return data?.data ?? { items: [], total: 0 };
    },
  });

  const tutors: TutorListing[] = data?.items ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return tutors;
    const q = search.toLowerCase();
    return tutors.filter((t) =>
      t.subjects.some((s) => s.toLowerCase().includes(q)) ||
      t.bio?.toLowerCase().includes(q) ||
      t.qualifications.some((qq) => qq.toLowerCase().includes(q)),
    );
  }, [tutors, search]);

  const handleBookDemo = (tutor: TutorListing) => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=/tutors`);
      return;
    }
    if (user?.role !== 'STUDENT') {
      navigate('/');
      return;
    }
    setBookingTutor(tutor);
  };

  const isPublic = variant === 'public';

  return (
    <>
    <div className={isPublic ? 'min-h-screen bg-gradient-to-br from-brand-50/30 via-white to-violet-50/20' : ''}>
      {isPublic && <PublicNav />}

      <div className={isPublic ? 'mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8' : ''}>
        <PageHeader
          eyebrow={isPublic ? 'Browse the marketplace' : 'Find your tutor'}
          title="Expert tutors, ready to teach"
          description="Filter by subject, price and rating. Watch demos, then book a 1-on-1 class."
          icon={<GraduationCap className="h-5 w-5" />}
        />

        {/* Filters */}
        <Card padding="md" tone="soft" className="mb-6">
          <div className="grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Subject, name, or qualification…"
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">All subjects</option>
                {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Price</label>
              <select
                value={priceIdx}
                onChange={(e) => setPriceIdx(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {PRICE_BUCKETS.map((b, i) => <option key={b.label} value={i}>{b.label}</option>)}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">Min rating</label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value={0}>Any</option>
                <option value={3}>★ 3+</option>
                <option value={4}>★ 4+</option>
                <option value={4.5}>★ 4.5+</option>
              </select>
            </div>
          </div>

          {(subject || priceIdx > 0 || minRating > 0 || search) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200/70 pt-3 dark:border-gray-800">
              <Filter className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Active filters:</span>
              {search && <Chip onClear={() => setSearch('')}>"{search}"</Chip>}
              {subject && <Chip onClear={() => setSubject('')}>{subject}</Chip>}
              {priceIdx > 0 && <Chip onClear={() => setPriceIdx(0)}>{PRICE_BUCKETS[priceIdx].label}</Chip>}
              {minRating > 0 && <Chip onClear={() => setMinRating(0)}>★ {minRating}+</Chip>}
              <button
                onClick={() => { setSearch(''); setSubject(''); setPriceIdx(0); setMinRating(0); }}
                className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
              >
                Reset all
              </button>
            </div>
          )}
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : isError ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Couldn't load tutors"
            description="There was a problem reaching the directory. Try refreshing or come back shortly."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No tutors match your filters"
            description="Try widening your search clear filters or pick a different subject."
            action={
              <Button onClick={() => { setSearch(''); setSubject(''); setPriceIdx(0); setMinRating(0); }}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-900 dark:text-white">{filtered.length}</span> tutor{filtered.length === 1 ? '' : 's'}
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((tutor) => (
                <TutorCard key={tutor.publicId} tutor={tutor} onBook={() => handleBookDemo(tutor)} />
              ))}
            </div>
          </>
        )}

        {isPublic && (
          <div className="mt-16">
            <Card tone="gradient" padding="lg" className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-brand-600 ring-1 ring-brand-100 dark:bg-gray-900/60 dark:text-brand-300">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">
                Get 3 free demo classes
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                Try classes with any tutor risk-free. Sign up as a student and we'll credit your wallet.
              </p>
              <Link to="/register/student" className="mt-5 inline-flex">
                <Button variant="gradient" size="lg">
                  <BookOpen className="h-4 w-4" /> Start free
                </Button>
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>

    {bookingTutor && (
      <BookClassModal
        open
        onClose={() => setBookingTutor(null)}
        tutor={listingToProfile(bookingTutor)}
        onSuccess={() => setBookingTutor(null)}
      />
    )}
    </>
  );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100/60 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
      {children}
      <button
        onClick={onClear}
        className="text-brand-500 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-200"
        aria-label="Remove filter"
      >
        ×
      </button>
    </span>
  );
}

function TutorCard({ tutor, onBook }: { tutor: TutorListing; onBook: () => void }) {
  const initials = tutor.publicId.slice(0, 2).toUpperCase();

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm shadow-gray-200/40 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-200/30 dark:border-gray-800 dark:bg-gray-900">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-pink-500 opacity-80" />

      <div className="flex items-start gap-3">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-violet-100 text-lg font-bold text-brand-700 ring-2 ring-brand-50 dark:from-brand-900/40 dark:to-violet-900/40 dark:text-brand-300 dark:ring-brand-900/40">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
              Tutor {tutor.publicId.slice(0, 6)}
            </h3>
            {tutor.isVerified && (
              <Badge variant="success" tone="soft" size="sm">
                <ShieldCheck className="h-3 w-3" /> Verified
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-gray-700 dark:text-gray-200">
              {tutor.rating > 0 ? tutor.rating.toFixed(1) : 'New'}
            </span>
            {tutor.ratingCount > 0 && <span>({tutor.ratingCount})</span>}
            <span className="mx-1.5 text-gray-300">·</span>
            <Award className="h-3.5 w-3.5 text-violet-500" />
            <span>{tutor.totalClassesCompleted} classes</span>
          </div>
        </div>
      </div>

      {tutor.bio && (
        <p className="mt-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-300">
          {tutor.bio}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tutor.subjects.slice(0, 3).map((s) => (
          <Badge key={s} variant="brand" tone="soft" size="sm">{s}</Badge>
        ))}
        {tutor.subjects.length > 3 && (
          <Badge variant="default" tone="soft" size="sm">+{tutor.subjects.length - 3}</Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800">
        <div className="flex items-center gap-3">
          {tutor.languages?.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Languages className="h-3.5 w-3.5" /> {tutor.languages.slice(0, 2).join(', ')}
            </span>
          )}
          {tutor.timezone && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {tutor.timezone.split('/').pop()}
            </span>
          )}
        </div>
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatINR(tutor.hourlyRateCents)}{tutor.hourlyRateCents > 0 && <span className="text-gray-400 font-normal">/hr</span>}
        </span>
      </div>

      <Button
        className="mt-4 w-full"
        variant="gradient"
        onClick={onBook}
      >
        Book a demo <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PublicNav() {
  const { isAuthenticated, user } = useAuthStore();
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/85 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Takshashila</span>
        </Link>
        <div className="hidden gap-7 md:flex">
          <Link to="/" className="text-sm font-medium text-gray-600 hover:text-brand-600">Home</Link>
          <Link to="/tutors" className="text-sm font-semibold text-brand-600">Find Tutors</Link>
          <Link to="/#features" className="text-sm font-medium text-gray-600 hover:text-brand-600">Features</Link>
        </div>
        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <Link to={`/dashboard/${user.role.toLowerCase().replace('_', '-')}`}>
              <Button size="sm">Go to dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-brand-600">Sign in</Link>
              <Link to="/register/student">
                <Button size="sm" variant="gradient">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
