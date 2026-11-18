import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Circle,
  Flag,
  FolderPlus,
  Lock,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  createFundraiserProject,
  deleteFundraiserProject,
  deleteProjectContribution,
  type FundraiserProject,
  logProjectContribution,
  type Member,
  type PaymentMethod,
  type ProjectCategory,
  type ProjectContribution,
  type ProjectStatus,
  updateFundraiserProject,
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
  PROJECT_CATEGORY_LABELS,
  SPRING_PHYSICS,
  todayIso,
} from '../db/formatters';
import { ModalShell, SuccessCheckmarkView } from './ModalShell';

interface ProjectMilestonesProps {
  settings: VaultSettings;
  members: Member[];
  projects: FundraiserProject[];
  projectContributions: ProjectContribution[];
}

interface DraftMilestone {
  key: string;
  label: string;
  targetAmount: string;
  reachedAt?: string;
}

export const ProjectMilestones: React.FC<ProjectMilestonesProps> = ({
  settings,
  members,
  projects,
  projectContributions,
}) => {
  const isTreasurer = settings.activeRole === 'treasurer';

  const [filterTab, setFilterTab] = useState<
    'all' | 'active' | 'completed' | 'investment' | 'social'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(
    projects[0]?.id ?? null
  );

  // Create / Edit Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<FundraiserProject | null>(null);
  const [pTitle, setPTitle] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState<ProjectCategory>('land');
  const [pTarget, setPTarget] = useState('200000');
  const [pDeadline, setPDeadline] = useState(addDaysToIso(todayIso(), 90));
  const [pStatus, setPStatus] = useState<ProjectStatus>('active');
  const [pMilestones, setPMilestones] = useState<DraftMilestone[]>([]);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);

  // Log Project Contribution Modal
  const [contribOpen, setContribOpen] = useState(false);
  const [contribProject, setContribProject] = useState<FundraiserProject | null>(null);
  const [cMemberId, setCMemberId] = useState<number>(0);
  const [cAmount, setCAmount] = useState('');
  const [cDate, setCDate] = useState(todayIso());
  const [cMethod, setCMethod] = useState<PaymentMethod>('mobile_transfer');
  const [cRef, setCRef] = useState('');
  const [cNote, setCNote] = useState('');
  const [cSaving, setCSaving] = useState(false);
  const [cReceipt, setCReceipt] = useState<{
    projectName: string;
    memberName: string;
    amount: number;
    method: PaymentMethod;
    ref: string;
    date: string;
    newPct: number;
    unlockedMilestone: string | null;
  } | null>(null);

  const memberMap = useMemo(
    () => new Map(members.map((m) => [m.id!, m])),
    [members]
  );

  const enrichedProjects = useMemo(() => {
    return projects
      .map((project) => {
        const entries = projectContributions
          .filter((pc) => pc.projectId === project.id)
          .sort(
            (a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0)
          );
        const raised = entries.reduce((s, e) => s + e.amount, 0);
        const remaining = Math.max(0, project.targetAmount - raised);
        const rawPct =
          project.targetAmount > 0 ? (raised / project.targetAmount) * 100 : 0;
        const pct = Math.min(100, Math.round(rawPct * 10) / 10);
        const daysLeft = getDaysUntil(project.deadline);

        // Aggregate per-member contributions
        const byMemberMap = new Map<number, number>();
        entries.forEach((e) => {
          byMemberMap.set(e.memberId, (byMemberMap.get(e.memberId) ?? 0) + e.amount);
        });
        const memberTotals = Array.from(byMemberMap.entries())
          .map(([mId, total]) => ({
            memberId: mId,
            member: memberMap.get(mId),
            total,
            sharePct: raised > 0 ? Math.round((total / raised) * 100) : 0,
          }))
          .sort((a, b) => b.total - a.total);

        const milestones = project.milestones.map((ms) => ({
          ...ms,
          isReached: raised >= ms.targetAmount || Boolean(ms.reachedAt),
          pctOfGoal:
            project.targetAmount > 0
              ? Math.min(100, Math.round((ms.targetAmount / project.targetAmount) * 100))
              : 0,
        }));

        const nextMilestone = milestones.find((m) => !m.isReached) ?? null;

        return {
          project,
          entries,
          raised,
          remaining,
          pct,
          daysLeft,
          memberTotals,
          milestones,
          nextMilestone,
        };
      })
      .sort((a, b) => {
        if (a.project.status === 'active' && b.project.status !== 'active') return -1;
        if (a.project.status !== 'active' && b.project.status === 'active') return 1;
        return b.project.createdAt.localeCompare(a.project.createdAt);
      });
  }, [projects, projectContributions, memberMap]);

  const portfolio = useMemo(() => {
    const totalRaised = enrichedProjects.reduce((s, p) => s + p.raised, 0);
    const totalTarget = enrichedProjects.reduce(
      (s, p) => s + p.project.targetAmount,
      0
    );
    const overallPct =
      totalTarget > 0 ? Math.min(100, Math.round((totalRaised / totalTarget) * 100)) : 0;
    const totalMilestones = enrichedProjects.reduce(
      (s, p) => s + p.milestones.length,
      0
    );
    const reachedMilestones = enrichedProjects.reduce(
      (s, p) => s + p.milestones.filter((m) => m.isReached).length,
      0
    );
    const activeCount = enrichedProjects.filter(
      (p) => p.project.status === 'active'
    ).length;

    return {
      totalRaised,
      totalTarget,
      overallPct,
      totalMilestones,
      reachedMilestones,
      activeCount,
    };
  }, [enrichedProjects]);

  const visibleProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedProjects.filter((item) => {
      if (filterTab === 'active' && item.project.status !== 'active') return false;
      if (filterTab === 'completed' && item.project.status !== 'completed')
        return false;
      if (
        filterTab === 'investment' &&
        !['land', 'investment', 'business'].includes(item.project.category)
      ) {
        return false;
      }
      if (
        filterTab === 'social' &&
        !['event', 'welfare'].includes(item.project.category)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.project.title.toLowerCase().includes(q) ||
        item.project.description.toLowerCase().includes(q) ||
        item.milestones.some((m) => m.label.toLowerCase().includes(q))
      );
    });
  }, [enrichedProjects, filterTab, searchQuery]);

  const buildAutoMilestones = (goalStr: string): DraftMilestone[] => {
    const g = Math.max(1000, Number(goalStr) || 100000);
    return [
      {
        key: `d-${Date.now()}-1`,
        label: '25% Kickoff Reserve',
        targetAmount: String(Math.round(g * 0.25)),
      },
      {
        key: `d-${Date.now()}-2`,
        label: '50% Midpoint Commitment',
        targetAmount: String(Math.round(g * 0.5)),
      },
      {
        key: `d-${Date.now()}-3`,
        label: '75% Execution Tranche',
        targetAmount: String(Math.round(g * 0.75)),
      },
      {
        key: `d-${Date.now()}-4`,
        label: '100% Full Goal Completion',
        targetAmount: String(Math.round(g)),
      },
    ];
  };

  const openNewProjectModal = () => {
    if (!isTreasurer) return;
    setEditingProject(null);
    setConfirmDeleteProject(false);
    setPTitle('');
    setPDesc('');
    setPCategory('land');
    setPTarget('200000');
    setPDeadline(addDaysToIso(todayIso(), 90));
    setPStatus('active');
    setPMilestones(buildAutoMilestones('200000'));
    setProjectModalOpen(true);
  };

  const openEditProjectModal = (proj: FundraiserProject) => {
    if (!isTreasurer) return;
    setEditingProject(proj);
    setConfirmDeleteProject(false);
    setPTitle(proj.title);
    setPDesc(proj.description);
    setPCategory(proj.category);
    setPTarget(String(proj.targetAmount));
    setPDeadline(proj.deadline);
    setPStatus(proj.status);
    setPMilestones(
      proj.milestones.map((m) => ({
        key: m.id,
        label: m.label,
        targetAmount: String(m.targetAmount),
        reachedAt: m.reachedAt,
      }))
    );
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTreasurer || !pTitle.trim()) return;
    const targetNum = Math.max(1, Number(pTarget) || 0);

    if (editingProject?.id) {
      await updateFundraiserProject(editingProject.id, {
        title: pTitle.trim(),
        description: pDesc.trim(),
        category: pCategory,
        targetAmount: targetNum,
        deadline: pDeadline,
        status: pStatus,
        milestones: pMilestones
          .filter((m) => m.label.trim() && Number(m.targetAmount) > 0)
          .map((m) => ({
            id: m.key,
            label: m.label.trim(),
            targetAmount: Number(m.targetAmount),
            reachedAt: m.reachedAt,
          })),
      });
    } else {
      const id = await createFundraiserProject({
        title: pTitle,
        description: pDesc,
        category: pCategory,
        targetAmount: targetNum,
        deadline: pDeadline,
        milestones: pMilestones.map((m) => ({
          label: m.label,
          targetAmount: Number(m.targetAmount) || 0,
        })),
      });
      setExpandedProjectId(id);
    }
    setProjectModalOpen(false);
  };

  const handleDeleteProject = async () => {
    if (!editingProject?.id || !isTreasurer) return;
    await deleteFundraiserProject(editingProject.id);
    setProjectModalOpen(false);
  };

  const openContributeModal = (project: FundraiserProject) => {
    if (!isTreasurer) return;
    const activeMembers = members.filter((m) => m.status === 'active');
    const chosen = activeMembers[0] ?? members[0];
    const perMemberShare =
      members.length > 0
        ? Math.max(500, Math.round(project.targetAmount / members.length))
        : 5000;

    setContribProject(project);
    setCReceipt(null);
    setCMemberId(chosen?.id ?? 0);
    setCAmount(String(perMemberShare));
    setCDate(todayIso());
    setCMethod('mobile_transfer');
    setCRef(generateReceiptRef('PRJ'));
    setCNote('');
    setContribOpen(true);
  };

  const handleContributeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contribProject?.id || !isTreasurer || !cMemberId) return;
    const numAmount = Number(cAmount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) return;

    const currentData = enrichedProjects.find(
      (p) => p.project.id === contribProject.id
    );
    const prevRaised = currentData?.raised ?? 0;
    const nextRaised = prevRaised + numAmount;
    const newlyUnlocked =
      contribProject.milestones
        .filter((ms) => prevRaised < ms.targetAmount && nextRaised >= ms.targetAmount)
        .pop()?.label ?? null;

    setCSaving(true);
    try {
      const finalRef = cRef.trim() || generateReceiptRef('PRJ');
      await logProjectContribution({
        projectId: contribProject.id,
        memberId: cMemberId,
        amount: numAmount,
        date: cDate,
        paymentMethod: cMethod,
        referenceCode: finalRef,
        note: cNote,
      });

      const m = memberMap.get(cMemberId);
      const newPct = Math.min(
        100,
        Math.round((nextRaised / contribProject.targetAmount) * 100)
      );

      setCReceipt({
        projectName: contribProject.title,
        memberName: m?.name ?? 'Member',
        amount: numAmount,
        method: cMethod,
        ref: finalRef,
        date: cDate,
        newPct,
        unlockedMilestone: newlyUnlocked,
      });
      setExpandedProjectId(contribProject.id);
    } finally {
      setCSaving(false);
    }
  };

  const selectedContribProjectStats = useMemo(
    () => enrichedProjects.find((p) => p.project.id === contribProject?.id) ?? null,
    [enrichedProjects, contribProject]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className="text-xl sm:text-2xl font-extrabold tracking-tight"
            style={{ color: 'var(--cv-text)' }}
          >
            Projects &amp; Event Fundraisers
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--cv-text-muted)' }}>
            Track collective investments, celebration kitties, milestone targets, and individual shares.
          </p>
        </div>

        {isTreasurer ? (
          <button
            type="button"
            onClick={openNewProjectModal}
            className="vault-btn-primary !py-2.5 !px-4 !text-xs self-start sm:self-auto"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Fundraiser</span>
          </button>
        ) : (
          <span className="vault-badge-info py-1 px-3 self-start sm:self-auto">
            <Lock className="w-3 h-3" /> Read-Only Milestone View
          </span>
        )}
      </div>

      {/* Portfolio KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Total Project Funds
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-positive)' }}
          >
            {formatCurrency(portfolio.totalRaised, settings.currency)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cv-text-muted)' }}>
            {projectContributions.length} individual pledges
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Combined Goal Target
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-text)' }}
          >
            {formatCurrency(portfolio.totalTarget, settings.currency)}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cv-text-muted)' }}>
            {portfolio.activeCount} active · {projects.length} total
          </p>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Portfolio Progress
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-accent)' }}
          >
            {portfolio.overallPct}%
          </p>
          <div className="vault-progress-track h-1.5 mt-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${portfolio.overallPct}%` }}
              transition={SPRING_PHYSICS}
              className="vault-progress-fill h-full rounded-full"
            />
          </div>
        </div>

        <div className="glass-card p-4">
          <p className="text-xs font-medium" style={{ color: 'var(--cv-text-muted)' }}>
            Milestones Achieved
          </p>
          <p
            className="text-lg sm:text-xl font-extrabold tabular-nums mt-1"
            style={{ color: 'var(--cv-text)' }}
          >
            {portfolio.reachedMilestones} / {portfolio.totalMilestones}
          </p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cv-text-muted)' }}>
            Auto-verified on deposit
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'all', label: 'All Projects' },
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Completed' },
              { id: 'investment', label: 'Land & Investments' },
              { id: 'social', label: 'Events & Welfare' },
            ] as const
          ).map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{
                  background: active ? 'var(--cv-accent-soft-strong)' : 'transparent',
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

        <div className="relative lg:w-72">
          <Search
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--cv-text-subtle)' }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects or milestones…"
            className="vault-input !pl-10 !py-2 !text-xs"
          />
        </div>
      </div>

      {/* Project Cards */}
      {visibleProjects.length === 0 ? (
        <div className="glass-card p-10 text-center space-y-3">
          <Target
            className="w-9 h-9 mx-auto"
            style={{ color: 'var(--cv-text-subtle)' }}
          />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--cv-text)' }}>
              No Fundraisers Match This Filter
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--cv-text-muted)' }}>
              {projects.length === 0
                ? 'Create a land purchase, emergency welfare fund, or annual gala goal.'
                : 'Try selecting "All Projects" or clearing your search.'}
            </p>
          </div>
          {projects.length === 0 && isTreasurer && (
            <button
              type="button"
              onClick={openNewProjectModal}
              className="vault-btn-primary !text-xs"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Create First Fundraiser</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleProjects.map((item) => {
            const isExpanded = expandedProjectId === item.project.id;
            const countdown = formatCountdownBadge(item.daysLeft);
            const myContribution = !isTreasurer
              ? item.memberTotals.find(
                  (mt) => mt.memberId === settings.viewingMemberId
                )?.total ?? 0
              : 0;

            return (
              <motion.article
                key={item.project.id}
                layout="position"
                transition={SPRING_PHYSICS}
                className="glass-card-hero p-5 space-y-4"
              >
                {/* Top Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="vault-badge-accent text-[11px]">
                        {PROJECT_CATEGORY_LABELS[item.project.category]}
                      </span>
                      {item.project.status === 'completed' ? (
                        <span className="vault-badge-positive text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> Goal Achieved
                        </span>
                      ) : item.project.status === 'paused' ? (
                        <span className="vault-badge-warning text-[11px]">Paused</span>
                      ) : (
                        <span className="vault-badge-info text-[11px] tabular-nums">
                          <Calendar className="w-3 h-3" /> {countdown.label}
                        </span>
                      )}
                    </div>

                    <h2
                      className="text-lg font-extrabold tracking-tight pt-0.5"
                      style={{ color: 'var(--cv-text)' }}
                    >
                      {item.project.title}
                    </h2>
                    {item.project.description && (
                      <p
                        className="text-xs leading-relaxed max-w-2xl"
                        style={{ color: 'var(--cv-text-muted)' }}
                      >
                        {item.project.description}
                      </p>
                    )}
                  </div>

                  {isTreasurer && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditProjectModal(item.project)}
                        className="vault-btn-secondary !py-1.5 !px-3 !text-xs"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openContributeModal(item.project)}
                        className="vault-btn-primary !py-1.5 !px-3.5 !text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Contribute</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar Block */}
                <div className="glass-subtle p-4 space-y-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span
                        className="text-xl sm:text-2xl font-extrabold tabular-nums"
                        style={{ color: 'var(--cv-text)' }}
                      >
                        {formatCurrency(item.raised, settings.currency)}
                      </span>
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: 'var(--cv-text-muted)' }}
                      >
                        raised of{' '}
                        {formatCurrency(item.project.targetAmount, settings.currency)}
                      </span>
                    </div>
                    <span
                      className="text-base font-extrabold tabular-nums"
                      style={{
                        color:
                          item.pct >= 100 ? 'var(--cv-positive)' : 'var(--cv-accent)',
                      }}
                    >
                      {item.pct}%
                    </span>
                  </div>

                  <div className="vault-progress-track h-3 relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.pct}%` }}
                      transition={SPRING_PHYSICS}
                      className="vault-progress-fill h-full rounded-full"
                    />
                  </div>

                  <div
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                    style={{ color: 'var(--cv-text-muted)' }}
                  >
                    <span className="tabular-nums">
                      {item.remaining > 0
                        ? `${formatCurrency(
                            item.remaining,
                            settings.currency
                          )} remaining · Target date ${formatDisplayDate(
                            item.project.deadline
                          )}`
                        : '100% funded and locked in group vault'}
                    </span>

                    {!isTreasurer ? (
                      <span
                        className="font-semibold tabular-nums"
                        style={{ color: 'var(--cv-accent)' }}
                      >
                        Your Share: {formatCurrency(myContribution, settings.currency)}
                      </span>
                    ) : (
                      item.nextMilestone && (
                        <span
                          className="font-medium tabular-nums inline-flex items-center gap-1"
                          style={{ color: 'var(--cv-text-secondary)' }}
                        >
                          <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--cv-accent)' }} />
                          {formatCurrency(
                            Math.max(0, item.nextMilestone.targetAmount - item.raised),
                            settings.currency
                          )}{' '}
                          to next milestone
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Visual Milestone Checkpoints Grid */}
                {item.milestones.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {item.milestones.map((ms, idx) => (
                      <div
                        key={ms.id}
                        className="rounded-xl p-3 border flex items-start gap-2.5 transition-colors"
                        style={{
                          background: ms.isReached
                            ? 'var(--cv-positive-soft)'
                            : 'var(--cv-surface-subtle)',
                          borderColor: ms.isReached
                            ? 'var(--cv-positive-border)'
                            : 'var(--cv-border-subtle)',
                        }}
                      >
                        {ms.isReached ? (
                          <CheckCircle2
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{ color: 'var(--cv-positive)' }}
                          />
                        ) : (
                          <Circle
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{ color: 'var(--cv-text-subtle)' }}
                          />
                        )}
                        <div className="min-w-0">
                          <p
                            className="text-[11px] font-bold uppercase tracking-wider tabular-nums"
                            style={{
                              color: ms.isReached
                                ? 'var(--cv-positive)'
                                : 'var(--cv-text-muted)',
                            }}
                          >
                            M{idx + 1} · {ms.pctOfGoal}%
                          </p>
                          <p
                            className="text-xs font-semibold leading-snug mt-0.5"
                            style={{ color: 'var(--cv-text)' }}
                          >
                            {ms.label}
                          </p>
                          <p
                            className="text-[11px] font-mono tabular-nums mt-1"
                            style={{ color: 'var(--cv-text-muted)' }}
                          >
                            {formatCurrency(ms.targetAmount, settings.currency)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expandable Individual Contributions Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedProjectId(isExpanded ? null : item.project.id!)
                    }
                    className="w-full flex items-center justify-between py-2 px-3 rounded-xl border text-xs font-semibold transition-colors hover:bg-[var(--cv-surface-hover)]"
                    style={{
                      borderColor: 'var(--cv-border-subtle)',
                      color: 'var(--cv-text-secondary)',
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Flag className="w-3.5 h-3.5" style={{ color: 'var(--cv-accent)' }} />
                      Individual Contributions ({item.entries.length} entries ·{' '}
                      {item.memberTotals.length} contributors)
                    </span>
                    <motion.span
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={SPRING_PHYSICS}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={SPRING_PHYSICS}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
                          {/* Contributor Share Leaderboard */}
                          <div className="lg:col-span-5 glass-subtle p-3.5 space-y-2.5">
                            <p
                              className="text-xs font-bold"
                              style={{ color: 'var(--cv-text)' }}
                            >
                              Member Share Breakdown
                            </p>
                            {item.memberTotals.length === 0 ? (
                              <p
                                className="text-xs py-3"
                                style={{ color: 'var(--cv-text-muted)' }}
                              >
                                No member contributions yet.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {item.memberTotals.map((mt) => (
                                  <div key={mt.memberId} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs">
                                      <span
                                        className="font-medium truncate"
                                        style={{ color: 'var(--cv-text-secondary)' }}
                                      >
                                        {mt.member?.name ?? 'Member'}
                                      </span>
                                      <span
                                        className="font-bold tabular-nums"
                                        style={{ color: 'var(--cv-text)' }}
                                      >
                                        {formatCurrency(mt.total, settings.currency)}{' '}
                                        <span
                                          className="font-normal"
                                          style={{ color: 'var(--cv-text-muted)' }}
                                        >
                                          ({mt.sharePct}%)
                                        </span>
                                      </span>
                                    </div>
                                    <div className="vault-progress-track h-1.5">
                                      <div
                                        className="vault-progress-fill h-full rounded-full"
                                        style={{ width: `${Math.max(4, mt.sharePct)}%` }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Individual Contribution Receipts */}
                          <div className="lg:col-span-7 glass-subtle p-3.5 space-y-2">
                            <p
                              className="text-xs font-bold"
                              style={{ color: 'var(--cv-text)' }}
                            >
                              Contribution Ledger Entries
                            </p>
                            {item.entries.length === 0 ? (
                              <p
                                className="text-xs py-3"
                                style={{ color: 'var(--cv-text-muted)' }}
                              >
                                Record the first contribution to start unlocking milestones.
                              </p>
                            ) : (
                              <div
                                className="divide-y max-h-56 overflow-y-auto pr-1"
                                style={{ borderColor: 'var(--cv-border-subtle)' }}
                              >
                                {item.entries.map((entry) => {
                                  const m = memberMap.get(entry.memberId);
                                  return (
                                    <div
                                      key={entry.id}
                                      className="py-2 flex items-center justify-between gap-2.5 text-xs"
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                          className={`w-7 h-7 rounded-lg bg-gradient-to-br ${
                                            m?.avatarHue ?? 'from-amber-500 to-orange-600'
                                          } text-white text-[10px] font-bold flex items-center justify-center shrink-0`}
                                        >
                                          {getInitials(m?.name ?? 'CV')}
                                        </div>
                                        <div className="min-w-0">
                                          <p
                                            className="font-semibold truncate"
                                            style={{ color: 'var(--cv-text)' }}
                                          >
                                            {m?.name ?? 'Member'}
                                          </p>
                                          <p
                                            className="text-[11px] truncate"
                                            style={{ color: 'var(--cv-text-muted)' }}
                                          >
                                            {formatDisplayDate(entry.date)} ·{' '}
                                            {PAYMENT_METHOD_LABELS[entry.paymentMethod].short}
                                            {isTreasurer ||
                                            entry.memberId === settings.viewingMemberId
                                              ? ` · ${entry.referenceCode}`
                                              : ''}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <span
                                          className="font-bold tabular-nums"
                                          style={{ color: 'var(--cv-positive)' }}
                                        >
                                          +{formatCurrency(entry.amount, settings.currency)}
                                        </span>
                                        {isTreasurer && (
                                          <button
                                            type="button"
                                            aria-label="Remove project contribution"
                                            onClick={() =>
                                              deleteProjectContribution(entry.id!)
                                            }
                                            className="p-1 rounded opacity-65 hover:opacity-100"
                                            style={{ color: 'var(--cv-danger)' }}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* Log Project Contribution Modal */}
      <ModalShell
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        title={cReceipt ? 'Project Deposit Verified' : 'Contribute to Fundraiser'}
        subtitle={cReceipt ? undefined : contribProject?.title}
      >
        {cReceipt ? (
          <SuccessCheckmarkView
            title="Project Contribution Recorded"
            amountFormatted={formatCurrency(cReceipt.amount, settings.currency)}
            subtitle={`${cReceipt.projectName} is now ${cReceipt.newPct}% funded`}
            milestoneUnlocked={cReceipt.unlockedMilestone}
            details={[
              { label: 'Contributor', value: cReceipt.memberName },
              { label: 'Project', value: cReceipt.projectName },
              {
                label: 'Payment Channel',
                value: PAYMENT_METHOD_LABELS[cReceipt.method].label,
              },
              { label: 'Reference', value: cReceipt.ref, mono: true },
              { label: 'Date', value: formatDisplayDate(cReceipt.date) },
            ]}
            onDone={() => setContribOpen(false)}
            onSecondary={() => contribProject && openContributeModal(contribProject)}
            secondaryLabel="Add Another"
          />
        ) : members.length === 0 ? (
          <p className="text-xs py-6 text-center" style={{ color: 'var(--cv-text-muted)' }}>
            Please register at least one member in the Members tab first.
          </p>
        ) : (
          <form onSubmit={handleContributeSubmit} className="space-y-3.5">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Contributing Member
              </label>
              <select
                value={cMemberId}
                onChange={(e) => setCMemberId(Number(e.target.value))}
                className="vault-input font-medium"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.memberCode} · {m.name}
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
                  {selectedContribProjectStats?.nextMilestone && (
                    <button
                      type="button"
                      onClick={() =>
                        setCAmount(
                          String(
                            Math.max(
                              1,
                              selectedContribProjectStats.nextMilestone!.targetAmount -
                                selectedContribProjectStats.raised
                            )
                          )
                        )
                      }
                      className="text-[11px] font-semibold hover:underline"
                      style={{ color: 'var(--cv-accent)' }}
                    >
                      Unlock milestone
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={cAmount}
                  onChange={(e) => setCAmount(e.target.value)}
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
                  value={cMethod}
                  onChange={(e) => setCMethod(e.target.value as PaymentMethod)}
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
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={cDate}
                  onChange={(e) => setCDate(e.target.value)}
                  className="vault-input tabular-nums"
                />
              </div>
              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--cv-text-secondary)' }}
                >
                  Receipt Reference
                </label>
                <input
                  type="text"
                  value={cRef}
                  onChange={(e) => setCRef(e.target.value)}
                  className="vault-input font-mono"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Note (Optional)
              </label>
              <input
                type="text"
                value={cNote}
                onChange={(e) => setCNote(e.target.value)}
                placeholder="e.g. Plot equity instalment / gala ticket"
                className="vault-input"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setContribOpen(false)}
                className="vault-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={cSaving}
                className="vault-btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>{cSaving ? 'Saving…' : 'Record Contribution'}</span>
              </button>
            </div>
          </form>
        )}
      </ModalShell>

      {/* Create / Edit Project Modal */}
      <ModalShell
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={editingProject ? 'Edit Project & Milestones' : 'Create Project Fundraiser'}
        subtitle="Define a financial goal, target deadline, and automated milestone checkpoints."
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSaveProject} className="space-y-3.5">
          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Project or Event Title *
            </label>
            <input
              type="text"
              required
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="e.g. Greenhouse Agribusiness Unit / End-Year Party"
              className="vault-input font-semibold"
            />
          </div>

          <div>
            <label
              className="block text-xs font-semibold mb-1.5"
              style={{ color: 'var(--cv-text-secondary)' }}
            >
              Description
            </label>
            <textarea
              rows={2}
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              placeholder="Purpose, member share guideline, and execution plan…"
              className="vault-input resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Category
              </label>
              <select
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value as ProjectCategory)}
                className="vault-input"
              >
                {(Object.keys(PROJECT_CATEGORY_LABELS) as ProjectCategory[]).map(
                  (cat) => (
                    <option key={cat} value={cat}>
                      {PROJECT_CATEGORY_LABELS[cat]}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Target ({settings.currency}) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={pTarget}
                onChange={(e) => setPTarget(e.target.value)}
                className="vault-input tabular-nums font-bold"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Target Deadline
              </label>
              <input
                type="date"
                required
                value={pDeadline}
                onChange={(e) => setPDeadline(e.target.value)}
                className="vault-input tabular-nums"
              />
            </div>
          </div>

          {editingProject && (
            <div>
              <label
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--cv-text-secondary)' }}
              >
                Project Status
              </label>
              <select
                value={pStatus}
                onChange={(e) => setPStatus(e.target.value as ProjectStatus)}
                className="vault-input"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          )}

          {/* Milestones Builder */}
          <div className="glass-subtle p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold" style={{ color: 'var(--cv-text)' }}>
                Milestone Checkpoints ({pMilestones.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPMilestones(buildAutoMilestones(pTarget))}
                  className="vault-btn-ghost !text-[11px] !py-1 !px-2"
                >
                  Auto 25–100%
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPMilestones((prev) => [
                      ...prev,
                      {
                        key: `ms-${Date.now()}`,
                        label: '',
                        targetAmount: pTarget,
                      },
                    ])
                  }
                  className="vault-btn-ghost !text-[11px] !py-1 !px-2"
                  style={{ color: 'var(--cv-accent)' }}
                >
                  + Add Milestone
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pMilestones.map((ms, idx) => (
                <div key={ms.key} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ms.label}
                    onChange={(e) =>
                      setPMilestones((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, label: e.target.value } : item
                        )
                      )
                    }
                    placeholder={`Milestone #${idx + 1} title`}
                    className="vault-input !py-1.5 !text-xs flex-1"
                  />
                  <input
                    type="number"
                    min="1"
                    value={ms.targetAmount}
                    onChange={(e) =>
                      setPMilestones((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? { ...item, targetAmount: e.target.value }
                            : item
                        )
                      )
                    }
                    placeholder="Amount"
                    className="vault-input !py-1.5 !text-xs !w-28 tabular-nums"
                  />
                  <button
                    type="button"
                    aria-label="Remove milestone"
                    onClick={() =>
                      setPMilestones((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="p-1.5 rounded-lg"
                    style={{ color: 'var(--cv-danger)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {editingProject ? (
              confirmDeleteProject ? (
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  className="px-3 py-2 rounded-xl text-xs font-bold border"
                  style={{
                    background: 'var(--cv-danger-soft)',
                    borderColor: 'var(--cv-danger-border)',
                    color: 'var(--cv-danger)',
                  }}
                >
                  Confirm Delete Project
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteProject(true)}
                  className="vault-btn-ghost !text-xs"
                  style={{ color: 'var(--cv-danger)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProjectModalOpen(false)}
                className="vault-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="vault-btn-primary">
                {editingProject ? 'Save Project' : 'Launch Fundraiser'}
              </button>
            </div>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};
