import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CheckCircle2,
  Clock,
  FastForward,
  History,
  Lock,
  RefreshCw,
  Send,
  Settings2,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  type Contribution,
  disburseRotationPayout,
  type Member,
  type PaymentMethod,
  type PayoutRecord,
  setNextRotationBeneficiary,
  skipCurrentRotationTurn,
  swapMemberRotationSlots,
  updateVaultSettings,
  type VaultSettings,
} from '../db/vaultDb';
import {
  addDaysToIso,
  formatCountdownBadge,
  formatCurrency,
  formatDisplayDate,
  generateReceiptRef,
  getDaysUntil,
  getInitials,
  PAYMENT_METHOD_LABELS,
  SPRING_PHYSICS,
  todayIso,
} from '../db/formatters';
import { ModalShell, SuccessCheckmarkView } from './ModalShell';

interface MerryGoRoundProps {
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  payouts: PayoutRecord[];
  isMobileLayout?: boolean;
}

function CountdownPill({ days }: { days: number }) {
  const badge = formatCountdownBadge(days);
  const cls =
    badge.tone === 'positive'
      ? 'vault-badge-positive'
      : badge.tone === 'warning'
        ? 'vault-badge-warning'
        : badge.tone === 'danger'
          ? 'vault-badge-danger'
          : badge.tone === 'info'
            ? 'vault-badge-info'
            : 'vault-badge-accent';

  return (
    <span className={`${cls} tabular-nums whitespace-nowrap`}>
      <Clock className="w-3 h-3 shrink-0" />
      <span>{badge.label}</span>
    </span>
  );
}

