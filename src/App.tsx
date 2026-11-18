import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Download,
  FolderKanban,
  Landmark,
  Monitor,
  Settings,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  db,
  ensureVaultInitialized,
  updateVaultSettings,
} from './db/vaultDb';
import { SPRING_PHYSICS } from './db/formatters';
import { VaultOverview } from './components/VaultOverview';
import { ContributionLedger } from './components/ContributionLedger';
import { ProjectMilestones } from './components/ProjectMilestones';
import { SettingsCenter } from './components/SettingsCenter';
import { RoleSwitcher } from './components/RoleSwitcher';
import { THEME_OPTIONS, ThemeToggle } from './components/ThemeToggle';
import {
  type BeforeInstallPromptEvent,
  DownloadAPKModal,
} from './components/DownloadAPKModal';

export type NavTab = 'vault' | 'members' | 'projects' | 'settings';

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'vault',
    label: 'Vault',
    subtitle: 'Balances & rotation',
    icon: Landmark,
  },
  {
    id: 'members',
    label: 'Members',
    subtitle: 'Deposits & ledger',
    icon: Users,
  },
  {
    id: 'projects',
    label: 'Projects',
    subtitle: 'Goals & milestones',
    icon: FolderKanban,
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'APK, roles & theme',
    icon: Settings,
  },
];

function VaultLogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`${
          compact ? 'w-9 h-9 rounded-xl' : 'w-10 h-10 rounded-2xl'
        } flex items-center justify-center shrink-0 relative overflow-hidden`}
        style={{
          background: 'var(--cv-btn-grad)',
          color: 'var(--cv-accent-contrast)',
          boxShadow: 'var(--cv-btn-shadow)',
        }}
      >
        <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5">
          <circle
            cx="16"
            cy="16"
            r="10.5"
            stroke="currentColor"
            strokeWidth="2.4"
          />
          <circle cx="16" cy="16" r="3" fill="currentColor" />
          <path
            d="M16 5.5V9.5M16 22.5V26.5M5.5 16H9.5M22.5 16H26.5M8.8 8.8L11.5 11.5M20.5 20.5L23.2 23.2M23.2 8.8L20.5 11.5M11.5 20.5L8.8 23.2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p
          className={`${
            compact ? 'text-sm' : 'text-base'
          } font-extrabold tracking-tight leading-none truncate`}
          style={{ color: 'var(--cv-text)' }}
        >
          ChamaVault
        </p>
        <p
          className="text-[11px] font-medium truncate mt-0.5"
          style={{ color: 'var(--cv-text-muted)' }}
        >
          Savings Ledger OS
        </p>
      </div>
    </div>
  );
}

