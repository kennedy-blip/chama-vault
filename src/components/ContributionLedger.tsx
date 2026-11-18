import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownToLine,
  Building2,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Lock,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  type Contribution,
  type ContributionCategory,
  deleteContribution,
  deleteMemberRecord,
  type FundraiserProject,
  logContribution,
  type Member,
  type PaymentMethod,
  type ProjectContribution,
  registerMember,
  updateContribution,
  updateMemberProfile,
  updateVaultSettings,
  type VaultSettings,
} from '../db/vaultDb';
import {
  CONTRIBUTION_CATEGORY_LABELS,
  exportFullFinancialReportCsv,
  exportMemberStatementCsv,
  formatCurrency,
  formatCycleMonth,
  formatDisplayDate,
  generateReceiptRef,
  getInitials,
  getRecentCycleMonths,
  PAYMENT_METHOD_LABELS,
  SPRING_PHYSICS,
  todayIso,
} from '../db/formatters';
import type { PayoutRecord } from '../db/vaultDb';
import { ModalShell, SuccessCheckmarkView } from './ModalShell';

interface DepositModalProps {
  open: boolean;
  onClose: () => void;
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  defaultMemberId?: number;
  editingEntry?: Contribution | null;
}

export const LogDepositModal: React.FC<DepositModalProps> = ({
  open,
  onClose,
  settings,
  members,
  contributions,
  defaultMemberId,
  editingEntry = null,
}) => {
  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );
  const selectableMembers = activeMembers.length > 0 ? activeMembers : members;

  const [memberId, setMemberId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayIso());
  const [cycleMonth, setCycleMonth] = useState(settings.currentCycleMonth);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile_transfer');
  const [category, setCategory] = useState<ContributionCategory>('regular');
  const [referenceCode, setReferenceCode] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<{
    memberName: string;
    amount: number;
    cycleMonth: string;
    date: string;
    method: PaymentMethod;
    ref: string;
    remainingPending: number;
  } | null>(null);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) ?? selectableMembers[0] ?? null,
    [members, selectableMembers, memberId]
  );

  const selectedMemberPending = useMemo(() => {
    if (!selectedMember) return 0;
    const paid = contributions
      .filter((c) => c.memberId === selectedMember.id && c.cycleMonth === cycleMonth)
      .reduce((sum, c) => sum + c.amount, 0);
    return Math.max(0, selectedMember.monthlyTarget - paid);
  }, [selectedMember, contributions, cycleMonth]);

  const initializeForm = (preferredId?: number) => {
    const targetMember =
      selectableMembers.find((m) => m.id === preferredId) ?? selectableMembers[0];
    const targetId = targetMember?.id ?? 0;
    setMemberId(targetId);
    setCycleMonth(settings.currentCycleMonth);
    setDate(todayIso());
    setPaymentMethod('mobile_transfer');
    setCategory('regular');
    setReferenceCode(generateReceiptRef('SKV'));
    setNote('');
    setReceipt(null);

    if (targetMember) {
      const paid = contributions
        .filter(
          (c) =>
            c.memberId === targetMember.id &&
            c.cycleMonth === settings.currentCycleMonth
        )
        .reduce((s, c) => s + c.amount, 0);
      const rem = Math.max(0, targetMember.monthlyTarget - paid);
      setAmount(String(rem > 0 ? rem : targetMember.monthlyTarget));
    } else {
      setAmount(String(settings.defaultTarget));
    }
  };

  useEffect(() => {
    if (!open) return;
    if (editingEntry) {
      setMemberId(editingEntry.memberId);
      setAmount(String(editingEntry.amount));
      setDate(editingEntry.date);
      setCycleMonth(editingEntry.cycleMonth);
      setPaymentMethod(editingEntry.paymentMethod);
      setCategory(editingEntry.category);
      setReferenceCode(editingEntry.referenceCode);
      setNote(editingEntry.note);
      setReceipt(null);
    } else {
      initializeForm(defaultMemberId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultMemberId, editingEntry]);

  const handleMethodChange = (next: PaymentMethod) => {
    setPaymentMethod(next);
    const prefix =
      next === 'cash'
        ? 'CSH'
        : next === 'bank_transfer'
          ? 'EFT'
          : next === 'standing_order'
            ? 'STO'
            : 'SKV';
    setReferenceCode(generateReceiptRef(prefix));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || settings.activeRole !== 'treasurer') return;
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return;

    setSaving(true);
    try {
      const finalRef = referenceCode.trim() || generateReceiptRef('SKV');
      if (editingEntry?.id) {
        await updateContribution(editingEntry.id, {
          memberId: selectedMember.id!,
          amount: numAmount,
          date,
          cycleMonth,
          paymentMethod,
          referenceCode: finalRef,
          category,
          note,
        });
        onClose();
        return;
      }

      await logContribution({
        memberId: selectedMember.id!,
        amount: numAmount,
        date,
        cycleMonth,
        paymentMethod,
        referenceCode: finalRef,
        category,
        note,
      });

      const remainingAfter = Math.max(0, selectedMemberPending - numAmount);
      setReceipt({
        memberName: selectedMember.name,
        amount: numAmount,
        cycleMonth,
        date,
        method: paymentMethod,
        ref: finalRef,
        remainingPending: remainingAfter,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={
        receipt
          ? 'Deposit Logged to Vault'
          : editingEntry
            ? `Edit Deposit (${editingEntry.referenceCode})`
            : 'Log Member Contribution'
      }
      subtitle={
        receipt
          ? undefined
          : 'Saved immediately to offline IndexedDB ledger with verifiable receipt code.'
      }
    >
      {receipt ? (
        <SuccessCheckmarkView
          title="Contribution Verified"
          amountFormatted={formatCurrency(receipt.amount, settings.currency)}
          subtitle={`Credited to ${receipt.memberName} for ${formatCycleMonth(
            receipt.cycleMonth
          )}`}
          details={[
            { label: 'Member', value: receipt.memberName },
            { label: 'Cycle Month', value: formatCycleMonth(receipt.cycleMonth) },
            {
              label: 'Payment Method',
              value: PAYMENT_METHOD_LABELS[receipt.method].label,
            },
            { label: 'Receipt Ref', value: receipt.ref, mono: true },
            { label: 'Date', value: formatDisplayDate(receipt.date) },
            {
              label: 'Cycle Pending Balance',
              value:
                receipt.remainingPending === 0
                  ? 'Cleared (0)'
                  : formatCurrency(receipt.remainingPending, settings.currency),
            },
          ]}
          onDone={onClose}
          onSecondary={() => initializeForm()}
          secondaryLabel="Log Another"
        />
      ) : selectableMembers.length === 0 ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--cv-text)' }}>
            No Registered Members Yet
          </p>
          <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
            Register your first group member before recording a deposit.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Group Member
            </label>
            <select
              value={selectedMember?.id ?? ''}
              onChange={(e) => {
                const nextId = Number(e.target.value);
                setMemberId(nextId);
                const m = members.find((item) => item.id === nextId);
                if (m) {
                  const paid = contributions
                    .filter((c) => c.memberId === m.id && c.cycleMonth === cycleMonth)
                    .reduce((s, c) => s + c.amount, 0);
                  const rem = Math.max(0, m.monthlyTarget - paid);
                  setAmount(String(rem > 0 ? rem : m.monthlyTarget));
                }
              }}
              className="vault-input font-medium"
            >
              {selectableMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.memberCode} · {m.name} (Target:{' '}
                  {formatCurrency(m.monthlyTarget, settings.currency)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  className="text-xs font-semibold"
                  style={{ color: 'var(--cv-text-secondary)' }}
                >
                  Amount ({settings.currency})
                </label>
                {selectedMemberPending > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(selectedMemberPending))}
                    className="text-[11px] font-semibold underline-offset-2 hover:underline"
                    style={{ color: 'var(--cv-accent)' }}
                  >
                    Fill due ({formatCurrency(selectedMemberPending, settings.currency)})
                  </button>
                )}
              </div>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10000"
                className="vault-input tabular-nums font-bold"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => handleMethodChange(e.target.value as PaymentMethod)}
                className="vault-input"
              >
                {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                  <option key={k} value={k}>
                    {PAYMENT_METHOD_LABELS[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Deposit Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="vault-input tabular-nums"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Accounting Cycle
              </label>
              <input
                type="month"
                required
                value={cycleMonth}
                onChange={(e) => setCycleMonth(e.target.value)}
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
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ContributionCategory)}
                className="vault-input"
              >
                {(
                  Object.keys(CONTRIBUTION_CATEGORY_LABELS) as ContributionCategory[]
                ).map((cat) => (
                  <option key={cat} value={cat}>
                    {CONTRIBUTION_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Receipt / M-Pesa Ref
              </label>
              <input
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="SKV-8291MP"
                className="vault-input font-mono"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Ledger Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Verified M-Pesa transfer / meeting table cash"
              className="vault-input"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button type="button" onClick={onClose} className="vault-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="vault-btn-primary">
              <Plus className="w-4 h-4" />
              <span>
                {saving
                  ? 'Saving…'
                  : editingEntry
                    ? 'Update Deposit'
                    : 'Save Deposit'}
              </span>
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
};

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
  if (method === 'mobile_transfer') return <Smartphone className="w-3.5 h-3.5" />;
  if (method === 'cash') return <Wallet className="w-3.5 h-3.5" />;
  if (method === 'bank_transfer') return <Building2 className="w-3.5 h-3.5" />;
  return <CreditCard className="w-3.5 h-3.5" />;
}

interface ContributionLedgerProps {
  settings: VaultSettings;
  members: Member[];
  contributions: Contribution[];
  payouts: PayoutRecord[];
  projects: FundraiserProject[];
  projectContributions: ProjectContribution[];
}

export const ContributionLedger: React.FC<ContributionLedgerProps> = ({
  settings,
  members,
  contributions,
  payouts,
  projects,
  projectContributions,
}) => {
  const isTreasurer = settings.activeRole === 'treasurer';

  // Filters & View State
  const [selectedCycle, setSelectedCycle] = useState(settings.currentCycleMonth);
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'cleared' | 'partial' | 'pending'
  >('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [sortBy, setSortBy] = useState<
    'rotation' | 'saved_desc' | 'pending_desc' | 'name'
  >('rotation');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'members' | 'transactions'>('members');
  const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);

  // Modals
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositMemberId, setDepositMemberId] = useState<number | undefined>(undefined);
  const [editingDeposit, setEditingDeposit] = useState<Contribution | null>(null);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [mName, setMName] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mTitle, setMTitle] = useState('Member');
  const [mTarget, setMTarget] = useState(String(settings.defaultTarget));
  const [mJoined, setMJoined] = useState(todayIso());
  const [mStatus, setMStatus] = useState<'active' | 'paused'>('active');
  const [mNotes, setMNotes] = useState('');
  const [confirmDeleteMember, setConfirmDeleteMember] = useState(false);

  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [newDefaultTarget, setNewDefaultTarget] = useState(
    String(settings.defaultTarget)
  );
  const [applyTargetToAll, setApplyTargetToAll] = useState(true);

  useEffect(() => {
    setSelectedCycle(settings.currentCycleMonth);
  }, [settings.currentCycleMonth]);

  // Auto-expand member's own accordion when switching to Member role
  useEffect(() => {
    if (settings.activeRole === 'member' && settings.viewingMemberId) {
      setExpandedMemberId(settings.viewingMemberId);
    }
  }, [settings.activeRole, settings.viewingMemberId]);

  const cycleOptions = useMemo(() => {
    const set = new Set<string>(getRecentCycleMonths(settings.currentCycleMonth, 6));
    contributions.forEach((c) => set.add(c.cycleMonth));
    set.add(settings.currentCycleMonth);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [contributions, settings.currentCycleMonth]);

  // Compute rich member standing statistics
  const memberStats = useMemo(() => {
    return members.map((member) => {
      const allDeposits = contributions
        .filter((c) => c.memberId === member.id)
        .sort(
          (a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)
        );

      const visibleDeposits =
        methodFilter === 'all'
          ? allDeposits
          : allDeposits.filter((c) => c.paymentMethod === methodFilter);

      const lifetimeSavings = allDeposits.reduce((s, c) => s + c.amount, 0);
      const cyclePaid = allDeposits
        .filter((c) => c.cycleMonth === selectedCycle)
        .reduce((s, c) => s + c.amount, 0);

      const target = member.status === 'active' ? member.monthlyTarget : 0;
      const pendingBalance = Math.max(0, target - cyclePaid);
      const surplus = Math.max(0, cyclePaid - target);
      const progressPct =
        target > 0 ? Math.min(100, Math.round((cyclePaid / target) * 100)) : 100;

      const standing: 'cleared' | 'partial' | 'pending' | 'paused' =
        member.status === 'paused'
          ? 'paused'
          : pendingBalance === 0
            ? 'cleared'
            : cyclePaid > 0
              ? 'partial'
              : 'pending';

      const projectEquity = projectContributions
        .filter((pc) => pc.memberId === member.id)
        .reduce((s, pc) => s + pc.amount, 0);

      return {
        member,
        allDeposits,
        visibleDeposits,
        lifetimeSavings,
        cyclePaid,
        target,
        pendingBalance,
        surplus,
        progressPct,
        standing,
        projectEquity,
      };
    });
  }, [members, contributions, selectedCycle, methodFilter, projectContributions]);

  const summary = useMemo(() => {
    const totalLifetime = contributions.reduce((s, c) => s + c.amount, 0);
    const cycleCollected = memberStats.reduce((s, m) => s + m.cyclePaid, 0);
    const cycleExpected = memberStats.reduce((s, m) => s + m.target, 0);
    const totalPending = memberStats.reduce((s, m) => s + m.pendingBalance, 0);
    const clearedCount = memberStats.filter((m) => m.standing === 'cleared').length;
    const activeCount = memberStats.filter((m) => m.member.status === 'active').length;
    return {
      totalLifetime,
      cycleCollected,
      cycleExpected,
      totalPending,
      clearedCount,
      activeCount,
    };
  }, [contributions, memberStats]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return memberStats
      .filter((item) => {
        if (statusFilter !== 'all' && item.standing !== statusFilter) return false;
        if (methodFilter !== 'all' && item.visibleDeposits.length === 0) return false;
        if (!q) return true;
        const matchMeta =
          item.member.name.toLowerCase().includes(q) ||
          item.member.memberCode.toLowerCase().includes(q) ||
          item.member.phone.toLowerCase().includes(q) ||
          item.member.title.toLowerCase().includes(q);
        const matchRef = item.allDeposits.some((d) =>
          d.referenceCode.toLowerCase().includes(q)
        );
        return matchMeta || matchRef;
      })
      .sort((a, b) => {
        if (sortBy === 'saved_desc') return b.lifetimeSavings - a.lifetimeSavings;
        if (sortBy === 'pending_desc') return b.pendingBalance - a.pendingBalance;
        if (sortBy === 'name') return a.member.name.localeCompare(b.member.name);
        return a.member.rotationOrder - b.member.rotationOrder;
      });
  }, [memberStats, statusFilter, methodFilter, searchQuery, sortBy]);

  const filteredTransactions = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id!, m]));
    const q = searchQuery.trim().toLowerCase();
    return [...contributions]
      .filter((c) => {
        if (methodFilter !== 'all' && c.paymentMethod !== methodFilter) return false;
        if (!isTreasurer && settings.viewingMemberId && c.memberId !== settings.viewingMemberId) {
          // In Member mode transactions feed, focus on personal contribution history
          return false;
        }
        if (!q) return true;
        const m = memberMap.get(c.memberId);
        return (
          c.referenceCode.toLowerCase().includes(q) ||
          c.note.toLowerCase().includes(q) ||
          c.cycleMonth.includes(q) ||
          (m?.name.toLowerCase().includes(q) ?? false) ||
          (m?.memberCode.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
      .map((entry) => ({
        entry,
        member: memberMap.get(entry.memberId),
      }));
  }, [contributions, members, methodFilter, searchQuery, isTreasurer, settings.viewingMemberId]);

  const personalPassbook = useMemo(() => {
    if (isTreasurer) return null;
    return (
      memberStats.find((m) => m.member.id === settings.viewingMemberId) ??
      memberStats[0] ??
      null
    );
  }, [isTreasurer, memberStats, settings.viewingMemberId]);

  const openRegisterMember = () => {
    if (!isTreasurer) return;
    setEditingMember(null);
    setConfirmDeleteMember(false);
    setMName('');
    setMPhone('');
    setMEmail('');
    setMTitle('Member');
    setMTarget(String(settings.defaultTarget));
    setMJoined(todayIso());
    setMStatus('active');
    setMNotes('');
    setMemberModalOpen(true);
  };

  const openEditMember = (member: Member) => {
    if (!isTreasurer) return;
    setEditingMember(member);
    setConfirmDeleteMember(false);
    setMName(member.name);
    setMPhone(member.phone);
    setMEmail(member.email);
    setMTitle(member.title);
    setMTarget(String(member.monthlyTarget));
    setMJoined(member.joinedDate);
    setMStatus(member.status);
    setMNotes(member.notes);
    setMemberModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTreasurer || !mName.trim()) return;
    const numericTarget = Math.max(0, Number(mTarget) || 0);

    if (editingMember?.id) {
      await updateMemberProfile(editingMember.id, {
        name: mName.trim(),
        phone: mPhone.trim(),
        email: mEmail.trim(),
        title: mTitle.trim() || 'Member',
        monthlyTarget: numericTarget,
        joinedDate: mJoined,
        status: mStatus,
        notes: mNotes.trim(),
      });
    } else {
      const createdId = await registerMember({
        name: mName,
        phone: mPhone,
        email: mEmail,
        title: mTitle,
        monthlyTarget: numericTarget,
        joinedDate: mJoined,
        status: mStatus,
        notes: mNotes,
      });
      setExpandedMemberId(createdId);
    }
    setMemberModalOpen(false);
  };

  const handleDeleteMember = async () => {
    if (!editingMember?.id || !isTreasurer) return;
    await deleteMemberRecord(editingMember.id);
    if (expandedMemberId === editingMember.id) {
      setExpandedMemberId(null);
    }
    setMemberModalOpen(false);
  };

  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTreasurer) return;
    const val = Math.max(1, Number(newDefaultTarget) || settings.defaultTarget);
    await updateVaultSettings(
      { defaultTarget: val },
      {
        syncAllMemberTargets: applyTargetToAll,
        auditSummary: `Updated contribution target to ${formatCurrency(
          val,
          settings.currency
        )}${applyTargetToAll ? ' across all members' : ''}`,
      }
    );
    setTargetModalOpen(false);
  };

  const openDepositForMember = (memberId?: number) => {
    if (!isTreasurer) return;
    setEditingDeposit(null);
    setDepositMemberId(memberId);
    setDepositOpen(true);
  };

  const openEditDeposit = (entry: Contribution) => {
    if (!isTreasurer) return;
    setEditingDeposit(entry);
    setDepositMemberId(entry.memberId);
    setDepositOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Page Title & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div>
          <h1
            className="text-xl sm:text-2xl font-extrabold tracking-tight"
            style={{ color: 'var(--cv-text)' }}
          >
            Members &amp; Contribution Ledger
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
            {isTreasurer
              ? 'Register members, log periodic deposits, and track automated pending balances.'
              : 'Read-only member access — inspect your personal passbook and group savings standing.'}
          </p>
        </div>

        {isTreasurer ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setNewDefaultTarget(String(settings.defaultTarget));
                setTargetModalOpen(true);
              }}
              className="vault-btn-secondary !py-2 !px-3 !text-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Target: {formatCurrency(settings.defaultTarget, settings.currency, true)}</span>
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
              className="vault-btn-secondary !py-2 !px-3 !text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={openRegisterMember}
              className="vault-btn-secondary !py-2 !px-3 !text-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
            <button
              type="button"
              onClick={() => openDepositForMember()}
              className="vault-btn-primary !py-2 !px-3.5 !text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Log Deposit</span>
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 self-start">
            <span className="vault-badge-info py-1 px-3">
              <Lock className="w-3 h-3" /> Read-Only Member Ledger
            </span>
          </div>
        )}
      </div>

      {/* Personal Member Passbook Spotlight (Member Role) */}
      {personalPassbook && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_PHYSICS}
          className="glass-card-hero p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${personalPassbook.member.avatarHue} text-white font-bold text-sm flex items-center justify-center shrink-0`}
              >
                {getInitials(personalPassbook.member.name)}
              </div>
              <div>
                <span
                  className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--cv-accent)' }}
                >
                  My Personal Savings Passbook · {personalPassbook.member.memberCode}
                </span>
                <h2
                  className="text-lg font-extrabold"
                  style={{ color: 'var(--cv-text)' }}
                >
                  {personalPassbook.member.name}
                </h2>
                <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
                  {personalPassbook.allDeposits.length} verified deposits · Rotation Slot #
                  {personalPassbook.member.rotationOrder}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                exportMemberStatementCsv({
                  settings,
                  member: personalPassbook.member,
                  contributions,
                  projectContributions,
                  projects,
                })
              }
              className="vault-btn-secondary !text-xs self-start sm:self-center"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>My Statement (CSV)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="glass-subtle p-3">
              <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                My Total Savings
              </p>
              <p
                className="text-base font-extrabold tabular-nums mt-0.5"
                style={{ color: 'var(--cv-text)' }}
              >
                {formatCurrency(personalPassbook.lifetimeSavings, settings.currency)}
              </p>
            </div>
            <div className="glass-subtle p-3">
              <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                Paid ({formatCycleMonth(selectedCycle)})
              </p>
              <p
                className="text-base font-extrabold tabular-nums mt-0.5"
                style={{ color: 'var(--cv-positive)' }}
              >
                {formatCurrency(personalPassbook.cyclePaid, settings.currency)}
              </p>
            </div>
            <div className="glass-subtle p-3">
              <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                My Pending Balance
              </p>
              <p
                className="text-base font-extrabold tabular-nums mt-0.5"
                style={{
                  color:
                    personalPassbook.pendingBalance > 0
                      ? 'var(--cv-warning)'
                      : 'var(--cv-positive)',
                }}
              >
                {formatCurrency(personalPassbook.pendingBalance, settings.currency)}
              </p>
            </div>
            <div className="glass-subtle p-3">
              <p className="text-[11px]" style={{ color: 'var(--cv-text-muted)' }}>
                My Project Equity
              </p>
              <p
                className="text-base font-extrabold tabular-nums mt-0.5"
                style={{ color: 'var(--cv-accent)' }}
              >
                {formatCurrency(personalPassbook.projectEquity, settings.currency)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Group KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Cumulative Group Savings
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-text)' }}
          >
            {formatCurrency(summary.totalLifetime, settings.currency)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cv-text-muted)' }}>
            {contributions.length} deposits recorded
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Collected ({formatCycleMonth(selectedCycle)})
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-positive)' }}
          >
            {formatCurrency(summary.cycleCollected, settings.currency)}
          </p>
          <p className="text-[11px] mt-1 tabular-nums" style={{ color: 'var(--cv-text-muted)' }}>
            of {formatCurrency(summary.cycleExpected, settings.currency)} cycle target
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Pending Balances
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{
              color:
                summary.totalPending > 0 ? 'var(--cv-warning)' : 'var(--cv-positive)',
            }}
          >
            {formatCurrency(summary.totalPending, settings.currency)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cv-text-muted)' }}>
            {summary.totalPending === 0
              ? '100% settled for cycle'
              : `Outstanding for ${formatCycleMonth(selectedCycle)}`}
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Members Cleared
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-text)' }}
          >
            {summary.clearedCount} / {summary.activeCount}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cv-text-muted)' }}>
            {members.length} total registered
          </p>
        </div>
      </div>

      {/* Search, Filter & View Controls */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--cv-text-subtle)' }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, code, phone, or receipt ref…"
              className="vault-input !pl-10"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2.5">
            <select
              aria-label="Filter by cycle month"
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="vault-input sm:!w-36 !text-xs font-medium"
            >
              {cycleOptions.map((ym) => (
                <option key={ym} value={ym}>
                  {formatCycleMonth(ym)}
                  {ym === settings.currentCycleMonth ? ' (Current)' : ''}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by payment method"
              value={methodFilter}
              onChange={(e) =>
                setMethodFilter(e.target.value as 'all' | PaymentMethod)
              }
              className="vault-input sm:!w-40 !text-xs font-medium"
            >
              <option value="all">All Channels</option>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((k) => (
                <option key={k} value={k}>
                  {PAYMENT_METHOD_LABELS[k].short}
                </option>
              ))}
            </select>

            {viewMode === 'members' && (
              <select
                aria-label="Sort members"
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | 'rotation'
                      | 'saved_desc'
                      | 'pending_desc'
                      | 'name'
                  )
                }
                className="vault-input col-span-2 sm:col-span-1 sm:!w-40 !text-xs font-medium"
              >
                <option value="rotation">Sort: Rotation Order</option>
                <option value="saved_desc">Sort: Highest Saved</option>
                <option value="pending_desc">Sort: Pending Balance</option>
                <option value="name">Sort: Name (A–Z)</option>
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {viewMode === 'members' ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All Members' },
                  { id: 'cleared', label: 'Cleared' },
                  { id: 'partial', label: 'Partial' },
                  { id: 'pending', label: 'Pending' },
                ] as const
              ).map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                    style={{
                      background: active
                        ? 'var(--cv-accent-soft-strong)'
                        : 'transparent',
                      borderColor: active
                        ? 'var(--cv-border-strong)'
                        : 'var(--cv-border-subtle)',
                      color: active ? 'var(--cv-text)' : 'var(--cv-text-muted)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--cv-text-muted)' }}>
              {isTreasurer
                ? `Showing ${filteredTransactions.length} verified group contribution receipts`
                : `Showing ${filteredTransactions.length} personal receipts for ${
                    personalPassbook?.member.name ?? 'Member'
                  }`}
            </p>
          )}

          <div
            className="inline-flex p-1 rounded-xl border self-start sm:self-auto"
            style={{
              background: 'var(--cv-surface-subtle)',
              borderColor: 'var(--cv-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('members')}
              className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
              style={{
                color:
                  viewMode === 'members'
                    ? 'var(--cv-accent-contrast)'
                    : 'var(--cv-text-secondary)',
              }}
            >
              {viewMode === 'members' && (
                <motion.span
                  layoutId="ledger-view-pill"
                  transition={SPRING_PHYSICS}
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--cv-btn-grad)' }}
                />
              )}
              <Users className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10">Members</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('transactions')}
              className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold"
              style={{
                color:
                  viewMode === 'transactions'
                    ? 'var(--cv-accent-contrast)'
                    : 'var(--cv-text-secondary)',
              }}
            >
              {viewMode === 'transactions' && (
                <motion.span
                  layoutId="ledger-view-pill"
                  transition={SPRING_PHYSICS}
                  className="absolute inset-0 rounded-lg"
                  style={{ background: 'var(--cv-btn-grad)' }}
                />
              )}
              <Receipt className="relative z-10 w-3.5 h-3.5" />
              <span className="relative z-10">
                {isTreasurer ? 'All Receipts' : 'My Receipts'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Member Expanding Accordions OR Chronological Receipt Feed */}
      {viewMode === 'members' ? (
        <div className="space-y-3">
          {filteredMembers.length === 0 ? (
            <div className="glass-card p-10 text-center space-y-3">
              <Users
                className="w-9 h-9 mx-auto"
                style={{ color: 'var(--cv-text-subtle)' }}
              />
              <div>
                <p className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
                  No Matching Members Found
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--cv-text-muted)' }}>
                  {members.length === 0
                    ? 'Start your chama ledger by registering your first member.'
                    : 'Adjust your search query or reset status/channel filters.'}
                </p>
              </div>
              {members.length === 0 && isTreasurer && (
                <button
                  type="button"
                  onClick={openRegisterMember}
                  className="vault-btn-primary !text-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register First Member</span>
                </button>
              )}
            </div>
          ) : (
            filteredMembers.map((row) => {
              const isExpanded = expandedMemberId === row.member.id;
              const isSelf =
                !isTreasurer && settings.viewingMemberId === row.member.id;
              const canViewDetailedReceipts = isTreasurer || isSelf;

              return (
                <motion.div
                  key={row.member.id}
                  layout="position"
                  transition={SPRING_PHYSICS}
                  className="glass-card overflow-hidden"
                  style={{
                    borderColor: isExpanded
                      ? 'var(--cv-border-strong)'
                      : 'var(--cv-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedMemberId(isExpanded ? null : row.member.id!)
                    }
                    aria-expanded={isExpanded}
                    className="w-full p-4 sm:px-5 text-left flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-colors hover:bg-[var(--cv-surface-hover)]"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${row.member.avatarHue} text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0`}
                      >
                        {getInitials(row.member.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-sm sm:text-base font-bold truncate"
                            style={{ color: 'var(--cv-text)' }}
                          >
                            {row.member.name}
                          </span>
                          <span
                            className="text-[11px] font-mono"
                            style={{ color: 'var(--cv-text-muted)' }}
                          >
                            {row.member.memberCode}
                          </span>
                          {isSelf && (
                            <span className="vault-badge-info text-[10px] !py-0">
                              You
                            </span>
                          )}
                          {row.member.status === 'paused' && (
                            <span className="vault-badge-warning text-[10px] !py-0">
                              Paused
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs truncate mt-0.5"
                          style={{ color: 'var(--cv-text-muted)' }}
                        >
                          {row.member.title} · Slot #{row.member.rotationOrder} · Total
                          Saved:{' '}
                          <strong
                            className="tabular-nums"
                            style={{ color: 'var(--cv-text-secondary)' }}
                          >
                            {formatCurrency(row.lifetimeSavings, settings.currency)}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-4 pl-14 md:pl-0">
                      {/* Cycle Progress Mini Column */}
                      <div className="w-36 sm:w-44 hidden sm:block">
                        <div className="flex items-center justify-between text-[11px] tabular-nums mb-1">
                          <span style={{ color: 'var(--cv-text-muted)' }}>
                            {formatCurrency(row.cyclePaid, settings.currency, true)} /{' '}
                            {formatCurrency(row.target, settings.currency, true)}
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: 'var(--cv-text)' }}
                          >
                            {row.progressPct}%
                          </span>
                        </div>
                        <div className="vault-progress-track h-1.5">
                          <motion.div
                            initial={false}
                            animate={{ width: `${row.progressPct}%` }}
                            transition={SPRING_PHYSICS}
                            className="vault-progress-fill h-full rounded-full"
                          />
                        </div>
                      </div>

                      {/* Standing Badge */}
                      <div className="text-right min-w-[112px]">
                        {row.standing === 'cleared' ? (
                          <span className="vault-badge-positive">
                            <CircleCheck className="w-3 h-3" />
                            {row.surplus > 0
                              ? `+${formatCurrency(row.surplus, settings.currency, true)} Ahead`
                              : 'Cleared'}
                          </span>
                        ) : row.standing === 'partial' ? (
                          <span className="vault-badge-warning tabular-nums">
                            <Clock className="w-3 h-3" />
                            Due {formatCurrency(row.pendingBalance, settings.currency, true)}
                          </span>
                        ) : row.standing === 'pending' ? (
                          <span className="vault-badge-danger tabular-nums">
                            <CircleAlert className="w-3 h-3" />
                            Due {formatCurrency(row.pendingBalance, settings.currency, true)}
                          </span>
                        ) : (
                          <span className="vault-badge-info">Paused</span>
                        )}
                      </div>

                      <motion.span
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={SPRING_PHYSICS}
                        style={{ color: 'var(--cv-text-muted)' }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </motion.span>
                    </div>
                  </button>

                  {/* Spring Accordion Body */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        key="accordion-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={SPRING_PHYSICS}
                        className="overflow-hidden"
                      >
                        <div
                          className="px-4 sm:px-5 pb-5 pt-3 border-t space-y-4"
                          style={{ borderColor: 'var(--cv-border-subtle)' }}
                        >
                          {/* Profile Metadata + Actions */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div
                              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                              style={{ color: 'var(--cv-text-muted)' }}
                            >
                              {row.member.phone && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5" />
                                  {row.member.phone}
                                </span>
                              )}
                              <span>
                                Joined {formatDisplayDate(row.member.joinedDate)}
                              </span>
                              <span className="tabular-nums">
                                Project Funds:{' '}
                                <strong style={{ color: 'var(--cv-text-secondary)' }}>
                                  {formatCurrency(row.projectEquity, settings.currency)}
                                </strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {isTreasurer && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openDepositForMember(row.member.id)}
                                    className="vault-btn-primary !py-1.5 !px-3 !text-xs"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Log Deposit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditMember(row.member)}
                                    className="vault-btn-secondary !py-1.5 !px-3 !text-xs"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Edit Profile</span>
                                  </button>
                                </>
                              )}
                              {canViewDetailedReceipts && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    exportMemberStatementCsv({
                                      settings,
                                      member: row.member,
                                      contributions,
                                      projectContributions,
                                      projects,
                                    })
                                  }
                                  className="vault-btn-secondary !py-1.5 !px-3 !text-xs"
                                >
                                  <ArrowDownToLine className="w-3.5 h-3.5" />
                                  <span>Statement</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {row.member.notes && isTreasurer && (
                            <p
                              className="text-xs italic"
                              style={{ color: 'var(--cv-text-muted)' }}
                            >
                              &ldquo;{row.member.notes}&rdquo;
                            </p>
                          )}

                          {/* Contribution Receipts List */}
                          {canViewDetailedReceipts ? (
                            <div className="glass-subtle overflow-hidden">
                              <div
                                className="px-3.5 py-2.5 border-b flex items-center justify-between text-xs font-semibold"
                                style={{
                                  borderColor: 'var(--cv-border-subtle)',
                                  color: 'var(--cv-text-secondary)',
                                }}
                              >
                                <span>
                                  Contribution History ({row.visibleDeposits.length})
                                </span>
                                <span className="tabular-nums">
                                  Total:{' '}
                                  {formatCurrency(row.lifetimeSavings, settings.currency)}
                                </span>
                              </div>

                              {row.visibleDeposits.length === 0 ? (
                                <div
                                  className="p-5 text-center text-xs"
                                  style={{ color: 'var(--cv-text-muted)' }}
                                >
                                  No contributions logged yet for this member.
                                </div>
                              ) : (
                                <div
                                  className="divide-y max-h-64 overflow-y-auto"
                                  style={{ borderColor: 'var(--cv-border-subtle)' }}
                                >
                                  {row.visibleDeposits.map((dep) => (
                                    <div
                                      key={dep.id}
                                      className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span
                                          className="w-7 h-7 rounded-lg flex items-center justify-center border shrink-0"
                                          style={{
                                            background: 'var(--cv-surface-subtle)',
                                            borderColor: 'var(--cv-border-subtle)',
                                            color: 'var(--cv-accent)',
                                          }}
                                        >
                                          <PaymentMethodIcon method={dep.paymentMethod} />
                                        </span>
                                        <div className="min-w-0">
                                          <p
                                            className="font-semibold truncate"
                                            style={{ color: 'var(--cv-text)' }}
                                          >
                                            {PAYMENT_METHOD_LABELS[dep.paymentMethod].short}{' '}
                                            ·{' '}
                                            <span className="font-mono text-[11px]">
                                              {dep.referenceCode}
                                            </span>
                                          </p>
                                          <p
                                            className="text-[11px] truncate"
                                            style={{ color: 'var(--cv-text-muted)' }}
                                          >
                                            {formatDisplayDate(dep.date)} · Cycle{' '}
                                            {formatCycleMonth(dep.cycleMonth)}
                                            {dep.note ? ` · ${dep.note}` : ''}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className="font-bold tabular-nums"
                                          style={{ color: 'var(--cv-positive)' }}
                                        >
                                          +{formatCurrency(dep.amount, settings.currency)}
                                        </span>
                                        {isTreasurer && (
                                          <>
                                            <button
                                              type="button"
                                              aria-label={`Edit deposit ${dep.referenceCode}`}
                                              title="Edit deposit entry"
                                              onClick={() => openEditDeposit(dep)}
                                              className="p-1 rounded-md opacity-65 hover:opacity-100 transition-opacity"
                                              style={{ color: 'var(--cv-text-secondary)' }}
                                            >
                                              <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              aria-label={`Delete deposit ${dep.referenceCode}`}
                                              title="Reverse deposit entry"
                                              onClick={() => deleteContribution(dep.id!)}
                                              className="p-1 rounded-md opacity-65 hover:opacity-100 transition-opacity"
                                              style={{ color: 'var(--cv-danger)' }}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
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
                                Individual receipt references for other members are protected in Member mode. Summary contribution totals remain visible for group transparency.
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        /* Chronological Ledger Transactions View */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_PHYSICS}
          className="glass-card overflow-hidden"
        >
          {filteredTransactions.length === 0 ? (
            <div
              className="p-10 text-center text-xs"
              style={{ color: 'var(--cv-text-muted)' }}
            >
              No matching contribution receipts found.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--cv-border-subtle)' }}>
              {filteredTransactions.map(({ entry, member }) => (
                <div
                  key={entry.id}
                  className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0"
                      style={{
                        background: 'var(--cv-accent-soft)',
                        borderColor: 'var(--cv-border-subtle)',
                        color: 'var(--cv-accent)',
                      }}
                    >
                      <PaymentMethodIcon method={entry.paymentMethod} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: 'var(--cv-text)' }}
                        >
                          {member?.name ?? 'Unknown Member'}
                        </p>
                        <span
                          className="text-[11px] font-mono px-1.5 py-0.5 rounded border"
                          style={{
                            borderColor: 'var(--cv-border-subtle)',
                            color: 'var(--cv-text-secondary)',
                          }}
                        >
                          {entry.referenceCode}
                        </span>
                      </div>
                      <p
                        className="text-xs truncate"
                        style={{ color: 'var(--cv-text-muted)' }}
                      >
                        {formatDisplayDate(entry.date)} ·{' '}
                        {formatCycleMonth(entry.cycleMonth)} ·{' '}
                        {PAYMENT_METHOD_LABELS[entry.paymentMethod].short}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span
                      className="text-sm font-extrabold tabular-nums"
                      style={{ color: 'var(--cv-positive)' }}
                    >
                      +{formatCurrency(entry.amount, settings.currency)}
                    </span>
                    {isTreasurer && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit receipt ${entry.referenceCode}`}
                          onClick={() => openEditDeposit(entry)}
                          className="p-1.5 rounded-lg opacity-65 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--cv-text-secondary)' }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Reverse receipt ${entry.referenceCode}`}
                          onClick={() => deleteContribution(entry.id!)}
                          className="p-1.5 rounded-lg opacity-65 hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--cv-danger)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Deposit Modal */}
      <LogDepositModal
        open={depositOpen}
        onClose={() => {
          setDepositOpen(false);
          setEditingDeposit(null);
        }}
        settings={settings}
        members={members}
        contributions={contributions}
        defaultMemberId={depositMemberId}
        editingEntry={editingDeposit}
      />

      {/* Register / Edit Member Modal */}
      <ModalShell
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        title={editingMember ? `Edit ${editingMember.name}` : 'Register Group Member'}
        subtitle={
          editingMember
            ? `Member Code ${editingMember.memberCode} · Rotation Slot #${editingMember.rotationOrder}`
            : 'Automatically assigns a unique member code and rotation queue position.'
        }
      >
        <form onSubmit={handleSaveMember} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Full Name *
              </label>
              <input
                type="text"
                required
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="e.g. Esther Nkatha"
                className="vault-input"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Phone / Mobile Money No.
              </label>
              <input
                type="tel"
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
                placeholder="+254 712 000 000"
                className="vault-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Email Address
              </label>
              <input
                type="email"
                value={mEmail}
                onChange={(e) => setMEmail(e.target.value)}
                placeholder="member@example.com"
                className="vault-input"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Group Role / Title
              </label>
              <input
                type="text"
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                placeholder="Member / Vice Chair / Auditor"
                className="vault-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Cycle Target ({settings.currency})
              </label>
              <input
                type="number"
                required
                min="0"
                step="any"
                value={mTarget}
                onChange={(e) => setMTarget(e.target.value)}
                className="vault-input tabular-nums font-semibold"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Date Joined
              </label>
              <input
                type="date"
                required
                value={mJoined}
                onChange={(e) => setMJoined(e.target.value)}
                className="vault-input tabular-nums"
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Status
              </label>
              <select
                value={mStatus}
                onChange={(e) => setMStatus(e.target.value as 'active' | 'paused')}
                className="vault-input"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Treasurer Notes
            </label>
            <input
              type="text"
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="Preferred payment day, guarantor, or committee notes"
              className="vault-input"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {editingMember ? (
              confirmDeleteMember ? (
                <button
                  type="button"
                  onClick={handleDeleteMember}
                  className="px-3 py-2 rounded-xl text-xs font-bold border"
                  style={{
                    background: 'var(--cv-danger-soft)',
                    borderColor: 'var(--cv-danger-border)',
                    color: 'var(--cv-danger)',
                  }}
                >
                  Confirm Delete Member
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMember(true)}
                  className="vault-btn-ghost !text-xs"
                  style={{ color: 'var(--cv-danger)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMemberModalOpen(false)}
                className="vault-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="vault-btn-primary">
                {editingMember ? 'Save Changes' : 'Register Member'}
              </button>
            </div>
          </div>
        </form>
      </ModalShell>

      {/* Modify Group Contribution Target Modal */}
      <ModalShell
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title="Modify Contribution Target"
        subtitle="Update the periodic savings target and recalculate pending balances."
      >
        <form onSubmit={handleUpdateTarget} className="space-y-4">
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Periodic Contribution Target ({settings.currency})
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={newDefaultTarget}
              onChange={(e) => setNewDefaultTarget(e.target.value)}
              className="vault-input tabular-nums font-bold text-base"
            />
          </div>

          <label className="glass-subtle p-3.5 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={applyTargetToAll}
              onChange={(e) => setApplyTargetToAll(e.target.checked)}
              className="mt-0.5 rounded"
              style={{ accentColor: 'var(--cv-accent)' }}
            />
            <span className="text-xs" style={{ color: 'var(--cv-text-secondary)' }}>
              Apply this new target to all {members.length} currently registered members and
              automatically update the merry-go-round pot.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setTargetModalOpen(false)}
              className="vault-btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="vault-btn-primary">
              Update Target
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};
