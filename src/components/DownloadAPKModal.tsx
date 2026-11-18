import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  HardDrive,
  ShieldCheck,
  Smartphone,
  Terminal,
  WifiOff,
} from 'lucide-react';
import { ModalShell } from './ModalShell';
import { SPRING_PHYSICS } from '../db/formatters';

interface ApkManifest {
  appName: string;
  appId: string;
  version: string;
  versionCode: number;
  minSdkVersion: number;
  targetSdkVersion: number;
  androidLabel: string;
  capacitorVersion: string;
  downloadPath: string;
  fileName: string;
  githubReleaseUrl: string;
  githubActionsUrl: string;
  estimatedSize: string;
  binaryBundled: boolean;
  sha256: string | null;
  builtAt: string | null;
  offlineEngine: string;
  permissions: string[];
}

const DEFAULT_MANIFEST: ApkManifest = {
  appName: 'ChamaVault',
  appId: 'com.chamavault.ledger',
  version: '1.0.0',
  versionCode: 1,
  minSdkVersion: 22,
  targetSdkVersion: 34,
  androidLabel: 'Android 5.1+ (Lollipop — Android 15)',
  capacitorVersion: '6.2.0',
  downloadPath: '/downloads/chama-vault.apk',
  fileName: 'ChamaVault-v1.0.0.apk',
  githubReleaseUrl:
    'https://github.com/kennedy-blip/chama-vault/releases/latest/download/chama-vault.apk',
  githubActionsUrl:
    'https://github.com/kennedy-blip/chama-vault/actions/workflows/build-apk.yml',
  estimatedSize: '4.8 MB',
  binaryBundled: false,
  sha256: null,
  builtAt: null,
  offlineEngine: 'Dexie.js v4 (IndexedDB) + Capacitor WebView + Service Worker',
  permissions: [
    'Offline IndexedDB Vault Storage (Zero cloud lock-in)',
    'File Export & Share (CSV & JSON backup reports)',
  ],
};

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface DownloadAPKModalProps {
  open: boolean;
  onClose: () => void;
  installPrompt: BeforeInstallPromptEvent | null;
  onTriggerPwaInstall: () => Promise<boolean>;
  mobileFramePreview: boolean;
  onToggleMobileFrame: () => void;
}

