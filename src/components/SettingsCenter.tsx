import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  HardDrive,
  Lock,
  Monitor,
  Palette,
  RotateCcw,
  Save,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  type AuditEntry,
  clearAllVaultRecords,
  type Contribution,
  type ContributionFrequency,
  type CurrencyCode,
  exportVaultBackup,
  type FundraiserProject,
  importVaultBackup,
  type Member,
  type PayoutRecord,
  type ProjectContribution,
  resetToDemoData,
  updateVaultSettings,
  type VaultBackupPayload,
  type VaultSettings,
} from '../db/vaultDb';
import {
  CURRENCY_META,
  exportFullFinancialReportCsv,
  formatCurrency,
  SPRING_PHYSICS,
  todayIso,
  triggerFileDownload,
} from '../db/formatters';
import { RoleSwitcher } from './RoleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import type { BeforeInstallPromptEvent } from './DownloadAPKModal';

interface SettingsCenterProps {
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  payouts: PayoutRecord[];
  projects: FundraiserProject[];
  projectContributions: ProjectContribution[];
  auditLog: AuditEntry[];
  isOnline: boolean;
  isNativeApk: boolean;
  installPrompt: BeforeInstallPromptEvent | null;
  onTriggerPwaInstall: () => Promise<boolean>;
  onOpenApkModal: () => void;
}

