/**
 * SystemStatus.jsx
 * Operational status of backend services: DB, API, SMS, payments, email,
 * latest backup. Compact, glanceable, with latency where meaningful.
 */
import { useState, useEffect } from 'react';
import {
  Server, Database, Globe, MessageSquare, CreditCard, Mail, HardDrive,
  CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react';
import { Card, SectionHeader, Skeleton, ErrorState } from './primitives';
import { dashboardApi } from './mockData';

const ICONS = {
  db: Database, api: Globe, sms: MessageSquare, pay: CreditCard, email: Mail, backup: HardDrive,
};

const STATE = {
  operational: { Icon: CheckCircle2, tone: 'emerald', label: 'Operational', dot: 'bg-emerald-500' },
  degraded: { Icon: AlertTriangle, tone: 'amber', label: 'Degraded', dot: 'bg-amber-500' },
  ok: { Icon: CheckCircle2, tone: 'emerald', label: 'Up to date', dot: 'bg-emerald-500' },
  down: { Icon: XCircle, tone: 'red', label: 'Down', dot: 'bg-red-500' },
};

export default function SystemStatus() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      setServices(await dashboardApi.getSystem());
    } catch (e) {
      setError(e.message || 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const allGood = services.every((s) => s.status === 'operational' || s.status === 'ok');

  return (
    <Card>
      <SectionHeader
        title="System Status"
        subtitle="Infrastructure health"
        icon={Server}
        action={
          <span className={`inline-flex items-center gap-1.5 text-xs font-body font-600 px-2.5 py-1 rounded-lg ${
            allGood ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${allGood ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {allGood ? 'All systems go' : '1 service degraded'}
          </span>
        }
      />
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <ul className="space-y-1.5">
            {services.map((s) => {
              const cfg = STATE[s.status] || STATE.operational;
              const { Icon: StateIcon } = cfg;
              const SvcIcon = ICONS[s.id] || Server;
              return (
                <li key={s.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <SvcIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-slate-700 dark:text-slate-200 text-sm font-500">{s.label}</p>
                    <p className="font-body text-slate-400 dark:text-slate-500 text-xs truncate">{s.detail}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.latencyMs > 0 && (
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                        {s.latencyMs} ms
                      </span>
                    )}
                    <StateIcon className={`w-4 h-4 ${cfg.tone === 'emerald' ? 'text-emerald-500' : cfg.tone === 'amber' ? 'text-amber-500' : 'text-red-500'}`} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}