import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2, AlertTriangle, XCircle, MinusCircle, RefreshCw,
  HardDrive, Mail, Video, CreditCard, Bell, KeyRound, Radio, Film, PenTool,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { systemService, type IntegrationHealth, type IntegrationStatus } from '../../services/system.service';

const STATUS_META: Record<IntegrationStatus, {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'default';
  icon: typeof CheckCircle2;
  tone: string;
}> = {
  ok:               { label: 'Operational',     variant: 'success', icon: CheckCircle2,  tone: 'text-ok' },
  degraded:         { label: 'Degraded',        variant: 'warning', icon: AlertTriangle, tone: 'text-warn' },
  down:             { label: 'Failing',         variant: 'danger',  icon: XCircle,       tone: 'text-danger' },
  'not-configured': { label: 'Not configured',  variant: 'default', icon: MinusCircle,   tone: 'text-ink-faint' },
};

const ICONS: Record<string, typeof HardDrive> = {
  gcs: HardDrive,
  'gcs-recordings': Film,
  smtp: Mail,
  'agora-rtc': Video,
  'agora-recording': Film,
  'agora-whiteboard': PenTool,
  stripe: CreditCard,
  razorpay: CreditCard,
  firebase: Bell,
  'google-oauth': KeyRound,
  pusher: Radio,
};

interface IntegrationsPanelProps {
  integrations: IntegrationHealth[];
}

/**
 * Third-party dependency health. Ordered worst-first so a failure is the first
 * thing read, and each row says what breaks for users rather than only naming
 * the service — "Google Cloud Storage: Failing" means nothing at 3am unless it
 * also says uploads and recordings are down.
 */
export function IntegrationsPanel({ integrations }: IntegrationsPanelProps) {
  const qc = useQueryClient();

  const { mutate: recheck, isPending: rechecking } = useMutation({
    mutationFn: systemService.recheckIntegrations,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-health'] });
      qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const severity: Record<IntegrationStatus, number> = {
    down: 0, degraded: 1, ok: 2, 'not-configured': 3,
  };
  const sorted = [...integrations].sort((a, b) => severity[a.status] - severity[b.status]);

  const failing = integrations.filter((i) => i.status === 'down').length;
  const degraded = integrations.filter((i) => i.status === 'degraded').length;
  const configured = integrations.filter((i) => i.status !== 'not-configured').length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Integrations</CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            {failing > 0
              ? `${failing} failing${degraded > 0 ? `, ${degraded} degraded` : ''}`
              : degraded > 0
                ? `${degraded} degraded`
                : `All ${configured} configured services healthy`}
          </p>
        </div>
        <Button size="sm" variant="outline" loading={rechecking} onClick={() => recheck()}>
          <RefreshCw className="h-3.5 w-3.5" /> Re-check
        </Button>
      </CardHeader>

      <CardContent>
        <div className="grid gap-2.5 md:grid-cols-2">
          {sorted.map((item) => {
            const meta = STATUS_META[item.status];
            const StatusIcon = meta.icon;
            const ServiceIcon = ICONS[item.key] ?? HardDrive;
            const muted = item.status === 'not-configured';

            return (
              <div
                key={item.key}
                className={`rounded border p-3.5 transition-colors ${
                  item.status === 'down'
                    ? 'border-danger/40 bg-danger-wash'
                    : item.status === 'degraded'
                      ? 'border-warn/40 bg-warn-wash'
                      : 'border-rule'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <ServiceIcon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${muted ? 'text-ink-faint' : 'text-ink-muted'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${muted ? 'text-ink-muted' : 'text-ink'}`}>
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{item.impact}</p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {item.latencyMs !== null && (
                      <span className="text-[11px] tabular-nums text-ink-faint">{item.latencyMs}ms</span>
                    )}
                    <StatusIcon className={`h-4 w-4 ${meta.tone}`} />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <Badge variant={meta.variant} tone="soft">{meta.label}</Badge>
                  {item.detail && (
                    <span
                      className="truncate text-[11px] text-ink-muted"
                      title={item.detail}
                    >
                      {item.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {integrations.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-muted">No integrations reported.</p>
        )}
      </CardContent>
    </Card>
  );
}
