// frontend/src/pages/student/StudentSkillsPage.tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Loading';
import { usePrograms } from '../../hooks/use-programs';
import { PROGRAM_CATEGORIES, PROGRAM_LEVELS, categoryLabel, levelLabel } from '../../constants/programs';
import { formatCurrency } from '../../utils/currency';

export function StudentSkillsPage() {
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [age, setAge] = useState('');
  const [q, setQ] = useState('');
  const params: Record<string, string> = { limit: '48' };
  if (category) params.category = category;
  if (level) params.level = level;
  if (age) params.age = age;
  if (q.trim()) params.q = q.trim();
  const { data, isLoading } = usePrograms(params);
  const programs = data?.items ?? [];

  return (
    <div className="animate-fade-in">
      <PageHeader eyebrow="Beyond school" title="Skills" description="Programs from tutors: arts, music, chess, coding, AI and more." icon={<Sparkles className="h-5 w-5" />} />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. chess" />
        <Select label="Category" placeholder="All categories" options={[{ value: '', label: 'All categories' }, ...PROGRAM_CATEGORIES]} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Select label="Level" placeholder="All levels" options={[{ value: '', label: 'All levels' }, ...PROGRAM_LEVELS]} value={level} onChange={(e) => setLevel(e.target.value)} />
        <Input label="Age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Any" />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : programs.length === 0 ? (
        <Card><CardContent><p className="py-10 text-center text-sm text-gray-500">No programs match these filters yet.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Link key={p.publicId} to={`/dashboard/student/skills/${p.publicId}`}>
              <Card className="h-full hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                <CardContent>
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="purple" tone="soft">{categoryLabel(p.category)}</Badge>
                    {p.isFull && <Badge variant="warning" tone="soft">Full</Badge>}
                  </div>
                  <p className="mt-2 font-semibold text-gray-900 dark:text-white">{p.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">with {p.tutorName}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {levelLabel(p.level)} · {p.sessionCount} sessions{p.ageMin || p.ageMax ? ` · ages ${p.ageMin ?? '?'}–${p.ageMax ?? '?'}` : ''}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.priceCents)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
