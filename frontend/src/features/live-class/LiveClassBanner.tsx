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

const ROLE_ENDPOINT: Record<string, string> = {
  TUTOR: '/classes/my/tutor',
  STUDENT: '/classes/my/student',
  PRINCIPAL: '/classes/my/principal',
};

export function LiveClassBanner() {
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    const endpoint = ROLE_ENDPOINT[user.role];
    if (!endpoint) return;

    api.get(endpoint, { params: { status: 'LIVE', limit: 1 } })
      .then(({ data }) => {
        const first = data?.data?.items?.[0] ?? null;
        setLiveClass(
          first
            ? {
                publicId: first.publicId,
                title: first.title ?? first.subject ?? 'Class',
                startedAt: first.startUTC ?? first.scheduledStartUTC,
              }
            : null,
        );
      })
      .catch(() => {});
  }, [user]);

  if (!liveClass) return null;

  return (
    <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-2 mb-4 dark:bg-red-900/20 dark:border-red-800">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-red-500 animate-pulse" />
        <span className="text-sm font-medium text-red-700 dark:text-red-400">Live class in progress:</span>
        <span className="text-sm text-red-600 dark:text-red-300">{liveClass.title}</span>
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