export const SettingsCenter: React.FC<SettingsCenterProps> = ({
  settings,
  members,
  contributions,
  payouts,
  projects,
  projectContributions,
  auditLog,
  isOnline,
  isNativeApk,
  installPrompt,
  onTriggerPwaInstall,
  onOpenApkModal,
}) => {
  const isTreasurer = settings.activeRole === 'treasurer';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Group Rules Form State
  const [groupName, setGroupName] = useState(settings.groupName);
  const [regNo, setRegNo] = useState(settings.registrationNo);
  const [location, setLocation] = useState(settings.location);
  const [currency, setCurrency] = useState<CurrencyCode>(settings.currency);
  const [defaultTarget, setDefaultTarget] = useState(String(settings.defaultTarget));
  const [frequency, setFrequency] = useState<ContributionFrequency>(settings.frequency);
  const [cycleMonth, setCycleMonth] = useState(settings.currentCycleMonth);
  const [syncMemberTargets, setSyncMemberTargets] = useState(false);

  // Storage Stats
  const [storageInfo, setStorageInfo] = useState<{
    ledgerBytes: number;
    browserUsageBytes: number;
    browserQuotaBytes: number;
    persisted: boolean;
    swActive: boolean;
  }>({
    ledgerBytes: 0,
    browserUsageBytes: 0,
    browserQuotaBytes: 0,
    persisted: false,
    swActive: false,
  });

  const [bannerMsg, setBannerMsg] = useState<{
    tone: 'positive' | 'danger';
    text: string;
  } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'demo' | 'clear' | null>(null);

  useEffect(() => {
    setGroupName(settings.groupName);
    setRegNo(settings.registrationNo);
    setLocation(settings.location);
    setCurrency(settings.currency);
    setDefaultTarget(String(settings.defaultTarget));
    setFrequency(settings.frequency);
    setCycleMonth(settings.currentCycleMonth);
  }, [settings]);

  const totalRecords =
    members.length +
    contributions.length +
    payouts.length +
    projects.length +
    projectContributions.length +
    auditLog.length;

  useEffect(() => {
    let active = true;
    (async () => {
      const serialized = JSON.stringify({
        settings,
        members,
        contributions,
        payouts,
        projects,
        projectContributions,
        auditLog,
      });
      const ledgerBytes = new Blob([serialized]).size;

      let browserUsageBytes = ledgerBytes;
      let browserQuotaBytes = 0;
      let persisted = false;
      let swActive = false;

      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          browserUsageBytes = est.usage ?? ledgerBytes;
          browserQuotaBytes = est.quota ?? 0;
        }
        if (navigator.storage?.persisted) {
          persisted = await navigator.storage.persisted();
        }
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          swActive = Boolean(reg?.active);
        }
      } catch {
        // Ignore storage inspection issues in restricted contexts
      }

      if (active) {
        setStorageInfo({
          ledgerBytes,
          browserUsageBytes,
          browserQuotaBytes,
          persisted,
          swActive,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [
    settings,
    members,
    contributions,
    payouts,
    projects,
    projectContributions,
    auditLog,
  ]);

  const showNotice = (text: string, tone: 'positive' | 'danger' = 'positive') => {
    setBannerMsg({ tone, text });
    setTimeout(() => setBannerMsg(null), 4000);
  };

  const handleSaveGroupConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTreasurer) return;
    const cleanTarget = Math.max(1, Number(defaultTarget) || settings.defaultTarget);
    await updateVaultSettings(
      {
        groupName: groupName.trim() || settings.groupName,
        registrationNo: regNo.trim(),
        location: location.trim(),
        currency,
        defaultTarget: cleanTarget,
        frequency,
        currentCycleMonth: cycleMonth || settings.currentCycleMonth,
      },
      {
        syncAllMemberTargets: syncMemberTargets,
        auditSummary: `Updated group settings (${currency}, target ${formatCurrency(
          cleanTarget,
          currency
        )})`,
      }
    );
    setSyncMemberTargets(false);
    showNotice('Group vault configuration saved to offline database.');
  };

  const handleExportJson = async () => {
    const payload = await exportVaultBackup();
    const slug = settings.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerFileDownload(
      JSON.stringify(payload, null, 2),
      `${slug}-backup-${todayIso()}.json`,
      'application/json'
    );
    showNotice('Encrypted-ready JSON vault backup downloaded.');
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isTreasurer) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as VaultBackupPayload;
      await importVaultBackup(parsed);
      showNotice(
        `Restored backup successfully (${parsed.members.length} members, ${parsed.contributions.length} deposits).`
      );
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'Could not parse backup JSON file.',
        'danger'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleRequestPersistentStorage = async () => {
    try {
      if (navigator.storage?.persist) {
        const granted = await navigator.storage.persist();
        setStorageInfo((prev) => ({ ...prev, persisted: granted }));
        showNotice(
          granted
            ? 'Durable persistent offline storage locked for this device.'
            : 'Browser manages offline IndexedDB persistence automatically.'
        );
      }
    } catch {
      showNotice('IndexedDB persistence is active by default.');
    }
  };

  const handleResetDemo = async () => {
    if (!isTreasurer) return;
    await resetToDemoData();
    setConfirmAction(null);
    showNotice('Sample Imani Heritage Chama ledger restored.');
  };

  const handleClearVault = async () => {
    if (!isTreasurer) return;
    await clearAllVaultRecords();
    setConfirmAction(null);
    showNotice('All ledger records cleared. Ready for your new chama.');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="space-y-5">
      {/* Settings Header with Prominent Role Switcher */}
      <div className="glass-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1
            className="text-xl sm:text-2xl font-extrabold tracking-tight"
            style={{ color: 'var(--cv-text)' }}
          >
            Settings &amp; APK Center
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
            Manage vault roles, Android APK installation, glass themes, and offline IndexedDB storage.
          </p>
        </div>

        <RoleSwitcher
          role={settings.activeRole}
          members={members}
          viewingMemberId={settings.viewingMemberId}
          variant="header"
        />
      </div>

      {/* Feedback Banner */}
      {bannerMsg && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_PHYSICS}
          className="px-4 py-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold"
          style={{
            background:
              bannerMsg.tone === 'positive'
                ? 'var(--cv-positive-soft)'
                : 'var(--cv-danger-soft)',
            borderColor:
              bannerMsg.tone === 'positive'
                ? 'var(--cv-positive-border)'
                : 'var(--cv-danger-border)',
            color:
              bannerMsg.tone === 'positive'
                ? 'var(--cv-positive)'
                : 'var(--cv-danger)',
          }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{bannerMsg.text}</span>
        </motion.div>
      )}

      {/* Prominent Android APK Download Center */}
      <section className="glass-card-hero p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="vault-badge-accent">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Capacitor Android APK · v1.0.0</span>
              </span>
              <span className="vault-badge-positive">
                {isOnline ? (
                  <>
                    <Wifi className="w-3 h-3" /> Online &amp; Offline Ready
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" /> Running Offline
                  </>
                )}
              </span>
            </div>

            <h2
              className="text-lg sm:text-xl font-extrabold tracking-tight"
              style={{ color: 'var(--cv-text)' }}
            >
              Take ChamaVault Offline on Any Android Phone
            </h2>
            <p
              className="text-xs sm:text-sm leading-relaxed"
              style={{ color: 'var(--cv-text-muted)' }}
            >
              Packaged with <code className="font-mono">@capacitor/android</code> (
              <code className="font-mono">com.chamavault.ledger</code>) with native bottom navigation,
              full offline Dexie.js ledger storage, and instant CSV/JSON backup export for rural or
              zero-signal chama meetings.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 sm:min-w-[230px]">
            <button
              type="button"
              onClick={onOpenApkModal}
              className="vault-btn-primary py-3 px-5 text-sm font-bold"
            >
              <Download className="w-4 h-4" />
              <span>Download Android APK</span>
            </button>

            {!isNativeApk && (
              <button
                type="button"
                onClick={() =>
                  updateVaultSettings({
                    mobileFramePreview: !settings.mobileFramePreview,
                  })
                }
                className="vault-btn-secondary py-2.5 text-xs hidden lg:inline-flex"
              >
                {settings.mobileFramePreview ? (
                  <>
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Switch to Fullscreen Web View</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Preview Native APK Mobile Frame</span>
                  </>
                )}
              </button>
            )}

            {installPrompt && (
              <button
                type="button"
                onClick={() => {
                  onTriggerPwaInstall().then((ok) => {
                    if (ok) showNotice('ChamaVault installed to device home screen.');
                  });
                }}
                className="vault-btn-secondary py-2 text-xs"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Install Web App (Offline PWA)</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Theme Engine (3 Modes) */}
      <section className="glass-card p-5 space-y-4">
        <div>
          <h2
            className="text-base font-bold flex items-center gap-2"
            style={{ color: 'var(--cv-text)' }}
          >
            <Palette className="w-4 h-4" style={{ color: 'var(--cv-accent)' }} />
            Vault Theme Engine
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
            Switch instantly between three crafted glassmorphic color systems — persisted offline.
          </p>
        </div>

        <ThemeToggle theme={settings.theme} variant="cards" />
      </section>

      {/* Role Privileges Breakdown */}
      <section className="glass-card p-5 space-y-4">
        <div>
          <h2
            className="text-base font-bold flex items-center gap-2"
            style={{ color: 'var(--cv-text)' }}
          >
            <Shield className="w-4 h-4" style={{ color: 'var(--cv-accent)' }} />
            Access Privileges &amp; Role Control
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
            Control full administrative custody versus read-only member inspection.
          </p>
        </div>

        <RoleSwitcher
          role={settings.activeRole}
          members={members}
          viewingMemberId={settings.viewingMemberId}
          variant="full"
        />
      </section>

      {/* Offline Dexie IndexedDB Storage Stats & Backup / Export */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2
              className="text-base font-bold flex items-center gap-2"
              style={{ color: 'var(--cv-text)' }}
            >
              <Database className="w-4 h-4" style={{ color: 'var(--cv-accent)' }} />
              Local Offline Storage (Dexie IndexedDB)
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
              Database <code className="font-mono">ChamaVaultOfflineDB</code> ·{' '}
              {totalRecords} local records · {formatBytes(storageInfo.ledgerBytes)} ledger payload
            </p>
          </div>

          <button
            type="button"
            onClick={handleRequestPersistentStorage}
            className="vault-btn-secondary !py-1.5 !px-3 !text-xs self-start sm:self-auto"
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>
              {storageInfo.persisted ? 'Persistent Storage Locked' : 'Lock Persistent Storage'}
            </span>
          </button>
        </div>

        {/* Record Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { label: 'Members', count: members.length },
            { label: 'Deposits', count: contributions.length },
            { label: 'Payouts', count: payouts.length },
            { label: 'Projects', count: projects.length },
            { label: 'Pledges', count: projectContributions.length },
            { label: 'Audit Logs', count: auditLog.length },
          ].map((stat) => (
            <div key={stat.label} className="glass-subtle p-3 text-center">
              <p
                className="text-lg font-extrabold tabular-nums"
                style={{ color: 'var(--cv-text)' }}
              >
                {stat.count}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Device Quota Strip */}
        <div className="glass-subtle p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span style={{ color: 'var(--cv-text-secondary)' }}>
            IndexedDB Footprint:{' '}
            <strong className="tabular-nums">
              {formatBytes(storageInfo.browserUsageBytes)}
            </strong>
            {storageInfo.browserQuotaBytes > 0 && (
              <span style={{ color: 'var(--cv-text-muted)' }}>
                {' '}
                of {formatBytes(storageInfo.browserQuotaBytes)} available on device
              </span>
            )}
          </span>
          <span className="vault-badge-positive text-[11px]">
            {storageInfo.swActive
              ? 'Service Worker Cached'
              : 'IndexedDB Ready Offline'}
          </span>
        </div>

        {/* Reports & Backup Controls */}
        {isTreasurer ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  exportFullFinancialReportCsv({
                    settings,
                    members,
                    contributions,
                    payouts,
                    projects,
                    projectContributions,
                  });
                  showNotice('Full ChamaVault CSV ledger report exported.');
                }}
                className="vault-btn-primary !py-2 !px-3.5 !text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Financial Report (CSV)</span>
              </button>

              <button
                type="button"
                onClick={handleExportJson}
                className="vault-btn-secondary !py-2 !px-3.5 !text-xs"
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Backup Vault (JSON)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="vault-btn-secondary !py-2 !px-3.5 !text-xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restore Backup</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportJson}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => setConfirmAction('demo')}
                className="vault-btn-secondary !py-2 !px-3 !text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Demo Data</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmAction('clear')}
                className="vault-btn-secondary !py-2 !px-3 !text-xs"
                style={{ color: 'var(--cv-danger)' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Vault</span>
              </button>
            </div>

            {confirmAction && (
              <div
                className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                style={{
                  background: 'var(--cv-danger-soft)',
                  borderColor: 'var(--cv-danger-border)',
                  color: 'var(--cv-text)',
                }}
              >
                <span>
                  {confirmAction === 'demo'
                    ? 'Replace current local ledger with the sample 8-member Imani Heritage Chama dataset?'
                    : 'Permanently clear all local members, deposits, payouts, and projects? Export a JSON backup first if needed.'}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="vault-btn-secondary !py-1.5 !px-3 !text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={
                      confirmAction === 'demo' ? handleResetDemo : handleClearVault
                    }
                    className="vault-btn-primary !py-1.5 !px-3 !text-xs"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="glass-subtle p-3.5 flex items-center gap-2.5 text-xs"
            style={{ color: 'var(--cv-text-muted)' }}
          >
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              Full group ledger export, backup restoration, and database resets require Treasurer / Admin privileges.
            </span>
          </div>
        )}
      </section>

      {/* Group Constitution & Accounting Configuration */}
      <section className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--cv-text)' }}>
              Group Profile &amp; Contribution Rules
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
              Configure group identity, base currency, contribution frequency, and accounting cycle.
            </p>
          </div>
          {!isTreasurer && (
            <span className="vault-badge-info text-[11px]">
              <Lock className="w-3 h-3" /> Read-Only
            </span>
          )}
        </div>

        <form onSubmit={handleSaveGroupConfig} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Group Name
              </label>
              <input
                type="text"
                disabled={!isTreasurer}
                required
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="vault-input disabled:opacity-65"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Registration Number
              </label>
              <input
                type="text"
                disabled={!isTreasurer}
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                className="vault-input font-mono disabled:opacity-65"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Chapter Location
              </label>
              <input
                type="text"
                disabled={!isTreasurer}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="vault-input disabled:opacity-65"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Vault Currency
              </label>
              <select
                disabled={!isTreasurer}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="vault-input disabled:opacity-65"
              >
                {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCY_META[c].name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Standard Target ({currency})
              </label>
              <input
                type="number"
                disabled={!isTreasurer}
                required
                min="1"
                step="any"
                value={defaultTarget}
                onChange={(e) => setDefaultTarget(e.target.value)}
                className="vault-input tabular-nums font-semibold disabled:opacity-65"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Contribution Frequency
              </label>
              <select
                disabled={!isTreasurer}
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as ContributionFrequency)
                }
                className="vault-input disabled:opacity-65"
              >
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Active Accounting Cycle
              </label>
              <input
                type="month"
                disabled={!isTreasurer}
                required
                value={cycleMonth}
                onChange={(e) => setCycleMonth(e.target.value)}
                className="vault-input tabular-nums disabled:opacity-65"
              />
            </div>
          </div>

          {isTreasurer && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={syncMemberTargets}
                  onChange={(e) => setSyncMemberTargets(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: 'var(--cv-accent)' }}
                />
                <span style={{ color: 'var(--cv-text-secondary)' }}>
                  Also update all existing members&apos; individual target to{' '}
                  {formatCurrency(Number(defaultTarget) || 0, currency)}
                </span>
              </label>

              <button type="submit" className="vault-btn-primary self-start sm:self-auto">
                <Save className="w-4 h-4" />
                <span>Save Group Rules</span>
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
};
