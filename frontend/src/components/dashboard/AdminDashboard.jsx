/**
 * AdminDashboard.jsx — VETLINK Main Admin Dashboard
 * Central command center for clinic operations.
 * Composed from focused, self-contained section components.
 */
import { Suspense, lazy, Component } from 'react';
import WelcomeHeader from './admin/WelcomeHeader';
import KpiSummary from './admin/KpiSummary';
import TodaysAppointments from './admin/TodaysAppointments';
import ActionRequired from './admin/ActionRequired';
import VetAvailability from './admin/VetAvailability';
import LabStatus from './admin/LabStatus';
import PrescriptionRequests from './admin/PrescriptionRequests';
import ClinicCapacity from './admin/ClinicCapacity';
import RecentActivity from './admin/RecentActivity';
import SystemStatus from './admin/SystemStatus';
import { Skeleton, Card } from './admin/primitives';

/* ── Lazy-load heavy chart sections ──────────────────────────────────────── */
const AppointmentTrends = lazy(() => import('./admin/AppointmentTrends'));
const RevenueOverview   = lazy(() => import('./admin/RevenueOverview'));

/* ── Skeleton placeholders ───────────────────────────────────────────────── */
function SkeletonChart() {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <Skeleton className="h-6 w-1/4 rounded" />
        <Skeleton className="h-3 w-1/3 rounded mt-1" />
      </div>
      <div className="p-4"><Skeleton className="h-[260px] w-full rounded-xl" /></div>
    </Card>
  );
}
function SkeletonRevenue() {
  return (
    <Card>
      <div className="px-5 py-4 border-b border-slate-100 dark:border-white/10">
        <Skeleton className="h-6 w-1/4 rounded" />
        <Skeleton className="h-3 w-1/3 rounded mt-1" />
      </div>
      <div className="p-4 space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </Card>
  );
}

/* ── Tiny error boundary so a single bad section doesn't blank the page ───── */
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('[AdminDashboard] render error:', error); }
  render() {
    if (this.state.error) {
      return (
        <Card className="p-6">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
            <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <div>
              <p className="font-display text-red-800 dark:text-red-200 font-600">Dashboard section failed</p>
              <p className="font-body text-red-600 dark:text-red-300 text-sm mt-1 font-mono">{this.state.error.message}</p>
              {this.state.error.stack && (
                <pre className="mt-2 text-xs text-red-500 dark:text-red-400/80 font-mono whitespace-pre-wrap max-h-32 overflow-auto">
                  {this.state.error.stack.split('\n').slice(0, 4).join('\n')}
                </pre>
              )}
              <button onClick={() => this.setState({ error: null })} className="mt-2 text-xs text-blue-600 hover:underline">Retry</button>
            </div>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

/* ── Main dashboard composition ──────────────────────────────────────────── */
export default function AdminDashboard({ user }) {
  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-fade-in">
        {/* Welcome + system status + branch selector */}
        <WelcomeHeader />

        {/* KPI summary — 8 metrics */}
        <KpiSummary />

        {/* Primary operational row: appointments + actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 min-w-0">
            <TodaysAppointments />
          </div>
          <div className="min-w-0">
            <ActionRequired />
          </div>
        </div>

        {/* Analytics row: trends + revenue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<SkeletonChart />}>
            <AppointmentTrends />
          </Suspense>
          <Suspense fallback={<SkeletonRevenue />}>
            <RevenueOverview />
          </Suspense>
        </div>

        {/* Operations row: vets, lab, rx, capacity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <VetAvailability />
          <LabStatus />
          <PrescriptionRequests />
          <ClinicCapacity />
        </div>

        {/* Bottom row: recent activity + system status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
          <div>
            <SystemStatus />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}