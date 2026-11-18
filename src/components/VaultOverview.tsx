import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock,
  FileSpreadsheet,
  FolderKanban,
  Plus,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AuditEntry,
  Contribution,
  FundraiserProject,
  Member,
  PaymentMethod,
  PayoutRecord,
  ProjectContribution,
  VaultSettings,
} from '../db/vaultDb';
import {
  exportFullFinancialReportCsv,
  formatCountdownBadge,
  formatCurrency,
  formatCycleMonth,
  formatDisplayDate,
  getDaysUntil,
  getRecentCycleMonths,
  PAYMENT_METHOD_LABELS,
  SPRING_PHYSICS,
} from '../db/formatters';
import { MerryGoRound } from './MerryGoRound';
import { LogDepositModal } from './ContributionLedger';

interface VaultOverviewProps {
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  payouts: PayoutRecord[];
  projects: FundraiserProject[];
  projectContributions: ProjectContribution[];
  auditLog: AuditEntry[];
  onNavigateTab: (tab: 'vault' | 'members' | 'projects' | 'settings') => void;
  onOpenApkModal: () => void;
}

export const VaultOverview: React.FC<VaultOverviewProps> = ({
  settings,
  members,
  contributions,
  payouts,
  projects,
  projectContributions,
  auditLog,
  onNavigateTab,
  onOpenApkModal,
}) => {
  const isTreasurer = settings.activeRole === 'treasurer';
  const [quickDepositOpen, setQuickDepositOpen] = useState(false);
  const [activeBarMonth, setActiveBarMonth] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const activeMembers = members.filter((m) => m.status === 'active');
    const totalSavings = contributions.reduce((s, c) => s + c.amount, 0);
    const totalProjectRaised = projectContributions.reduce((s, c) => s + c.amount, 0);
    const totalProjectTarget = projects.reduce((s, p) => s + p.targetAmount, 0);
    const totalVaultVolume = totalSavings + totalProjectRaised;

    const cycleExpected = activeMembers.reduce((s, m) => s + m.monthlyTarget, 0);
    let cycleCollected = 0;
    let totalPending = 0;
    let clearedMembers = 0;

    activeMembers.forEach((m) => {
      const paid = contributions
        .filter(
          (c) => c.memberId === m.id && c.cycleMonth === settings.currentCycleMonth
        )
        .reduce((s, c) => s + c.amount, 0);
      cycleCollected += paid;
      const due = Math.max(0, m.monthlyTarget - paid);
      totalPending += due;
      if (due === 0 && m.monthlyTarget > 0) clearedMembers += 1;
    });

    const collectionRate =
      cycleExpected > 0
        ? Math.min(100, Math.round((cycleCollected / cycleExpected) * 100))
        : 0;

    const orderedActive = [...activeMembers].sort(
      (a, b) => a.rotationOrder - b.rotationOrder
    );
    const nextIdx = orderedActive.findIndex(
      (m) => m.rotationOrder >= settings.currentTurnOrder
    );
    const nextBeneficiary =
      orderedActive.length > 0
        ? orderedActive[nextIdx === -1 ? 0 : nextIdx]
        : null;
    const daysToNextPayout = getDaysUntil(settings.nextPayoutDate);
    const nextPot = settings.payoutPotOverride ?? cycleExpected;

    return {
      activeMembersCount: activeMembers.length,
      totalSavings,
      totalProjectRaised,
      totalProjectTarget,
      totalVaultVolume,
      cycleExpected,
      cycleCollected,
      totalPending,
      clearedMembers,
      collectionRate,
      nextBeneficiary,
      daysToNextPayout,
      nextPot,
    };
  }, [members, contributions, projectContributions, projects, settings]);

  // 6-Month Cashflow Chart Series
  const monthlySeries = useMemo(() => {
    const months = getRecentCycleMonths(settings.currentCycleMonth, 6);
    const rows = months.map((ym) => {
      const regular = contributions
        .filter((c) => c.cycleMonth === ym)
        .reduce((s, c) => s + c.amount, 0);
      const project = projectContributions
        .filter((pc) => pc.date.startsWith(ym))
        .reduce((s, pc) => s + pc.amount, 0);
      return {
        ym,
        shortLabel: formatCycleMonth(ym).split(' ')[0],
        fullLabel: formatCycleMonth(ym),
        regular,
        project,
        total: regular + project,
      };
    });
    const maxVal = Math.max(1, ...rows.map((r) => r.total));
    return { rows, maxVal };
  }, [contributions, projectContributions, settings.currentCycleMonth]);

  const highlightedMonth = useMemo(() => {
    if (activeBarMonth) {
      return (
        monthlySeries.rows.find((r) => r.ym === activeBarMonth) ??
        monthlySeries.rows[monthlySeries.rows.length - 1]
      );
    }
    return monthlySeries.rows[monthlySeries.rows.length - 1];
  }, [activeBarMonth, monthlySeries]);

  // Payment Channel Split
  const channelSplit = useMemo(() => {
    const totals: Record<PaymentMethod, number> = {
      mobile_transfer: 0,
      bank_transfer: 0,
      standing_order: 0,
      cash: 0,
    };
    contributions.forEach((c) => {
      totals[c.paymentMethod] += c.amount;
    });
    projectContributions.forEach((pc) => {
      totals[pc.paymentMethod] += pc.amount;
    });
    const grand = Object.values(totals).reduce((s, v) => s + v, 0);
    return (Object.keys(totals) as PaymentMethod[])
      .map((method) => ({
        method,
        label: PAYMENT_METHOD_LABELS[method].short,
        amount: totals[method],
        pct: grand > 0 ? Math.round((totals[method] / grand) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [contributions, projectContributions]);

  const recentAudit = useMemo(
    () =>
      [...auditLog]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 6),
    [auditLog]
  );

  const nextCountdown = formatCountdownBadge(metrics.daysToNextPayout);

  return (
    <div className="space-y-5">
      {/* Executive Vault Hero Surface */}
      <div className="glass-card-hero p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="vault-badge-accent">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{settings.groupName}</span>
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--cv-text-muted)' }}
              >
                {settings.registrationNo}
              </span>
            </div>

            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--cv-text-muted)' }}
              >
                Total Collective Vault Capital
              </p>
              <p
                className="text-3xl sm:text-4xl font-extrabold tabular-nums tracking-tight mt-1"
                style={{ color: 'var(--cv-text)' }}
              >
                {formatCurrency(metrics.totalVaultVolume, settings.currency)}
              </p>
            </div>

            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              <span>
                Ledger Savings:{' '}
                <strong>
                  {formatCurrency(metrics.totalSavings, settings.currency)}
                </strong>
              </span>
              <span style={{ color: 'var(--cv-text-subtle)' }}>•</span>
              <span>
                Project Reserves:{' '}
                <strong style={{ color: 'var(--cv-positive)' }}>
                  {formatCurrency(metrics.totalProjectRaised, settings.currency)}
                </strong>
              </span>
              <span style={{ color: 'var(--cv-text-subtle)' }}>•</span>
              <span>{settings.location}</span>
            </div>
          </div>

          {/* Primary Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {isTreasurer ? (
              <>
                <button
                  type="button"
                  onClick={() => setQuickDepositOpen(true)}
                  className="vault-btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log Deposit</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportFullFinancialReportCsv({
                      settings,
                      members,
                      contributions,
                      payouts,
                      projects,
                      projectContributions,
                    })
                  }
                  className="vault-btn-secondary !py-2.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Report</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateTab('members')}
                className="vault-btn-primary"
              >
                <Wallet className="w-4 h-4" />
                <span>My Savings Passbook</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenApkModal}
              className="vault-btn-secondary !py-2.5 hidden sm:inline-flex"
              title="Download ChamaVault Android APK"
            >
              <Smartphone className="w-4 h-4" />
              <span>Android APK</span>
            </button>
          </div>
        </div>

        {/* Active Cycle Progress Bar */}
        <div
          className="mt-5 pt-4 border-t space-y-2"
          style={{ borderColor: 'var(--cv-border-subtle)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold" style={{ color: 'var(--cv-text)' }}>
              {formatCycleMonth(settings.currentCycleMonth)} Contribution Cycle ·{' '}
              <span style={{ color: 'var(--cv-accent)' }}>
                {metrics.collectionRate}% Collected
              </span>
            </span>
            <span
              className="tabular-nums font-medium"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              {formatCurrency(metrics.cycleCollected, settings.currency)} /{' '}
              {formatCurrency(metrics.cycleExpected, settings.currency)}
            </span>
          </div>
          <div className="vault-progress-track h-2.5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${metrics.collectionRate}%` }}
              transition={SPRING_PHYSICS}
              className="vault-progress-fill h-full rounded-full"
            />
          </div>
        </div>
      </div>

      {/* 3 Quick Navigation Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigateTab('members')}
          className="glass-card p-4 text-left group hover:border-[var(--cv-border-strong)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{
                background: 'var(--cv-accent-soft)',
                borderColor: 'var(--cv-border-subtle)',
                color: 'var(--cv-accent)',
              }}
            >
              <Users className="w-4 h-4" />
            </span>
            <ArrowUpRight
              className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--cv-accent)' }}
            />
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Cycle Standing &amp; Arrears
          </p>
          <p
            className="text-xl font-extrabold tabular-nums mt-0.5"
            style={{ color: 'var(--cv-text)' }}
          >
            {metrics.clearedMembers}/{metrics.activeMembersCount} Cleared
          </p>
          <p
            className="text-xs mt-1 tabular-nums"
            style={{
              color:
                metrics.totalPending > 0 ? 'var(--cv-warning)' : 'var(--cv-positive)',
            }}
          >
            {metrics.totalPending > 0
              ? `${formatCurrency(metrics.totalPending, settings.currency)} pending balance`
              : 'Zero pending balances'}
          </p>
        </button>

        <div className="glass-card p-4 text-left">
          <div className="flex items-center justify-between mb-2">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{
                background: 'var(--cv-positive-soft)',
                borderColor: 'var(--cv-positive-border)',
                color: 'var(--cv-positive)',
              }}
            >
              <Clock className="w-4 h-4" />
            </span>
            <span className="vault-badge-accent text-[11px] tabular-nums">
              {nextCountdown.label}
            </span>
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Next Rotation Payout
          </p>
          <p
            className="text-xl font-extrabold tabular-nums mt-0.5"
            style={{ color: 'var(--cv-text)' }}
          >
            {formatCurrency(metrics.nextPot, settings.currency)}
          </p>
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--cv-text-muted)' }}>
            {metrics.nextBeneficiary
              ? `${metrics.nextBeneficiary.name} · ${formatDisplayDate(
                  settings.nextPayoutDate
                )}`
              : 'No beneficiary queued'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('projects')}
          className="glass-card p-4 text-left group hover:border-[var(--cv-border-strong)] transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className="w-8 h-8 rounded-xl flex items-center justify-center border"
              style={{
                background: 'var(--cv-info-soft)',
                borderColor: 'var(--cv-info-border)',
                color: 'var(--cv-info)',
              }}
            >
              <FolderKanban className="w-4 h-4" />
            </span>
            <ArrowUpRight
              className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--cv-accent)' }}
            />
          </div>
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Project &amp; Event Goals
          </p>
          <p
            className="text-xl font-extrabold tabular-nums mt-0.5"
            style={{ color: 'var(--cv-text)' }}
          >
            {formatCurrency(metrics.totalProjectRaised, settings.currency, true)}
          </p>
          <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--cv-text-muted)' }}>
            {metrics.totalProjectTarget > 0
              ? `${Math.min(
                  100,
                  Math.round(
                    (metrics.totalProjectRaised / metrics.totalProjectTarget) * 100
                  )
                )}% of ${formatCurrency(
                  metrics.totalProjectTarget,
                  settings.currency,
                  true
                )} across ${projects.length} projects`
              : 'Create a collective project goal'}
          </p>
        </button>
      </div>

      {/* Analytics Row: 6-Month Vault Inflows + Payment Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 glass-card p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                className="text-sm font-bold flex items-center gap-2"
                style={{ color: 'var(--cv-text)' }}
              >
                <BarChart3 className="w-4 h-4" style={{ color: 'var(--cv-accent)' }} />
                6-Month Vault Inflow Velocity
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
                Select any month bar to inspect savings vs fundraiser inflows
              </p>
            </div>

            {highlightedMonth && (
              <div className="sm:text-right">
                <p
                  className="text-sm font-extrabold tabular-nums"
                  style={{ color: 'var(--cv-text)' }}
                >
                  {formatCurrency(highlightedMonth.total, settings.currency)}
                </p>
                <p
                  className="text-[11px] tabular-nums"
                  style={{ color: 'var(--cv-text-muted)' }}
                >
                  {highlightedMonth.fullLabel}:{' '}
                  {formatCurrency(highlightedMonth.regular, settings.currency, true)} savings +{' '}
                  {formatCurrency(highlightedMonth.project, settings.currency, true)} projects
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-6 gap-2 sm:gap-3 items-end h-36 pt-2">
            {monthlySeries.rows.map((bar) => {
              const regPct = Math.round((bar.regular / monthlySeries.maxVal) * 100);
              const prjPct = Math.round((bar.project / monthlySeries.maxVal) * 100);
              const isSelected = highlightedMonth?.ym === bar.ym;

              return (
                <button
                  key={bar.ym}
                  type="button"
                  onMouseEnter={() => setActiveBarMonth(bar.ym)}
                  onFocus={() => setActiveBarMonth(bar.ym)}
                  onClick={() => setActiveBarMonth(bar.ym)}
                  className="group flex flex-col items-center gap-1.5 h-full justify-end focus:outline-none"
                >
                  <div
                    className="w-full max-w-[44px] flex-1 flex flex-col justify-end rounded-xl p-1 border transition-colors"
                    style={{
                      background: isSelected
                        ? 'var(--cv-accent-soft)'
                        : 'var(--cv-surface-subtle)',
                      borderColor: isSelected
                        ? 'var(--cv-border-strong)'
                        : 'transparent',
                    }}
                  >
                    <div className="w-full h-full flex flex-col justify-end gap-0.5 overflow-hidden rounded-lg">
                      {prjPct > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(5, prjPct)}%` }}
                          transition={SPRING_PHYSICS}
                          className="w-full rounded-t-md"
                          style={{ background: 'var(--cv-chart-secondary)' }}
                        />
                      )}
                      {regPct > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(6, regPct)}%` }}
                          transition={SPRING_PHYSICS}
                          className="w-full rounded-b-md rounded-t-sm"
                          style={{ background: 'var(--cv-btn-grad)' }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{
                      color: isSelected ? 'var(--cv-text)' : 'var(--cv-text-muted)',
                    }}
                  >
                    {bar.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="flex items-center gap-4 text-[11px]"
            style={{ color: 'var(--cv-text-muted)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: 'var(--cv-accent)' }}
              />
              Regular Savings
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: 'var(--cv-chart-secondary)' }}
              />
              Project Fundraisers
            </span>
          </div>
        </div>

        {/* Payment Method Mix */}
        <div className="lg:col-span-5 glass-card p-5 flex flex-col justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
              Deposit Channel Mix
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
              Verified inflows across mobile money, bank &amp; table cash
            </p>
          </div>

          <div className="space-y-3 my-auto py-1">
            {channelSplit.map((ch) => (
              <div key={ch.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className="font-medium"
                    style={{ color: 'var(--cv-text-secondary)' }}
                  >
                    {ch.label}
                  </span>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: 'var(--cv-text)' }}
                  >
                    {formatCurrency(ch.amount, settings.currency, true)}{' '}
                    <span
                      className="font-normal"
                      style={{ color: 'var(--cv-text-muted)' }}
                    >
                      ({ch.pct}%)
                    </span>
                  </span>
                </div>
                <div className="vault-progress-track h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ch.pct}%` }}
                    transition={SPRING_PHYSICS}
                    className="vault-progress-fill h-full rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Merry-Go-Round & Payout Queue Module */}
      <MerryGoRound
        settings={settings}
        members={members}
        contributions={contributions}
        payouts={payouts}
      />

      {/* Transparent Audit Activity Feed */}
      <div className="glass-card overflow-hidden">
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-2"
          style={{ borderColor: 'var(--cv-border-subtle)' }}
        >
          <h2
            className="text-sm font-bold flex items-center gap-2"
            style={{ color: 'var(--cv-text)' }}
          >
            <Activity className="w-4 h-4" style={{ color: 'var(--cv-accent)' }} />
            Recent Vault Ledger Activity
          </h2>
          <span className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
            Offline-verified log
          </span>
        </div>

        {recentAudit.length === 0 ? (
          <div
            className="p-6 text-center text-xs"
            style={{ color: 'var(--cv-text-muted)' }}
          >
            Vault activity entries will appear here as deposits and payouts are logged.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--cv-border-subtle)' }}>
            {recentAudit.map((entry) => (
              <div
                key={entry.id}
                className="px-5 py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p
                    className="font-medium truncate"
                    style={{ color: 'var(--cv-text)' }}
                  >
                    {entry.summary}
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: 'var(--cv-text-muted)' }}
                  >
                    {formatDisplayDate(entry.timestamp.slice(0, 10))} · {entry.actor}
                  </p>
                </div>
                {typeof entry.amount === 'number' && entry.amount > 0 && (
                  <span
                    className="font-bold tabular-nums shrink-0"
                    style={{
                      color:
                        entry.category === 'payout'
                          ? 'var(--cv-accent)'
                          : 'var(--cv-positive)',
                    }}
                  >
                    {formatCurrency(entry.amount, settings.currency)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Deposit Modal */}
      <LogDepositModal
        open={quickDepositOpen}
        onClose={() => setQuickDepositOpen(false)}
        settings={settings}
        members={members}
        contributions={contributions}
      />
    </div>
  );
};
