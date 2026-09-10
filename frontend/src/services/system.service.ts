import { api } from '../lib/axios';

export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs: number | null;
  detail?: string;
}

export interface QueueHealth {
  name: string;
  status: HealthStatus;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
  detail?: string;
}

export interface RequestMetrics {
  totalRequests: number;
  totalErrors: number;
  errorRatePercent: number;
  requestsPerMinute: number;
  latencyMs: { p50: number; p95: number; p99: number; sampleSize: number };
  statusCounts: { status: number; count: number }[];
  slowestRoutes: { route: string; count: number; errorCount: number; avgMs: number; maxMs: number }[];
  since: string;
}

export interface ScheduledJob {
  queue: string;
  name: string;
  pattern: string | null;
  nextRunAt: string | null;
}

export type IntegrationStatus = 'ok' | 'degraded' | 'down' | 'not-configured';

export interface IntegrationHealth {
  key: string;
  name: string;
  /** What breaks for users when this is down. */
  impact: string;
  status: IntegrationStatus;
  latencyMs: number | null;
  detail: string | null;
  checkedAt: string;
}

export interface SystemHealth {
  status: HealthStatus;
  checkedAt: string;
  components: ComponentHealth[];
  queues: QueueHealth[];
  requests: RequestMetrics;
  integrations: IntegrationHealth[];
  realtime: { connectedSockets: number | null; rooms: number | null };
  scheduledJobs: ScheduledJob[];
  process: {
    uptimeSeconds: number;
    nodeVersion: string;
    pid: number;
    env: string;
    memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
  };
  host: {
    platform: string;
    cpuCount: number;
    loadAverage: number[];
    totalMemoryBytes: number;
    freeMemoryBytes: number;
  };
}

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  defaultTutorCommissionRatePercent: number;
  defaultPrincipalCommissionRatePercent: number;
  demoCreditCents: number;
  maxDemoClasses: number;
  maxAdvanceBookingDays: number;
  minClassDurationMinutes: number;
  maxClassDurationMinutes: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  featureFlags: Record<string, boolean>;
  updatedAt?: string;
  updatedBy?: string;
}

/** Labels for the flags the server ships; the server rejects unknown keys. */
export const FEATURE_FLAG_LABELS: Record<string, { label: string; description: string }> = {
  registrationOpen:    { label: 'Registration open', description: 'Allow new accounts to sign up' },
  classBookingEnabled: { label: 'Class booking', description: 'Students can book and schedule classes' },
  payoutsEnabled:      { label: 'Payouts', description: 'Tutors and principals can request withdrawals' },
  chatEnabled:         { label: 'Chat', description: 'In-app messaging between users' },
  gamesEnabled:        { label: 'Learning games', description: 'The student games section' },
};

export interface RealtimeStatus {
  configured: boolean;
  breakerOpen: boolean;
  breakerReason: string | null;
  connections: number;
  maxConnections: number;
  messagesToday: number;
  maxDailyMessages: number;
  connectionsAvailable: boolean;
  messagesAvailable: boolean;
  transport: 'pusher' | 'socket';
}

export interface FailedJob {
  id: string;
  name: string;
  queue: string;
  attemptsMade: number;
  failedReason: string | null;
  stackHead: string | null;
  failedAt: string | null;
  /** Identifier only — job payloads are never sent to the client. */
  summary: string;
}

export const systemService = {
  getFailedJobs: (queue: string, limit = 20): Promise<FailedJob[]> =>
    api.get(`/system/queues/${queue}/failed?limit=${limit}`).then((r) => r.data.data),

  retryFailedJob: (queue: string, jobId: string): Promise<void> =>
    api.post(`/system/queues/${queue}/failed/${jobId}/retry`).then(() => undefined),

  getIntegrations: (): Promise<IntegrationHealth[]> =>
    api.get('/system/integrations').then((r) => r.data.data),

  recheckIntegrations: (): Promise<IntegrationHealth[]> =>
    api.post('/system/integrations/recheck').then((r) => r.data.data),

  getRealtimeStatus: (): Promise<RealtimeStatus> =>
    api.get('/realtime/status').then((r) => r.data.data),

  getHealth: (): Promise<SystemHealth> =>
    api.get('/system/health').then((r) => r.data.data),

  getPlatformSettings: (): Promise<PlatformSettings> =>
    api.get('/settings/platform').then((r) => r.data.data),

  updatePlatformSettings: (patch: Partial<PlatformSettings>): Promise<PlatformSettings> =>
    api.put('/settings/platform', patch).then((r) => r.data.data),
};
