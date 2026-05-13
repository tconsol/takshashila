import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { api } from '../../lib/axios';
import { useAuthStore } from '../../stores/auth.store';

interface LiveClass {
  publicId: string;
  title: string;
  startedAt: string;
}

export function LiveClassBanner() {
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    // Only TUTOR and STUDENT have role-specific class endpoints
    if (user.role !== 'TUTOR' && user.role !== 'STUDENT') return;
    const endpoint = user.role === 'TUTOR' ? '/classes/my/tutor' : '/classes/my/student';
    api.get(endpoint, { params: { status: 'IN_PROGRESS', limit: 1 } })
      .then(({ data }) => {
        const first = data?.data?.items?.[0] ?? null;
        setLiveClass(first ? { publicId: first.publicId, title: first.title ?? first.subject ?? 'Class', startedAt: first.startUTC ?? first.scheduledStartUTC } : null);
      })
      .catch(() => {});
  }, [user]);

  if (!liveClass) return null;

  return (
    <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-2 mb-4">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-700">Live class in progress:</span>
        <span className="text-sm text-red-600">{liveClass.title}</span>
      </div>
      <button
        onClick={() => navigate(`/class/${liveClass.publicId}`)}
        className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-md transition-colors"
      >
        Join Now
      </button>
    </div>
  );
}
