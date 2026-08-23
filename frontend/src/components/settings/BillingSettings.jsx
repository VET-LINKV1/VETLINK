/**
 * BillingSettings.jsx
 * Currency, taxes, service charges, invoice numbering, payment methods,
 * refund policies, PayMongo connection status (secrets hidden).
 */
import { useState, useEffect } from 'react';
import { DollarSign, Percent, Receipt, CreditCard, Shield, Wifi, Trash2, RefreshCw, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { SettingCard, Field, TextInput, Select, Toggle, FormFooter, Note, ConfirmDialog, StatusPill, ChipList, ErrorCard } from './primitives';

function SettingsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
              <div className="h-3 w-56 rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
            <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BillingSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [paymongoSaving, setPaymongoSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    settingsService.getSection('billing')
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load billing settings. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const bill = data;

  const set = async (patch) => {
    await settingsService.updateSection('billing', { ...data, ...patch });
    setData(d => ({ ...d, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    await settingsService.updateSection('billing', data, 'Updated billing & payment settings');
    setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    setSaving(false);
  };

  const handleReset = async () => {
    await settingsService.resetSection('billing');
    const d = await settingsService.getSection('billing');
    setData(d);
  };

  const handleTestPaymongo = async () => {
    setPaymongoSaving(true);
    const res = await settingsService.getPaymongoStatus();
    setTestResult(res);
    setPaymongoSaving(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  const handleTestSms = async () => {
    setPaymongoSaving(true);
    const res = await settingsService.testSms(bill.testSmsPhone, 'This is a test message from Paw Health Veterinary Clinic.');
    setTestResult(res);
    setPaymongoSaving(false);
    setTimeout(() => setTestResult(null), 5000);
  };

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="space-y-5">
      <SettingCard title="Currency & Tax" subtitle="Financial defaults applied to every invoice." icon={DollarSign}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Currency" htmlFor="bcurr">
            <Select id="bcurr" value={bill.currency} onChange={e => set({ currency: e.target.value })}>
              {['PHP','USD','SGD','AED','EUR','GBP','AUD','CAD'].map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-slate-700 dark:text-slate-200">Enable tax</p>
              <p className="text-xs font-body text-slate-400">Applies to all taxable line items.</p>
            </div>
            <Toggle checked={bill.taxEnabled} onChange={v => set({ taxEnabled: v })} label="Tax" />
          </div>
        </div>
        {bill.taxEnabled && (
          <div className="grid gap-4 md:grid-cols-2 pt-2">
            <Field label="Tax rate (%)" htmlFor="btax">
              <TextInput id="btax" type="number" step="0.01" min="0" value={bill.taxRate} onChange={e => set({ taxRate: Number(e.target.value) })} />
            </Field>
            <Field label="Tax label" htmlFor="btaxlab">
              <TextInput id="btaxlab" value={bill.taxLabel} onChange={e => set({ taxLabel: e.target.value })} />
            </Field>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="font-body text-slate-700 dark:text-slate-200">Service charge</p>
            <p className="text-xs font-body text-slate-400">Optional percentage added to invoices.</p>
          </div>
          <Toggle checked={bill.serviceChargeEnabled} onChange={v => set({ serviceChargeEnabled: v })} label="Service charge" />
        </div>
        {bill.serviceChargeEnabled && (
          <Field label="Service charge rate (%)" htmlFor="bsc">
            <TextInput id="bsc" type="number" step="0.01" min="0" value={bill.serviceChargeRate} onChange={e => set({ serviceChargeRate: Number(e.target.value) })} />
          </Field>
        )}
      </SettingCard>

      <SettingCard title="Invoice Numbering" subtitle="Prefix and starting sequence." icon={Receipt}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Prefix" htmlFor="bpref">
            <TextInput id="bpref" value={bill.invoicePrefix} onChange={e => set({ invoicePrefix: e.target.value })} />
          </Field>
          <Field label="Starting number" htmlFor="bstart">
            <TextInput id="bstart" type="number" min="1" value={bill.invoiceStart} onChange={e => set({ invoiceStart: Number(e.target.value) })} />
          </Field>
        </div>
        <Note tone="info">Next invoice will be: <strong>{bill.invoicePrefix}{bill.invoiceStart}</strong>. Changing prefix resets sequence.</Note>
      </SettingCard>

      <SettingCard title="Payment Methods" subtitle="Methods offered at checkout and on invoices." icon={CreditCard}>
        <Field label="Accepted methods" htmlFor="bpm">
          <ChipList items={bill.paymentMethods} onAdd={(v) => set({ paymentMethods: [...bill.paymentMethods, v] })} onRemove={(v) => set({ paymentMethods: bill.paymentMethods.filter(x => x !== v) })} placeholder="Add method" suggestions={['Cash','GCash','Bank Transfer','Credit Card','PayMongo','Maya','GrabPay','Cheque']} />
        </Field>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <TextInput id="btsms" value={bill.testSmsPhone || ''} onChange={e => set({ testSmsPhone: e.target.value })} placeholder="+63 917 555 0000" className="w-56" />
          <button onClick={handleTestSms} disabled={paymongoSaving} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" />
            Send Test SMS
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Refund Policy" subtitle="Rules for client refunds." icon={Shield}>
        <Field label="Policy" htmlFor="bref">
          <Select id="bref" value={bill.refundPolicy} onChange={e => set({ refundPolicy: e.target.value })}>
            <option value="no_refund">No refunds</option>
            <option value="refund_7d">Full refund within 7 days</option>
            <option value="refund_30d">Full refund within 30 days</option>
            <option value="partial_7d">Partial (50%) within 7 days</option>
            <option value="custom">Custom (managed manually)</option>
          </Select>
        </Field>
        {bill.refundPolicy !== 'no_refund' && bill.refundPolicy !== 'custom' && (
          <Field label="Refund window (days)" htmlFor="brwin">
            <TextInput id="brwin" type="number" min="1" value={bill.refundWindowDays} onChange={e => set({ refundWindowDays: Number(e.target.value) })} />
          </Field>
        )}
      </SettingCard>

      <SettingCard title="PayMongo Integration" subtitle="Online payment gateway connection." icon={Wifi}>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Wifi className="w-4 h-4" />
              </div>
              <div>
                <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">PayMongo</p>
                <p className="text-xs font-body text-slate-400">Online card & e-wallet payments</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill tone={bill.paymongo.connected ? 'success' : 'danger'}>
                {bill.paymongo.connected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {bill.paymongo.connected ? 'Connected' : 'Disconnected'}
              </StatusPill>
              <span className="text-xs font-body text-slate-400 capitalize">{bill.paymongo.mode} mode</span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Public key" htmlFor="bpm_pk">
              <TextInput id="bpm_pk" value={bill.paymongo.publicKey} disabled />
            </Field>
            <Field label="Secret key" htmlFor="bpm_sk">
              <div className="relative">
                <TextInput id="bpm_sk" type="password" value="••••••••••••••••" disabled />
                {bill.paymongo.secretKeySet && <StatusPill tone="success" className="absolute right-3 top-1/2 -translate-y-1/2">Set</StatusPill>}
              </div>
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleTestPaymongo} disabled={paymongoSaving} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 text-sm font-body font-600 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-1.5">
              <RefreshCw className={`w-4 h-4 ${paymongoSaving ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
            {testResult && (
              <StatusPill tone={testResult.ok ? 'success' : 'danger'}>
                {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {testResult.message}
              </StatusPill>
            )}
          </div>

          <Note tone="warning">Secret keys are never displayed. To rotate, update via PayMongo dashboard and re-enter here (not yet implemented).</Note>
        </div>
      </SettingCard>

      <div className="flex justify-end">
        <FormFooter onSave={handleSave} onReset={handleReset} saving={saving} lastSaved={lastSaved} />
      </div>
    </div>
  );
}