export const MerryGoRound: React.FC<MerryGoRoundProps> = ({
  settings,
  members,
  contributions,
  payouts,
}) => {
  const isTreasurer = settings.activeRole === 'treasurer';
  const [subTab, setSubTab] = useState<'queue' | 'history'>('queue');

  // Disburse Modal State
  const [disburseOpen, setDisburseOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutDate, setPayoutDate] = useState(todayIso());
  const [payoutMethod, setPayoutMethod] = useState<PaymentMethod>('mobile_transfer');
  const [payoutRef, setPayoutRef] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [payoutReceipt, setPayoutReceipt] = useState<{
    recipientName: string;
    amount: number;
    date: string;
    method: PaymentMethod;
    ref: string;
    nextRecipientName: string;
  } | null>(null);

  // Schedule Modal State
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [nextDateInput, setNextDateInput] = useState(settings.nextPayoutDate);
  const [intervalInput, setIntervalInput] = useState(String(settings.rotationIntervalDays));
  const [potOverrideInput, setPotOverrideInput] = useState(
    settings.payoutPotOverride ? String(settings.payoutPotOverride) : ''
  );

  // Defer Modal State
  const [deferOpen, setDeferOpen] = useState(false);
  const [deferReason, setDeferReason] = useState('');

  const orderedActiveMembers = useMemo(
    () =>
      [...members]
        .filter((m) => m.status === 'active')
        .sort((a, b) => a.rotationOrder - b.rotationOrder),
    [members]
  );

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id!, m])),
    [members]
  );

  const autoPotAmount = useMemo(() => {
    const sumTargets = orderedActiveMembers.reduce((s, m) => s + m.monthlyTarget, 0);
    return sumTargets > 0 ? sumTargets : settings.defaultTarget * orderedActiveMembers.length;
  }, [orderedActiveMembers, settings.defaultTarget]);

  const effectivePot = settings.payoutPotOverride ?? autoPotAmount;

  // Build turn-ordered upcoming schedule starting from currentTurnOrder
  const rotationQueue = useMemo(() => {
    if (orderedActiveMembers.length === 0) return [];
    const foundIdx = orderedActiveMembers.findIndex(
      (m) => m.rotationOrder >= settings.currentTurnOrder
    );
    const startIdx = foundIdx === -1 ? 0 : foundIdx;

    const roundPaidMemberIds = new Set(
      payouts
        .filter((p) => p.roundNumber === settings.currentRound && p.status === 'completed')
        .map((p) => p.memberId)
    );

    return orderedActiveMembers.map((_, offset) => {
      const idx = (startIdx + offset) % orderedActiveMembers.length;
      const member = orderedActiveMembers[idx];
      const wrapsToNextRound = startIdx + offset >= orderedActiveMembers.length;
      const scheduledDate = addDaysToIso(
        settings.nextPayoutDate,
        offset * (settings.rotationIntervalDays || 30)
      );
      const daysUntil = getDaysUntil(scheduledDate);
      const cyclePaid = contributions
        .filter(
          (c) =>
            c.memberId === member.id &&
            c.cycleMonth === settings.currentCycleMonth
        )
        .reduce((s, c) => s + c.amount, 0);
      const cycleCleared = cyclePaid >= member.monthlyTarget && member.monthlyTarget > 0;
      const receivedThisRound = roundPaidMemberIds.has(member.id!);

      return {
        queuePosition: offset + 1,
        member,
        scheduledDate,
        daysUntil,
        projectedRound: wrapsToNextRound
          ? settings.currentRound + 1
          : settings.currentRound,
        cyclePaid,
        cycleCleared,
        receivedThisRound,
        rawIndex: idx,
      };
    });
  }, [orderedActiveMembers, settings, payouts, contributions]);

  const sortedHistory = useMemo(
    () =>
      [...payouts].sort(
        (a, b) =>
          b.paidDate.localeCompare(a.paidDate) || (b.id ?? 0) - (a.id ?? 0)
      ),
    [payouts]
  );

  const previousPayout = sortedHistory[0] ?? null;
  const previousWinner = previousPayout
    ? memberMap.get(previousPayout.memberId) ?? null
    : null;
  const nextTurn = rotationQueue[0] ?? null;

  const roundCompletedCount = useMemo(() => {
    const unique = new Set(
      payouts
        .filter((p) => p.roundNumber === settings.currentRound && p.status === 'completed')
        .map((p) => p.memberId)
    );
    return unique.size;
  }, [payouts, settings.currentRound]);

  const totalDisbursedAllTime = useMemo(
    () => payouts.reduce((sum, p) => sum + p.amount, 0),
    [payouts]
  );

  const openDisburseModal = () => {
    if (!nextTurn || !isTreasurer) return;
    setPayoutReceipt(null);
    setPayoutAmount(String(effectivePot));
    setPayoutDate(todayIso());
    setPayoutMethod('mobile_transfer');
    setPayoutRef(generateReceiptRef(`MGR-R${settings.currentRound}`));
    setPayoutNotes(
      `Round ${settings.currentRound} merry-go-round rotation payout to ${nextTurn.member.name}`
    );
    setDisburseOpen(true);
  };

  const handleDisburseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextTurn || !isTreasurer) return;
    const numAmount = Number(payoutAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return;

    setSubmitting(true);
    try {
      const upcomingAfter =
        rotationQueue[1]?.member.name ?? nextTurn.member.name;
      const finalRef = payoutRef.trim() || generateReceiptRef('MGR');
      await disburseRotationPayout({
        memberId: nextTurn.member.id!,
        amount: numAmount,
        paidDate: payoutDate,
        paymentMethod: payoutMethod,
        referenceCode: finalRef,
        notes: payoutNotes,
      });
      setPayoutReceipt({
        recipientName: nextTurn.member.name,
        amount: numAmount,
        date: payoutDate,
        method: payoutMethod,
        ref: finalRef,
        nextRecipientName: upcomingAfter,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openScheduleModal = () => {
    setNextDateInput(settings.nextPayoutDate);
    setIntervalInput(String(settings.rotationIntervalDays));
    setPotOverrideInput(
      settings.payoutPotOverride ? String(settings.payoutPotOverride) : ''
    );
    setScheduleOpen(true);
  };

  const handleScheduleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const interval = Math.max(1, Math.min(365, parseInt(intervalInput, 10) || 30));
    const overrideVal = potOverrideInput.trim()
      ? Math.max(1, Number(potOverrideInput))
      : null;

    await updateVaultSettings(
      {
        nextPayoutDate: nextDateInput || settings.nextPayoutDate,
        rotationIntervalDays: interval,
        payoutPotOverride: overrideVal,
      },
      {
        auditSummary: `Updated rotation schedule: next payout ${formatDisplayDate(
          nextDateInput
        )}, every ${interval} days`,
      }
    );
    setScheduleOpen(false);
  };

  const handleDeferConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    await skipCurrentRotationTurn(deferReason);
    setDeferReason('');
    setDeferOpen(false);
  };

  const roundProgressPct =
    orderedActiveMembers.length > 0
      ? Math.min(100, Math.round((roundCompletedCount / orderedActiveMembers.length) * 100))
      : 0;

  return (
    <section className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" style={{ color: 'var(--cv-accent)' }} />
            <h2
              className="text-base sm:text-lg font-bold tracking-tight"
              style={{ color: 'var(--cv-text)' }}
            >
              Merry-Go-Round &amp; Payout Queue
            </h2>
            <span className="vault-badge-accent text-[11px]">
              Round {settings.currentRound}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
            Every {settings.rotationIntervalDays} days · {roundCompletedCount} of{' '}
            {orderedActiveMembers.length} active members paid this round ({roundProgressPct}%)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isTreasurer && (
            <button
              type="button"
              onClick={openScheduleModal}
              className="vault-btn-secondary !py-1.5 !px-3 !text-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
          )}

          <div
            className="inline-flex p-1 rounded-xl border"
            style={{
              background: 'var(--cv-surface-subtle)',
              borderColor: 'var(--cv-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setSubTab('queue')}
              className="relative px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{
                color:
                  subTab === 'queue'
                    ? 'var(--cv-accent-contrast)'
                    : 'var(--cv-text-secondary)',
              }}
            >
              {subTab === 'queue' && (
                <motion.span
                  layoutId="mgr-subtab-pill"
                  transition={SPRING_PHYSICS}
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--cv-btn-grad)' }}
                />
              )}
              <span className="relative z-10">
                Queue ({rotationQueue.length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('history')}
              className="relative px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
              style={{
                color:
                  subTab === 'history'
                    ? 'var(--cv-accent-contrast)'
                    : 'var(--cv-text-secondary)',
              }}
            >
              {subTab === 'history' && (
                <motion.span
                  layoutId="mgr-subtab-pill"
                  transition={SPRING_PHYSICS}
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--cv-btn-grad)' }}
                />
              )}
              <span className="relative z-10">
                History ({sortedHistory.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Spotlight Pair: Up Next Beneficiary + Previous Payout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Up Next Beneficiary Card */}
        <div className="lg:col-span-7 glass-card-hero p-5 flex flex-col justify-between gap-4">
          {nextTurn ? (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${nextTurn.member.avatarHue} text-white font-bold text-sm flex items-center justify-center shadow-md shrink-0`}
                  >
                    {getInitials(nextTurn.member.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[11px] font-bold uppercase tracking-wider"
                        style={{ color: 'var(--cv-accent)' }}
                      >
                        Up Next · Slot #{nextTurn.member.rotationOrder}
                      </span>
                      {settings.activeRole === 'member' &&
                        settings.viewingMemberId === nextTurn.member.id && (
                          <span className="vault-badge-positive text-[10px]">
                            <Sparkles className="w-3 h-3" /> Your Turn
                          </span>
                        )}
                    </div>
                    <h3
                      className="text-lg font-extrabold tracking-tight truncate"
                      style={{ color: 'var(--cv-text)' }}
                    >
                      {nextTurn.member.name}
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                      {nextTurn.member.memberCode} · Scheduled{' '}
                      <strong style={{ color: 'var(--cv-text-secondary)' }}>
                        {formatDisplayDate(nextTurn.scheduledDate)}
                      </strong>
                    </p>
                  </div>
                </div>

                <CountdownPill days={nextTurn.daysUntil} />
              </div>

              <div className="glass-subtle p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p
                    className="text-[11px] font-medium uppercase tracking-wider"
                    style={{ color: 'var(--cv-text-muted)' }}
                  >
                    Scheduled Rotation Pot
                  </p>
                  <p
                    className="text-2xl font-extrabold tabular-nums tracking-tight mt-0.5"
                    style={{ color: 'var(--cv-text)' }}
                  >
                    {formatCurrency(effectivePot, settings.currency)}
                  </p>
                </div>

                <div className="sm:text-right">
                  <span
                    className={
                      nextTurn.cycleCleared
                        ? 'vault-badge-positive'
                        : 'vault-badge-warning'
                    }
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {nextTurn.cycleCleared
                      ? 'Cycle Contribution Cleared'
                      : `Paid ${formatCurrency(nextTurn.cyclePaid, settings.currency, true)} of target`}
                  </span>
                  <p
                    className="text-[11px] mt-1"
                    style={{ color: 'var(--cv-text-muted)' }}
                  >
                    {orderedActiveMembers.length} active contributors pooled
                  </p>
                </div>
              </div>

              {isTreasurer ? (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={openDisburseModal}
                    className="vault-btn-primary flex-1 min-w-[170px]"
                  >
                    <Send className="w-4 h-4" />
                    <span>Record Payout</span>
                  </button>
                  {orderedActiveMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeferOpen(true)}
                      className="vault-btn-secondary !py-2.5"
                      title="Defer current member's payout turn"
                    >
                      <FastForward className="w-4 h-4" />
                      <span>Defer Turn</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl border"
                  style={{
                    background: 'var(--cv-surface-subtle)',
                    borderColor: 'var(--cv-border-subtle)',
                    color: 'var(--cv-text-muted)',
                  }}
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Member view — payout disbursement is restricted to Group Treasurer.
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <CalendarClock
                className="w-8 h-8 mx-auto mb-2"
                style={{ color: 'var(--cv-text-muted)' }}
              />
              <p className="text-sm font-semibold" style={{ color: 'var(--cv-text)' }}>
                No Active Members in Rotation
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--cv-text-muted)' }}>
                Register active group members in the Members tab to auto-generate the merry-go-round schedule.
              </p>
            </div>
          )}
        </div>

        {/* Previous Payout Recipient Card */}
        <div className="lg:col-span-5 glass-card p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span
                className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: 'var(--cv-text-muted)' }}
              >
                <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--cv-positive)' }} />
                Previous Payout
              </span>
              {previousPayout && (
                <span className="vault-badge-positive text-[11px]">
                  Disbursed
                </span>
              )}
            </div>

            {previousPayout ? (
              <div className="space-y-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${
                      previousWinner?.avatarHue ?? 'from-emerald-500 to-teal-600'
                    } text-white font-bold text-xs flex items-center justify-center shrink-0`}
                  >
                    {getInitials(previousWinner?.name ?? 'Member')}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-base font-bold truncate"
                      style={{ color: 'var(--cv-text)' }}
                    >
                      {previousWinner?.name ?? 'Former Member'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                      Round {previousPayout.roundNumber} · Cycle #{previousPayout.cycleNumber} ·{' '}
                      {formatDisplayDate(previousPayout.paidDate)}
                    </p>
                  </div>
                </div>

                <div className="glass-subtle p-3 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                      Amount Received
                    </span>
                    <span
                      className="text-lg font-extrabold tabular-nums"
                      style={{ color: 'var(--cv-positive)' }}
                    >
                      {formatCurrency(previousPayout.amount, settings.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span style={{ color: 'var(--cv-text-muted)' }}>Channel</span>
                    <span style={{ color: 'var(--cv-text-secondary)' }}>
                      {PAYMENT_METHOD_LABELS[previousPayout.paymentMethod].short}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span style={{ color: 'var(--cv-text-muted)' }}>Receipt Ref</span>
                    <span
                      className="font-mono font-semibold"
                      style={{ color: 'var(--cv-text)' }}
                    >
                      {previousPayout.referenceCode}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <History
                  className="w-7 h-7 mx-auto mb-2"
                  style={{ color: 'var(--cv-text-subtle)' }}
                />
                <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                  No payouts recorded yet. Disburse Cycle #1 when ready.
                </p>
              </div>
            )}
          </div>

          {/* Round Progress Footer */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span style={{ color: 'var(--cv-text-muted)' }}>
                Round {settings.currentRound} Completion
              </span>
              <span
                className="font-semibold tabular-nums"
                style={{ color: 'var(--cv-text)' }}
              >
                {roundCompletedCount}/{orderedActiveMembers.length} turns ·{' '}
                {formatCurrency(totalDisbursedAllTime, settings.currency, true)} total
              </span>
            </div>
            <div className="vault-progress-track h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${roundProgressPct}%` }}
                transition={SPRING_PHYSICS}
                className="vault-progress-fill h-full rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Beneficiary Queue OR Historical Payout Ledger */}
      <AnimatePresence mode="wait">
        {subTab === 'queue' ? (
          <motion.div
            key="mgr-queue"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING_PHYSICS}
            className="glass-card overflow-hidden"
          >
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between gap-2"
              style={{ borderColor: 'var(--cv-border-subtle)' }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
                Upcoming Beneficiary Queue
              </h3>
              <span className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                Auto-calculated countdowns
              </span>
            </div>

            {rotationQueue.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                Queue will populate automatically as active members are added.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--cv-border-subtle)' }}>
                {rotationQueue.map((slot, queueIdx) => {
                  const isUpNext = slot.queuePosition === 1;
                  const prevSlot = queueIdx > 0 ? rotationQueue[queueIdx - 1] : null;
                  const nextSlot =
                    queueIdx < rotationQueue.length - 1
                      ? rotationQueue[queueIdx + 1]
                      : null;
                  const isViewingSelf =
                    settings.activeRole === 'member' &&
                    settings.viewingMemberId === slot.member.id;

                  return (
                    <div
                      key={slot.member.id}
                      className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                      style={{
                        background: isUpNext
                          ? 'var(--cv-accent-soft)'
                          : isViewingSelf
                            ? 'var(--cv-info-soft)'
                            : 'transparent',
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono tabular-nums border shrink-0"
                          style={{
                            background: isUpNext
                              ? 'var(--cv-btn-grad)'
                              : 'var(--cv-surface-subtle)',
                            color: isUpNext
                              ? 'var(--cv-accent-contrast)'
                              : 'var(--cv-text-secondary)',
                            borderColor: 'var(--cv-border-subtle)',
                          }}
                        >
                          {slot.queuePosition}
                        </div>

                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${slot.member.avatarHue} text-white font-bold text-xs flex items-center justify-center shrink-0`}
                        >
                          {getInitials(slot.member.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="text-sm font-semibold truncate"
                              style={{ color: 'var(--cv-text)' }}
                            >
                              {slot.member.name}
                            </p>
                            {isViewingSelf && (
                              <span className="vault-badge-info text-[10px] !py-0">
                                You
                              </span>
                            )}
                            {slot.receivedThisRound && !isUpNext && (
                              <span className="vault-badge-positive text-[10px] !py-0">
                                Paid R{settings.currentRound}
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs tabular-nums"
                            style={{ color: 'var(--cv-text-muted)' }}
                          >
                            Slot #{slot.member.rotationOrder} · Round {slot.projectedRound} ·{' '}
                            {formatDisplayDate(slot.scheduledDate)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-10 sm:pl-0">
                        <span
                          className="text-xs font-bold tabular-nums hidden md:inline"
                          style={{ color: 'var(--cv-text-secondary)' }}
                        >
                          {formatCurrency(effectivePot, settings.currency)}
                        </span>

                        <CountdownPill days={slot.daysUntil} />

                        {isTreasurer && (
                          <div className="inline-flex items-center gap-1">
                            {!isUpNext && (
                              <button
                                type="button"
                                onClick={() => setNextRotationBeneficiary(slot.member.id!)}
                                className="vault-btn-ghost !px-2 !py-1 text-[11px] hidden sm:inline-flex"
                                title="Set as immediate next beneficiary"
                              >
                                Set Next
                              </button>
                            )}
                            <button
                              type="button"
                              aria-label={`Move ${slot.member.name} earlier in rotation`}
                              disabled={!prevSlot}
                              onClick={() =>
                                prevSlot &&
                                swapMemberRotationSlots(
                                  slot.member.id!,
                                  prevSlot.member.id!
                                )
                              }
                              className="p-1.5 rounded-lg border disabled:opacity-30 transition-colors"
                              style={{
                                borderColor: 'var(--cv-border-subtle)',
                                color: 'var(--cv-text-secondary)',
                              }}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${slot.member.name} later in rotation`}
                              disabled={!nextSlot}
                              onClick={() =>
                                nextSlot &&
                                swapMemberRotationSlots(
                                  slot.member.id!,
                                  nextSlot.member.id!
                                )
                              }
                              className="p-1.5 rounded-lg border disabled:opacity-30 transition-colors"
                              style={{
                                borderColor: 'var(--cv-border-subtle)',
                                color: 'var(--cv-text-secondary)',
                              }}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="mgr-history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING_PHYSICS}
            className="glass-card overflow-hidden"
          >
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between gap-2"
              style={{ borderColor: 'var(--cv-border-subtle)' }}
            >
              <h3 className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
                Completed Payout Ledger
              </h3>
              <span
                className="text-xs font-semibold tabular-nums"
                style={{ color: 'var(--cv-positive)' }}
              >
                Total: {formatCurrency(totalDisbursedAllTime, settings.currency)}
              </span>
            </div>

            {sortedHistory.length === 0 ? (
              <div className="p-8 text-center text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                No rotation disbursements recorded yet.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--cv-border-subtle)' }}>
                {sortedHistory.map((item) => {
                  const recipient = memberMap.get(item.memberId);
                  return (
                    <div
                      key={item.id}
                      className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${
                            recipient?.avatarHue ?? 'from-amber-500 to-orange-600'
                          } text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5`}
                        >
                          {getInitials(recipient?.name ?? 'CV')}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: 'var(--cv-text)' }}
                            >
                              {recipient?.name ?? 'Former Member'}
                            </p>
                            <span className="vault-badge-accent text-[10px] !py-0">
                              R{item.roundNumber} · Cycle #{item.cycleNumber}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                            {formatDisplayDate(item.paidDate)} ·{' '}
                            {PAYMENT_METHOD_LABELS[item.paymentMethod].short} ·{' '}
                            <span className="font-mono">{item.referenceCode}</span>
                          </p>
                          {item.notes && (
                            <p
                              className="text-xs mt-0.5 truncate max-w-lg"
                              style={{ color: 'var(--cv-text-subtle)' }}
                            >
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="sm:text-right pl-12 sm:pl-0 shrink-0">
                        <p
                          className="text-sm font-extrabold tabular-nums"
                          style={{ color: 'var(--cv-positive)' }}
                        >
                          {formatCurrency(item.amount, settings.currency)}
                        </p>
                        <span className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                          Settled
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disburse Payout Modal */}
      <ModalShell
        open={disburseOpen}
        onClose={() => setDisburseOpen(false)}
        title={payoutReceipt ? 'Payout Confirmed' : 'Record Merry-Go-Round Payout'}
        subtitle={
          payoutReceipt
            ? undefined
            : `Disburse Round ${settings.currentRound} pot to ${nextTurn?.member.name ?? ''} and advance queue.`
        }
      >
        {payoutReceipt ? (
          <SuccessCheckmarkView
            title="Rotation Pot Disbursed"
            amountFormatted={formatCurrency(payoutReceipt.amount, settings.currency)}
            subtitle={`Paid to ${payoutReceipt.recipientName} · Queue automatically advanced`}
            details={[
              { label: 'Beneficiary', value: payoutReceipt.recipientName },
              {
                label: 'Payment Method',
                value: PAYMENT_METHOD_LABELS[payoutReceipt.method].label,
              },
              { label: 'Receipt Reference', value: payoutReceipt.ref, mono: true },
              { label: 'Date Paid', value: formatDisplayDate(payoutReceipt.date) },
              { label: 'Next in Queue', value: payoutReceipt.nextRecipientName },
            ]}
            onDone={() => setDisburseOpen(false)}
          />
        ) : (
          <form onSubmit={handleDisburseSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--cv-text-secondary)' }}
                >
                  Payout Amount ({settings.currency})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="vault-input tabular-nums font-semibold"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--cv-text-secondary)' }}
                >
                  Disbursement Date
                </label>
                <input
                  type="date"
                  required
                  value={payoutDate}
                  onChange={(e) => setPayoutDate(e.target.value)}
                  className="vault-input tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--cv-text-secondary)' }}
                >
                  Payment Channel
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as PaymentMethod)}
                  className="vault-input"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                    <option key={k} value={k}>
                      {PAYMENT_METHOD_LABELS[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--cv-text-secondary)' }}
                >
                  Transaction Reference
                </label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g. MGR-R1C4-920"
                  className="vault-input font-mono"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Treasurer Note
              </label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="Witnessed by officials / transfer confirmation"
                className="vault-input"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDisburseOpen(false)}
                className="vault-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="vault-btn-primary"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'Recording…' : 'Confirm Disbursement'}</span>
              </button>
            </div>
          </form>
        )}
      </ModalShell>

      {/* Configure Schedule Modal */}
      <ModalShell
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Configure Rotation Schedule"
        subtitle="Adjust next payout date, cycle interval, and optional fixed pot size."
      >
        <form onSubmit={handleScheduleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Next Payout Date
              </label>
              <input
                type="date"
                required
                value={nextDateInput}
                onChange={(e) => setNextDateInput(e.target.value)}
                className="vault-input tabular-nums"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Rotation Interval (Days)
              </label>
              <input
                type="number"
                required
                min="1"
                max="365"
                value={intervalInput}
                onChange={(e) => setIntervalInput(e.target.value)}
                className="vault-input tabular-nums"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Custom Fixed Pot ({settings.currency}) — leave blank for auto-sum (
              {formatCurrency(autoPotAmount, settings.currency)})
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={potOverrideInput}
              onChange={(e) => setPotOverrideInput(e.target.value)}
              placeholder={`Auto: ${autoPotAmount}`}
              className="vault-input tabular-nums"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setScheduleOpen(false)}
              className="vault-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="vault-btn-primary">
              Save Schedule
            </button>
          </div>
        </form>
      </ModalShell>

      {/* Defer Turn Modal */}
      <ModalShell
        open={deferOpen}
        onClose={() => setDeferOpen(false)}
        title="Defer Current Payout Turn"
        subtitle={`Move past ${nextTurn?.member.name ?? 'current member'} so the following member receives the upcoming payout.`}
      >
        <form onSubmit={handleDeferConfirm} className="space-y-3.5">
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Reason for Deferral (Logged in Audit Trail)
            </label>
            <input
              type="text"
              value={deferReason}
              onChange={(e) => setDeferReason(e.target.value)}
              placeholder="e.g. Requested swap to later cycle / pending arrears"
              className="vault-input"
            />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setDeferOpen(false)}
              className="vault-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="vault-btn-primary">
              <FastForward className="w-4 h-4" />
              <span>Confirm Deferral</span>
            </button>
          </div>
        </form>
      </ModalShell>
    </section>
  );
};
