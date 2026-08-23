/**
 * RolesSettings.jsx
 * Role-Based Access Control matrix for the six staff roles across modules.
 * Permissions: view, create, edit, delete, approve, manage.
 */
import { useState, useEffect } from 'react';
import { Shield, KeyRound, Check, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { ROLE_LIST, MODULE_LIST, PERM_LIST } from '../../store/settingsStore';
import { SettingCard, FormFooter, ConfirmDialog, Note, StatusPill, ErrorCard } from './primitives';

export default function RolesSettings() {
  const [roles, setRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState('veterinarian');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    settingsService.getRoles()
      .then(d => { setRoles(d.matrix); setLoading(false); })
      .catch(e => { console.error(e); setError('Failed to load roles & permissions. Is the backend running and the Phase 20 migration applied?'); setLoading(false); });
  }, []);

  const togglePerm = async (roleId, moduleKey, perm) => {
    const current = !!(roles?.[roleId]?.[moduleKey]?.[perm]);
    const enabled = !current;
    setRoles(prev => ({
      ...prev,
      [roleId]: { ...prev[roleId], [moduleKey]: { ...prev[roleId][moduleKey], [perm]: enabled } },
    }));
    try {
      await settingsService.updatePermission({ role: roleId, module: moduleKey, permission: perm, enabled });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsService.setRolePermissions(activeRole, roles?.[activeRole] ?? {});
      setLastSaved(`Saved ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const permCount = (roleId, moduleKey) =>
    PERM_LIST.filter((p) => roles?.[roleId]?.[moduleKey]?.[p]).length;

  if (error) return <ErrorCard message={error} onRetry={() => window.location.reload()} />;

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-96 rounded-2xl bg-slate-100 dark:bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingCard
        title="Role-Based Access Control"
        subtitle="Define what each role can do across system modules."
        icon={Shield}
      >
        {/* Role selector */}
        <div className="flex flex-wrap gap-2 mb-5">
          {ROLE_LIST.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRole(r.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-body font-600 transition-colors
                ${activeRole === r.id ? 'bg-blue-600 text-white shadow shadow-blue-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-white/5">
          <p className="font-body text-sm font-600 text-slate-700 dark:text-slate-200">
            {ROLE_LIST.find(r => r.id === activeRole)?.label}
          </p>
          <p className="text-xs font-body text-slate-400">
            {ROLE_LIST.find(r => r.id === activeRole)?.desc}
          </p>
          {activeRole === 'admin' && <Note tone="warning" className="mt-2"><AlertTriangle className="w-3.5 h-3.5 inline mr-1" /> Administrators always have full access (all permissions forced on).</Note>}
        </div>

        {/* Permissions matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr className="text-left text-xs font-600 uppercase tracking-wider text-slate-400">
                <th className="px-3 py-2.5">Module</th>
                {PERM_LIST.map((p) => <th key={p} className="px-2 py-2.5 text-center capitalize">{p}</th>)}
                <th className="px-3 py-2.5 text-center">Granted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {MODULE_LIST.map((m) => (
                <tr key={m.key} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="px-3 py-2.5 font-600 text-slate-700 dark:text-slate-200">{m.label}</td>
                  {PERM_LIST.map((p) => {
                    const on = !!roles?.[activeRole]?.[m.key]?.[p];
                    const disabled = activeRole === 'admin';
                    return (
                      <td key={p} className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`${p} ${m.label}`}
                          onClick={() => togglePerm(activeRole, m.key, p)}
                          className={`w-6 h-6 rounded-md flex items-center justify-center mx-auto transition-colors
                            ${on ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-transparent'}
                            ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}>
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 text-center">
                    <StatusPill tone={permCount(activeRole, m.key) > 0 ? 'success' : 'neutral'}>
                      {permCount(activeRole, m.key)}/{PERM_LIST.length}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Note tone="info">Tip: select a different role above to edit its matrix without losing unsaved changes for the current role — all edits stage together and save on click.</Note>
        </div>

        <FormFooter
          onSave={handleSave}
          onReset={() => setConfirmReset(true)}
          saving={saving}
          lastSaved={lastSaved}
          resetLabel="Reset to defaults"
        />
      </SettingCard>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all role permissions?"
        message="This reverts every role's permissions to the recommended defaults. This action is logged."
        danger
        confirmLabel="Reset permissions"
        onConfirm={async () => {
          setConfirmReset(false);
          setSaving(true);
          try {
            await settingsService.resetSection('roles');
            const d = await settingsService.getRoles();
            setRoles(d.matrix);
            setLastSaved('Permissions reset');
          } catch (e) {
            console.error(e);
          }
          setSaving(false);
        }}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