export const DownloadAPKModal: React.FC<DownloadAPKModalProps> = ({
  open,
  onClose,
  installPrompt,
  onTriggerPwaInstall,
  mobileFramePreview,
  onToggleMobileFrame,
}) => {
  const [manifest, setManifest] = useState<ApkManifest>(DEFAULT_MANIFEST);
  const [localApkReady, setLocalApkReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [downloadTriggered, setDownloadTriggered] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);

    (async () => {
      try {
        const res = await fetch('/downloads/apk-manifest.json', { cache: 'no-cache' });
        if (res.ok) {
          const data = (await res.json()) as ApkManifest;
          if (!cancelled) {
            setManifest(data);
            if (data.binaryBundled) {
              const head = await fetch(data.downloadPath, { method: 'HEAD' });
              const contentType = head.headers.get('content-type') || '';
              if (!cancelled) {
                setLocalApkReady(head.ok && !contentType.includes('text/html'));
              }
            } else {
              setLocalApkReady(false);
            }
          }
        }
      } catch {
        if (!cancelled) setLocalApkReady(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleCopyBuildCommand = async () => {
    try {
      await navigator.clipboard.writeText('npm run apk:build');
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      setCopiedCmd(false);
    }
  };

  const handlePrimaryDownload = () => {
    setDownloadTriggered(true);
    setTimeout(() => setDownloadTriggered(false), 3500);
  };

  const handlePwaClick = async () => {
    const ok = await onTriggerPwaInstall();
    if (ok) setPwaInstalled(true);
  };

  const activeDownloadHref = localApkReady
    ? manifest.downloadPath
    : manifest.githubReleaseUrl;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="ChamaVault for Android (APK)"
      subtitle="Native Capacitor Android package with 100% offline Dexie IndexedDB storage."
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-4">
        {/* Package Identity Banner */}
        <div
          className="rounded-2xl p-4 border flex items-center justify-between gap-4"
          style={{
            background: 'var(--cv-accent-soft)',
            borderColor: 'var(--cv-border-strong)',
          }}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: 'var(--cv-btn-grad)',
                color: 'var(--cv-accent-contrast)',
                boxShadow: 'var(--cv-btn-shadow)',
              }}
            >
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3
                  className="text-sm sm:text-base font-bold truncate"
                  style={{ color: 'var(--cv-text)' }}
                >
                  {manifest.fileName}
                </h3>
                <span className="vault-badge-positive text-[11px]">
                  v{manifest.version}
                </span>
              </div>
              <p
                className="text-xs font-mono truncate mt-0.5"
                style={{ color: 'var(--cv-text-muted)' }}
              >
                {manifest.appId} · Capacitor {manifest.capacitorVersion}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0 hidden sm:block">
            <p
              className="text-sm font-bold tabular-nums"
              style={{ color: 'var(--cv-text)' }}
            >
              {manifest.estimatedSize}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
              Min SDK {manifest.minSdkVersion}
            </p>
          </div>
        </div>

        {/* Spec Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="glass-subtle p-3">
            <WifiOff
              className="w-4 h-4 mb-1.5"
              style={{ color: 'var(--cv-accent)' }}
            />
            <p className="text-xs font-semibold" style={{ color: 'var(--cv-text)' }}>
              100% Offline
            </p>
            <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
              IndexedDB ledger
            </p>
          </div>
          <div className="glass-subtle p-3">
            <ShieldCheck
              className="w-4 h-4 mb-1.5"
              style={{ color: 'var(--cv-positive)' }}
            />
            <p className="text-xs font-semibold" style={{ color: 'var(--cv-text)' }}>
              Android 5.1+
            </p>
            <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
              Target SDK {manifest.targetSdkVersion}
            </p>
          </div>
          <div className="glass-subtle p-3">
            <HardDrive
              className="w-4 h-4 mb-1.5"
              style={{ color: 'var(--cv-info)' }}
            />
            <p className="text-xs font-semibold" style={{ color: 'var(--cv-text)' }}>
              Bottom Nav UI
            </p>
            <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
              Native safe-area
            </p>
          </div>
        </div>

        {/* Primary One-Tap APK Download Button */}
        <div className="space-y-2.5">
          <a
            href={activeDownloadHref}
            download={localApkReady ? manifest.fileName : undefined}
            target={localApkReady ? undefined : '_blank'}
            rel={localApkReady ? undefined : 'noopener noreferrer'}
            onClick={handlePrimaryDownload}
            className="vault-btn-primary w-full py-3 text-sm font-bold"
          >
            <Download className="w-4 h-4" />
            <span>
              {checking
                ? 'Verifying APK Package…'
                : localApkReady
                  ? `Download ${manifest.fileName} (${manifest.estimatedSize})`
                  : `Download ${manifest.fileName} (GitHub Release)`}
            </span>
            {!localApkReady && !checking && <ExternalLink className="w-3.5 h-3.5" />}
          </a>

          {downloadTriggered && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={SPRING_PHYSICS}
              className="px-3.5 py-2 rounded-xl border flex items-center gap-2 text-xs font-medium"
              style={{
                background: 'var(--cv-positive-soft)',
                borderColor: 'var(--cv-positive-border)',
                color: 'var(--cv-positive)',
              }}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {localApkReady
                  ? `Downloading ${manifest.fileName} from ${manifest.downloadPath}…`
                  : 'Opening compiled Android APK release channel…'}
              </span>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {installPrompt && !pwaInstalled ? (
              <button
                type="button"
                onClick={handlePwaClick}
                className="vault-btn-secondary w-full text-xs py-2.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Install Offline App Now (PWA)</span>
              </button>
            ) : (
              <a
                href={manifest.githubActionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="vault-btn-secondary w-full text-xs py-2.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>CI APK Build Pipeline</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                onToggleMobileFrame();
                onClose();
              }}
              className="vault-btn-secondary w-full text-xs py-2.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>
                {mobileFramePreview
                  ? 'Exit Native APK Frame'
                  : 'Preview Native APK UI'}
              </span>
            </button>
          </div>
        </div>

        {/* SHA-256 or Build Status Card */}
        {localApkReady && manifest.sha256 ? (
          <div className="glass-subtle p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold" style={{ color: 'var(--cv-positive)' }}>
                Verified Bundled APK Binary ({manifest.downloadPath})
              </span>
              {manifest.builtAt && (
                <span style={{ color: 'var(--cv-text-muted)' }}>
                  {manifest.builtAt.slice(0, 10)}
                </span>
              )}
            </div>
            <p
              className="text-[11px] font-mono break-all"
              style={{ color: 'var(--cv-text-muted)' }}
            >
              SHA-256: {manifest.sha256}
            </p>
          </div>
        ) : (
          <div className="glass-subtle p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className="text-xs font-semibold flex items-center gap-1.5"
                style={{ color: 'var(--cv-text)' }}
              >
                <Terminal className="w-3.5 h-3.5" style={{ color: 'var(--cv-accent)' }} />
                Capacitor Android Project Synced (/android)
              </span>
              <button
                type="button"
                onClick={handleCopyBuildCommand}
                className="vault-btn-ghost !py-1 !px-2 text-[11px]"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3 h-3" style={{ color: 'var(--cv-positive)' }} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy Command
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--cv-text-muted)' }}>
              Run <code className="font-mono font-semibold" style={{ color: 'var(--cv-accent)' }}>npm run apk:build</code> with
              Android SDK/JDK 21 (or trigger the included GitHub Actions workflow) to compile and place{' '}
              <code className="font-mono">/downloads/chama-vault.apk</code> with its SHA-256 digest automatically.
            </p>
          </div>
        )}

        {/* 3-Step Sideload Instructions */}
        <div className="space-y-2 pt-1">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--cv-text-muted)' }}
          >
            Quick Android Installation
          </p>
          <ol className="space-y-1.5 text-xs" style={{ color: 'var(--cv-text-secondary)' }}>
            <li className="flex items-start gap-2.5">
              <span className="vault-badge-accent !px-2 !py-0 font-mono text-[11px] shrink-0">
                1
              </span>
              <span>
                Tap <strong>Download {manifest.fileName}</strong> on your Android phone and open the downloaded package from Notifications.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="vault-badge-accent !px-2 !py-0 font-mono text-[11px] shrink-0">
                2
              </span>
              <span>
                If prompted by Android, enable <em>Install unknown apps</em> for your browser once, then tap <strong>Install</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="vault-badge-accent !px-2 !py-0 font-mono text-[11px] shrink-0">
                3
              </span>
              <span>
                Open <strong>ChamaVault</strong> — all contributions, merry-go-round queues, and project milestones persist completely offline on your device.
              </span>
            </li>
          </ol>
        </div>
      </div>
    </ModalShell>
  );
};