export function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('vault');
  const [apkModalOpen, setApkModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const isNativeApk = Capacitor.isNativePlatform();

  useEffect(() => {
    ensureVaultInitialized().then(() => setDbReady(true));
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const liveData = useLiveQuery(async () => {
    if (!dbReady) return null;
    const [
      settings,
      members,
      contributions,
      payouts,
      projects,
      projectContributions,
      auditLog,
    ] = await Promise.all([
      db.settings.get('primary'),
      db.members.orderBy('rotationOrder').toArray(),
      db.contributions.toArray(),
      db.payouts.toArray(),
      db.projects.toArray(),
      db.projectContributions.toArray(),
      db.auditLog.toArray(),
    ]);
    if (!settings) return null;
    return {
      settings,
      members,
      contributions,
      payouts,
      projects,
      projectContributions,
      auditLog,
    };
  }, [dbReady]);

  // Sync active theme to DOM & browser theme-color meta tag
  useEffect(() => {
    const theme = liveData?.settings.theme ?? 'golden-vault';
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.getElementById('theme-color-meta');
    const descriptor = THEME_OPTIONS.find((t) => t.id === theme);
    if (meta && descriptor) {
      meta.setAttribute('content', descriptor.metaColor);
    }
  }, [liveData?.settings.theme]);

  const handleTriggerPwaInstall = async (): Promise<boolean> => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }
    return false;
  };

  if (!liveData) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="vault-mesh-backdrop">
          <div className="vault-mesh-orb vault-mesh-orb-1" />
          <div className="vault-mesh-orb vault-mesh-orb-2" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING_PHYSICS}
          className="relative z-10 glass-card px-7 py-6 flex items-center gap-3.5"
        >
          <VaultLogoMark />
        </motion.div>
      </div>
    );
  }

  const {
    settings,
    members,
    contributions,
    payouts,
    projects,
    projectContributions,
    auditLog,
  } = liveData;

  const isFramedApkPreview = !isNativeApk && settings.mobileFramePreview;

  // Theme-aware explicit glass surface accent utility complement
  const themeAccentBorderClass =
    settings.theme === 'golden-vault'
      ? 'border-amber-500/30'
      : settings.theme === 'emerald-trust'
        ? 'bg-white/90 border-slate-300/70'
        : 'border-sky-400/30';

  const renderActiveScreen = () => (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={SPRING_PHYSICS}
      >
        {activeTab === 'vault' && (
          <VaultOverview
            settings={settings}
            members={members}
            contributions={contributions}
            payouts={payouts}
            projects={projects}
            projectContributions={projectContributions}
            auditLog={auditLog}
            onNavigateTab={setActiveTab}
            onOpenApkModal={() => setApkModalOpen(true)}
          />
        )}

        {activeTab === 'members' && (
          <ContributionLedger
            settings={settings}
            members={members}
            contributions={contributions}
            payouts={payouts}
            projects={projects}
            projectContributions={projectContributions}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectMilestones
            settings={settings}
            members={members}
            projects={projects}
            projectContributions={projectContributions}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsCenter
            settings={settings}
            members={members}
            contributions={contributions}
            payouts={payouts}
            projects={projects}
            projectContributions={projectContributions}
            auditLog={auditLog}
            isOnline={isOnline}
            isNativeApk={isNativeApk}
            installPrompt={installPrompt}
            onTriggerPwaInstall={handleTriggerPwaInstall}
            onOpenApkModal={() => setApkModalOpen(true)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );

  const renderBottomNav = (layoutPrefix: string) => (
    <nav
      aria-label="Mobile bottom navigation"
      className={`glass-nav ${themeAccentBorderClass} border-t border-x-0 border-b-0 px-2 pt-2 safe-bottom shrink-0`}
    >
      <div className="grid grid-cols-4 gap-1 max-w-md mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-colors"
              style={{
                color: active ? 'var(--cv-accent)' : 'var(--cv-text-muted)',
              }}
            >
              {active && (
                <motion.span
                  layoutId={`${layoutPrefix}-bottom-pill`}
                  transition={SPRING_PHYSICS}
                  className="absolute inset-0 rounded-xl border"
                  style={{
                    background: 'var(--cv-accent-soft)',
                    borderColor: 'var(--cv-border)',
                  }}
                />
              )}
              <Icon className="relative z-10 w-5 h-5" />
              <span
                className="relative z-10 text-[11px] font-semibold mt-0.5"
                style={{
                  color: active ? 'var(--cv-text)' : 'var(--cv-text-muted)',
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen relative">
      {/* Animated Secure Vault Mesh Gradient Surface */}
      <div className="vault-mesh-backdrop" aria-hidden="true">
        <div className="vault-mesh-orb vault-mesh-orb-1" />
        <div className="vault-mesh-orb vault-mesh-orb-2" />
        <div className="vault-mesh-orb vault-mesh-orb-3" />
        <div className="vault-mesh-orb vault-mesh-orb-4" />
      </div>

      {/* Mode 1: Native Android APK Execution OR Framed APK Simulator */}
      {isNativeApk || isFramedApkPreview ? (
        <div
          className={
            isFramedApkPreview
              ? 'relative z-10 min-h-screen flex flex-col items-center justify-center p-4 gap-3'
              : 'relative z-10 h-screen flex flex-col'
          }
        >
          {isFramedApkPreview && (
            <div className="flex items-center gap-3">
              <span className="vault-badge-accent py-1 px-3">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android APK Native Frame Preview</span>
              </span>
              <button
                type="button"
                onClick={() => updateVaultSettings({ mobileFramePreview: false })}
                className="vault-btn-secondary !py-1.5 !px-3 !text-xs"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Exit to Fullscreen Web</span>
              </button>
            </div>
          )}

          <div
            className={
              isFramedApkPreview
                ? 'apk-device-shell'
                : 'flex-1 flex flex-col min-h-0'
            }
          >
            {/* Native APK Status Notch (in frame simulator) */}
            {isFramedApkPreview && (
              <div
                className="px-6 pt-2.5 pb-1 flex items-center justify-between text-[11px] font-semibold tabular-nums shrink-0"
                style={{ color: 'var(--cv-text-muted)' }}
              >
                <span>09:41</span>
                <span
                  className="w-20 h-4 rounded-full"
                  style={{ background: 'rgba(0,0,0,0.45)' }}
                />
                <span className="inline-flex items-center gap-1">
                  {isOnline ? '5G' : 'OFFLINE'} · 100%
                </span>
              </div>
            )}

            {/* Mobile Top App Bar */}
            <header
              className={`glass-nav ${themeAccentBorderClass} border-x-0 border-t-0 px-4 py-2.5 safe-top flex items-center justify-between gap-2 shrink-0`}
            >
              <VaultLogoMark compact />
              <div className="flex items-center gap-1.5">
                <RoleSwitcher
                  role={settings.activeRole}
                  members={members}
                  viewingMemberId={settings.viewingMemberId}
                  variant="compact"
                />
                <ThemeToggle theme={settings.theme} variant="compact" />
              </div>
            </header>

            {/* Scrollable Native Viewport */}
            <main className="flex-1 overflow-y-auto px-4 py-4">
              {renderActiveScreen()}
            </main>

            {/* Native Bottom Navigation Bar */}
            {renderBottomNav('apk')}
          </div>
        </div>
      ) : (
        /* Mode 2: Fullscreen Responsive Web Layout (Desktop Sidebar + Mobile Bottom Nav) */
        <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">
          {/* Desktop Frosted Glass Sidebar */}
          <aside
            className={`hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 glass-nav ${themeAccentBorderClass} border-y-0 border-l-0 p-5 justify-between z-30`}
          >
            <div className="space-y-6">
              <VaultLogoMark />

              <nav aria-label="Primary vault navigation" className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className="relative w-full text-left px-3.5 py-2.5 rounded-xl flex items-center gap-3 transition-colors"
                    >
                      {active && (
                        <motion.span
                          layoutId="desktop-sidebar-pill"
                          transition={SPRING_PHYSICS}
                          className="absolute inset-0 rounded-xl border"
                          style={{
                            background: 'var(--cv-accent-soft-strong)',
                            borderColor: 'var(--cv-border-strong)',
                            boxShadow: 'var(--cv-glow)',
                          }}
                        />
                      )}
                      <span
                        className="relative z-10 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                        style={{
                          background: active
                            ? 'var(--cv-btn-grad)'
                            : 'var(--cv-surface-subtle)',
                          color: active
                            ? 'var(--cv-accent-contrast)'
                            : 'var(--cv-text-secondary)',
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="relative z-10 min-w-0">
                        <span
                          className="block text-sm font-bold leading-tight"
                          style={{
                            color: active
                              ? 'var(--cv-text)'
                              : 'var(--cv-text-secondary)',
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          className="block text-[11px] truncate"
                          style={{ color: 'var(--cv-text-muted)' }}
                        >
                          {item.subtitle}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer: Offline Ledger Status + One-Tap APK CTA */}
            <div className="space-y-3">
              <div className="glass-subtle p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className="font-semibold inline-flex items-center gap-1.5"
                    style={{
                      color: isOnline ? 'var(--cv-positive)' : 'var(--cv-warning)',
                    }}
                  >
                    {isOnline ? (
                      <Wifi className="w-3.5 h-3.5" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5" />
                    )}
                    {isOnline ? 'Vault Synced Local' : 'Offline Mode Active'}
                  </span>
                </div>
                <p
                  className="text-[11px] leading-snug"
                  style={{ color: 'var(--cv-text-muted)' }}
                >
                  Dexie IndexedDB active · {members.length} members ·{' '}
                  {contributions.length} deposits stored on device.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setApkModalOpen(true)}
                className="vault-btn-primary w-full !py-2.5 !text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Android APK</span>
              </button>
            </div>
          </aside>

          {/* Main Workspace Area */}
          <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
            {/* Sticky Glass Top Bar */}
            <header
              className={`sticky top-0 z-20 glass-nav ${themeAccentBorderClass} border-x-0 border-t-0 px-4 sm:px-6 lg:px-8 py-3 safe-top flex items-center justify-between gap-3`}
            >
              <div className="lg:hidden">
                <VaultLogoMark compact />
              </div>

              <div className="hidden lg:flex items-center gap-2.5 min-w-0">
                <span
                  className="text-sm font-bold truncate"
                  style={{ color: 'var(--cv-text)' }}
                >
                  {settings.groupName}
                </span>
                <span
                  className={
                    isOnline
                      ? 'vault-badge-positive text-[11px]'
                      : 'vault-badge-warning text-[11px]'
                  }
                >
                  {isOnline ? 'Offline-Ready' : 'Offline Mode'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <RoleSwitcher
                  role={settings.activeRole}
                  members={members}
                  viewingMemberId={settings.viewingMemberId}
                  variant="compact"
                />
                <ThemeToggle theme={settings.theme} variant="compact" />
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-10">
              {renderActiveScreen()}
            </main>

            {/* Responsive Mobile Bottom Navigation Bar */}
            <div className="fixed bottom-0 inset-x-0 z-30 lg:hidden">
              {renderBottomNav('mobile')}
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Android APK Download Modal */}
      <DownloadAPKModal
        open={apkModalOpen}
        onClose={() => setApkModalOpen(false)}
        installPrompt={installPrompt}
        onTriggerPwaInstall={handleTriggerPwaInstall}
        mobileFramePreview={settings.mobileFramePreview}
        onToggleMobileFrame={() =>
          updateVaultSettings({
            mobileFramePreview: !settings.mobileFramePreview,
          })
        }
      />
    </div>
  );
}

export default App;
