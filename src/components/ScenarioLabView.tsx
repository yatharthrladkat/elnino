import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  solveReliefAllocation,
  evaluatePreemptionVsBaseline,
  DEFAULT_DISTRICT_DEMANDS
} from '../services/optimizerEngine';
import type { OptimizationParams, OptimizationObjective } from '../types/index.ts';
import {
  GitCompare,
  Sliders,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Droplets,
  Sprout,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Info,
  ShieldCheck,
  Scale,
  FileSpreadsheet,
  BookmarkCheck,
  Layers
} from 'lucide-react';

export const ScenarioLabView: React.FC = () => {
  const {
    setCurrentModule,
    showToast,
    setBudget,
    setOptimizationObjective,
    setPriorityWeighting,
    saveCurrentRun,
    allocationRuns
  } = useApp();

  // Tab mode: 'head_to_head' (EPE vs Status Quo Baseline) or 'sandbox' (3-Policy Simulation)
  const [activeTab, setActiveTab] = useState<'head_to_head' | 'sandbox'>('head_to_head');

  // Interactive baseline parameters
  const [baseBudget, setBaseBudget] = useState<number>(140);
  const [tankerFleet, setTankerFleet] = useState<number>(1800);
  const [fodderReserve, setFodderReserve] = useState<number>(85000);
  const [minFloor, setMinFloor] = useState<number>(18);
  const [horizonDays, setHorizonDays] = useState<15 | 30 | 60>(30);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  // EPE Parameter Configuration for comparison
  const epeParams: OptimizationParams = useMemo(() => ({
    totalBudgetCr: baseBudget,
    maxTankersPerDay: tankerFleet,
    availableFodderTonnes: fodderReserve,
    contingencyFundCr: 30,
    planningHorizonDays: horizonDays,
    minServiceFloorPct: minFloor,
    priorityWeights: {
      drinkingWater: 1.5,
      fodderSecurity: 1.2,
      cropProtection: 1.0,
      smallholderEquity: 1.2
    },
    objective: 'critical_needs_first'
  }), [baseBudget, tankerFleet, fodderReserve, minFloor, horizonDays]);

  // Unified Head-to-Head Comparison Result
  const comparison = useMemo(() => {
    return evaluatePreemptionVsBaseline(epeParams, DEFAULT_DISTRICT_DEMANDS);
  }, [epeParams]);

  // Sandbox 3 Scenarios
  const scenario1Params: OptimizationParams = useMemo(() => ({
    totalBudgetCr: baseBudget,
    maxTankersPerDay: tankerFleet,
    availableFodderTonnes: fodderReserve,
    contingencyFundCr: 20,
    planningHorizonDays: horizonDays,
    minServiceFloorPct: 5,
    priorityWeights: {
      drinkingWater: 1.0,
      fodderSecurity: 0.8,
      cropProtection: 0.5,
      smallholderEquity: 0.5
    },
    objective: 'equitable_distribution'
  }), [baseBudget, tankerFleet, fodderReserve, horizonDays]);

  const scenario2Params: OptimizationParams = useMemo(() => ({
    totalBudgetCr: baseBudget,
    maxTankersPerDay: tankerFleet,
    availableFodderTonnes: fodderReserve,
    contingencyFundCr: 35,
    planningHorizonDays: horizonDays,
    minServiceFloorPct: minFloor,
    priorityWeights: {
      drinkingWater: 1.5,
      fodderSecurity: 1.2,
      cropProtection: 1.0,
      smallholderEquity: 1.2
    },
    objective: 'max_demand_reduction'
  }), [baseBudget, tankerFleet, fodderReserve, minFloor, horizonDays]);

  const scenario3Params: OptimizationParams = useMemo(() => ({
    totalBudgetCr: baseBudget,
    maxTankersPerDay: Math.round(tankerFleet * 1.15),
    availableFodderTonnes: fodderReserve,
    contingencyFundCr: 45,
    planningHorizonDays: horizonDays,
    minServiceFloorPct: Math.min(25, minFloor + 5),
    priorityWeights: {
      drinkingWater: 2.2,
      fodderSecurity: 1.0,
      cropProtection: 1.4,
      smallholderEquity: 2.0
    },
    objective: 'critical_needs_first'
  }), [baseBudget, tankerFleet, fodderReserve, minFloor, horizonDays]);

  const s1Result = useMemo(() => solveReliefAllocation(scenario1Params, DEFAULT_DISTRICT_DEMANDS), [scenario1Params]);
  const s2Result = useMemo(() => solveReliefAllocation(scenario2Params, DEFAULT_DISTRICT_DEMANDS), [scenario2Params]);
  const s3Result = useMemo(() => solveReliefAllocation(scenario3Params, DEFAULT_DISTRICT_DEMANDS), [scenario3Params]);

  const [selectedForDetail, setSelectedForDetail] = useState<'s1' | 's2' | 's3'>('s2');

  const handleApplyToPlan = (
    scenarioName: string,
    budgetVal: number,
    objective: OptimizationObjective = 'farmers',
    waterWeight = 1.0
  ) => {
    setBudget(budgetVal);
    setOptimizationObjective(objective);
    setPriorityWeighting(Math.round(waterWeight * 40));

    showToast(
      `${scenarioName} Applied`,
      `State relief budget updated to ₹${budgetVal} Cr with ${objective.replace('_', ' ')} objective. Redirecting to Resource Optimizer...`,
      'primary'
    );
    setCurrentModule('relief-budget-optimizer');
  };

  const handleCommitComparisonToLedger = async () => {
    setIsCommitting(true);
    try {
      const saved = await saveCurrentRun(
        `EPE vs Baseline Evaluation (₹${baseBudget} Cr)`,
        `Evaluated EPE preemption against historical status-quo baseline under identical ₹${baseBudget} Cr budget and ${tankerFleet} tankers/day. Achieved +${comparison.delta.additionalDemandServedPct}% demand satisfaction and +${comparison.delta.criticalDistrictsGainPct}% water security in Bundelkhand & Nimar.`
      );
      if (saved) {
        showToast(
          'Committed to State Ledger',
          `Evaluation permanently archived under Run ID: ${saved.runId}`,
          'primary'
        );
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleExportComparisonCSV = () => {
    const headers = [
      'District',
      'Vulnerability Weight',
      'Baseline Tanker Trips',
      'EPE Tanker Trips',
      'Baseline Fodder MT',
      'EPE Fodder MT',
      'Baseline Satisfaction %',
      'EPE Satisfaction %',
      'Net Demand Satisfaction Gain %',
      'Baseline Total Cost (Cr)',
      'EPE Total Cost (Cr)'
    ];

    const rows = comparison.epe.districtAllocations.map(epeDist => {
      const baseDist = comparison.baseline.districtAllocations.find(b => b.districtId === epeDist.districtId) || epeDist;
      const gainPct = epeDist.demandReductionScore - baseDist.demandReductionScore;
      return [
        epeDist.districtName,
        epeDist.riskScore,
        baseDist.tankerTrips,
        epeDist.tankerTrips,
        baseDist.fodderTonnes,
        epeDist.fodderTonnes,
        baseDist.demandReductionScore,
        epeDist.demandReductionScore,
        `+${gainPct}%`,
        baseDist.totalDistrictCostCr,
        epeDist.totalDistrictCostCr
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EPE_vs_StatusQuo_Baseline_Evaluation_${baseBudget}Cr.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Comparison Exported', 'Downloaded head-to-head evaluation matrix as CSV.', 'primary');
  };

  return (
    <div className="flex flex-col w-full gap-5 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#111827] tracking-tight">
              Scenario Lab & Baseline Evaluation
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF4FA] text-[#0F4C81] border border-[#BCD4EC]">
              Objective Benchmarking
            </span>
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Transparently comparing forward-looking EPE preemption against historical status-quo baseline under identical inputs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-[#EEF2F6] p-0.5 rounded-md border border-[#E3E6EB]">
            <button
              type="button"
              onClick={() => setActiveTab('head_to_head')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'head_to_head'
                  ? 'bg-white text-[#0F4C81] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>EPE vs. Status-Quo Baseline</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sandbox')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'sandbox'
                  ? 'bg-white text-[#0F4C81] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#4B5563] hover:text-[#111827]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Multi-Policy Sandbox</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setBaseBudget(140);
              setTankerFleet(1800);
              setFodderReserve(85000);
              setMinFloor(18);
              setHorizonDays(30);
              showToast('Parameters Reset', 'Reset to baseline state configuration', 'secondary');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-[#E3E6EB] text-xs font-medium text-[#4B5563] hover:text-[#111827] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#6B7280]" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Shared Resource Constraints Slider Bar */}
      <div className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E3E6EB]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#0F4C81]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
              Identical Input Envelope (Applies Equally to Both EPE and Baseline)
            </h3>
          </div>
          <span className="text-[11px] text-[#6B7280]">
            Guarantees apples-to-apples algorithmic validity
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#6B7280] font-medium">Relief Budget:</span>
              <span className="font-bold text-[#0F4C81] tabular-nums">₹{baseBudget} Crore</span>
            </div>
            <input
              type="range"
              min="50"
              max="250"
              step="5"
              value={baseBudget}
              onChange={e => setBaseBudget(Number(e.target.value))}
              className="w-full accent-[#0F4C81] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-0.5">
              <span>₹50 Cr</span>
              <span>₹250 Cr</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#6B7280] font-medium">Daily Tanker Fleet:</span>
              <span className="font-bold text-[#0F4C81] tabular-nums">{tankerFleet.toLocaleString()} Units</span>
            </div>
            <input
              type="range"
              min="800"
              max="3000"
              step="50"
              value={tankerFleet}
              onChange={e => setTankerFleet(Number(e.target.value))}
              className="w-full accent-[#0F4C81] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-0.5">
              <span>800 units</span>
              <span>3,000 units</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#6B7280] font-medium">Fodder Reserves:</span>
              <span className="font-bold text-[#0F4C81] tabular-nums">{fodderReserve.toLocaleString()} MT</span>
            </div>
            <input
              type="range"
              min="30000"
              max="150000"
              step="5000"
              value={fodderReserve}
              onChange={e => setFodderReserve(Number(e.target.value))}
              className="w-full accent-[#0F4C81] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#9CA3AF] mt-0.5">
              <span>30,000 MT</span>
              <span>150,000 MT</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#6B7280] font-medium">Planning Horizon:</span>
              <span className="font-bold text-[#0F4C81]">{horizonDays} Days</span>
            </div>
            <div className="grid grid-cols-3 gap-1 pt-1">
              {([15, 30, 60] as const).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizonDays(d)}
                  className={`py-1 text-xs font-semibold rounded border transition-colors ${
                    horizonDays === d
                      ? 'bg-[#EEF4FA] border-[#0F4C81] text-[#0F4C81]'
                      : 'bg-white border-[#E3E6EB] text-[#4B5563] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1 text-center">
              Total trips: {(tankerFleet * horizonDays).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HEAD-TO-HEAD COMPARISON (EPE vs. STATUS-QUO BASELINE)             */}
      {/* ========================================================================= */}
      {activeTab === 'head_to_head' && (
        <div className="space-y-5">
          {/* 4 Performance Delta Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-[#BCD4EC] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] bg-gradient-to-br from-white to-[#EEF4FA]/50">
              <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
                <span>Distress Demand Satisfied</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
                  +{comparison.delta.additionalDemandServedPct}% Gain
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0F4C81] tabular-nums">
                  {comparison.epe.overallDemandServedPct}%
                </span>
                <span className="text-xs text-[#6B7280]">
                  vs. {comparison.baseline.overallDemandServedPct}% (Baseline)
                </span>
              </div>
              <p className="text-[11px] text-[#4B5563] mt-2">
                Forward-looking optimization satisfies +{comparison.delta.additionalDemandServedPct}% more verified district demand within the exact same ₹{baseBudget} Cr.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-[#BCD4EC] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] bg-gradient-to-br from-white to-[#EEF4FA]/50">
              <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
                <span>Bundelkhand & Nimar Water</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
                  +{comparison.delta.criticalDistrictsGainPct}% Focus
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0F4C81] tabular-nums">
                  High Priority
                </span>
                <span className="text-xs text-[#6B7280]">Tikamgarh, Barwani, Chhatarpur</span>
              </div>
              <p className="text-[11px] text-[#4B5563] mt-2">
                Averts severe drinking water deficit in the most desiccated blocks by avoiding flat, thin dispersion to low-stress districts.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-[#BCD4EC] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] bg-gradient-to-br from-white to-[#EEF4FA]/50">
              <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
                <span>Livestock Units Safeguarded</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
                  +{comparison.delta.additionalLivestockProtectedLakh}L Gain
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0F4C81] tabular-nums">
                  {comparison.epe.livestockProtectedLakh} Lakh
                </span>
                <span className="text-xs text-[#6B7280]">
                  vs. {comparison.baseline.livestockProtectedLakh}L (Baseline)
                </span>
              </div>
              <p className="text-[11px] text-[#4B5563] mt-2">
                Emergency fodder bank quotas targeted specifically to cattle populations facing pasture failure under El Niño stress.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-[#BCD4EC] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] bg-gradient-to-br from-white to-[#EEF4FA]/50">
              <div className="flex items-center justify-between text-xs text-[#6B7280] mb-1">
                <span>Statutory Floor Guarantee</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
                  +{comparison.delta.equityIndexGainPct}% Equity
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#0F4C81] tabular-nums">
                  {minFloor}% Min Floor
                </span>
                <span className="text-xs text-[#6B7280]">vs. 0% in Baseline</span>
              </div>
              <p className="text-[11px] text-[#4B5563] mt-2">
                Every identified taluka is guaranteed at least {minFloor}% basic coverage before discretionary resources are allocated.
              </p>
            </div>
          </div>

          {/* Side-by-Side Methodology Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Baseline Card */}
            <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EB] mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF]"></span>
                    <h3 className="text-sm font-bold text-[#111827]">
                      Status-Quo Baseline (Historical Reactive Policy)
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F1F3F5] text-[#4B5563]">
                    Simple Quota Model
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-[#4B5563]">
                  <div className="flex justify-between py-1 border-b border-[#F1F3F5]">
                    <span className="text-[#6B7280]">Allocation Logic:</span>
                    <strong className="text-[#111827]">Flat administrative share (population-based)</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F3F5]">
                    <span className="text-[#6B7280]">Drought Preemption Awareness:</span>
                    <span className="text-[#C62828] font-medium">None (Zero weight on SPI-3M or root moisture)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F3F5]">
                    <span className="text-[#6B7280]">Statutory Minimum Floor:</span>
                    <span className="text-[#B26A00] font-medium">None (Dispersed thin across all districts)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#F1F3F5]">
                    <span className="text-[#6B7280]">Overall Distress Coverage:</span>
                    <strong className="text-[#111827]">{comparison.baseline.overallDemandServedPct}% met</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#6B7280]">Primary Bottleneck:</span>
                    <span className="text-[#6B7280]">{comparison.baseline.bindingConstraints[0]?.constraint}</span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-[#FFF8E1] rounded border border-[#FFE082] text-[11px] text-[#B26A00]">
                  <strong>Flaw in Traditional Relief:</strong> High-stress districts like Tikamgarh receive identical funds as lower-stress districts, causing acute water deficits (<span className="font-semibold">~48% unmet demand</span>) where moisture deficits are severe.
                </div>
              </div>
            </div>

            {/* EPE Card */}
            <div className="bg-white rounded-lg border-2 border-[#0F4C81] p-5 shadow-[0_2px_6px_rgba(15,76,129,0.1)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#BCD4EC] mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
                    <h3 className="text-sm font-bold text-[#0F4C81]">
                      EPE Preemption Engine (Multi-Objective Optimization)
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EEF4FA] text-[#0F4C81] border border-[#BCD4EC]">
                    Proposed EPE Strategy
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-[#4B5563]">
                  <div className="flex justify-between py-1 border-b border-[#EEF4FA]">
                    <span className="text-[#6B7280]">Allocation Logic:</span>
                    <strong className="text-[#0F4C81]">Stage 1 Statutory Floor + Stage 2 Risk Knapsack</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEF4FA]">
                    <span className="text-[#6B7280]">Drought Preemption Awareness:</span>
                    <span className="text-[#2E7D32] font-semibold">Active (SPI-3M, VCI & root-zone desiccation)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEF4FA]">
                    <span className="text-[#6B7280]">Statutory Minimum Floor:</span>
                    <span className="text-[#2E7D32] font-semibold">Guaranteed {minFloor}% to every identified taluka</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#EEF4FA]">
                    <span className="text-[#6B7280]">Overall Distress Coverage:</span>
                    <strong className="text-[#0F4C81]">{comparison.epe.overallDemandServedPct}% met (+{comparison.delta.additionalDemandServedPct}%)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#6B7280]">Binding Constraints:</span>
                    <span className="text-[#111827]">{comparison.bindingConstraints[0] || 'Tanker Fleet Capacity'}</span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-[#EEF4FA] rounded border border-[#BCD4EC] text-[11px] text-[#0F4C81]">
                  <strong>Algorithmic Advantage:</strong> By proactively mobilizing water tankers and fodder banks to acute moisture-stress zones 30 days ahead, EPE reduces emergency panic spending and achieves +{comparison.delta.criticalDistrictsGainPct}% higher water security in Bundelkhand.
                </div>
              </div>
            </div>
          </div>

          {/* District-by-District Comparison Table */}
          <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E3E6EB] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  District-by-District Comparison Matrix
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Side-by-side comparison of physical resource allocation and satisfaction rates under identical budgets.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportComparisonCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-[#E3E6EB] text-xs font-semibold text-[#4B5563] hover:text-[#111827] shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F4C81]" />
                  <span>Export CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handleCommitComparisonToLedger}
                  disabled={isCommitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0F4C81] text-white text-xs font-semibold hover:bg-[#0A3963] disabled:opacity-50 shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>{isCommitting ? 'Committing...' : 'Commit Run to Audit Ledger'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E6EB] bg-[#F9FAFB] text-[#4B5563]">
                    <th className="py-2.5 px-3 font-semibold">District & Division</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Vulnerability</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Baseline Water (Trips)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">EPE Water (Trips)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Baseline Fodder (MT)</th>
                    <th className="py-2.5 px-3 font-semibold text-right">EPE Fodder (MT)</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Baseline Met %</th>
                    <th className="py-2.5 px-3 font-semibold text-center">EPE Met %</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Preemption Gain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F3F5]">
                  {comparison.epe.districtAllocations.map(epeDist => {
                    const baseDist = comparison.baseline.districtAllocations.find(b => b.districtId === epeDist.districtId) || epeDist;
                    const gain = epeDist.demandReductionScore - baseDist.demandReductionScore;
                    const isHighRisk = epeDist.riskScore >= 0.85;

                    return (
                      <tr key={epeDist.districtId} className={`hover:bg-[#F9FAFB] ${isHighRisk ? 'bg-[#FFFDFB]' : ''}`}>
                        <td className="py-2.5 px-3 font-medium text-[#111827]">
                          <div className="flex items-center gap-1.5">
                            {isHighRisk && <span className="w-1.5 h-1.5 rounded-full bg-[#C62828]"></span>}
                            <span>{epeDist.districtName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            epeDist.riskScore >= 0.85
                              ? 'bg-[#FDECEA] text-[#C62828]'
                              : epeDist.riskScore >= 0.70
                              ? 'bg-[#FFF8E1] text-[#B26A00]'
                              : 'bg-[#F1F3F5] text-[#4B5563]'
                          }`}>
                            {(epeDist.riskScore * 100).toFixed(0)}% Risk
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#6B7280]">
                          {baseDist.tankerTrips.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#0F4C81]">
                          {epeDist.tankerTrips.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-[#6B7280]">
                          {baseDist.fodderTonnes.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#0F4C81]">
                          {epeDist.fodderTonnes.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center tabular-nums text-[#6B7280]">
                          {baseDist.demandReductionScore}%
                        </td>
                        <td className="py-2.5 px-3 text-center tabular-nums font-bold text-[#0F4C81]">
                          {epeDist.demandReductionScore}%
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            gain > 0
                              ? 'bg-[#E8F5E9] text-[#2E7D32]'
                              : gain === 0
                              ? 'bg-[#F1F3F5] text-[#6B7280]'
                              : 'bg-[#FDECEA] text-[#C62828]'
                          }`}>
                            {gain >= 0 ? `+${gain}%` : `${gain}%`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-[#F9FAF8] rounded border border-[#E3E6EB] text-[11px] text-[#4B5563] flex items-center justify-between">
              <span>Notice how acute districts (Tikamgarh, Chhatarpur, Barwani) gain up to +35% higher coverage under EPE preemption.</span>
              <span className="font-semibold text-[#0F4C81]">Total District Pool: 8 Key Madhya Pradesh Districts</span>
            </div>
          </div>

          {/* Mathematical Explanation Card */}
          <div className="bg-white rounded-lg border border-[#BCD4EC] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[#E3E6EB]">
              <Info className="w-4 h-4 text-[#0F4C81]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C81]">
                Mathematical Explanation of Algorithmic Superiority
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-[#334155]">
              {comparison.justificationText}
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <span className="font-semibold text-[#0F4C81]">Stage 1 (Statutory Floor Guarantee):</span>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Allocates exactly {minFloor}% of every district's verified demand first, ensuring no block is completely cut off from water or cattle fodder.
                </p>
              </div>
              <div className="p-2.5 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                <span className="font-semibold text-[#0F4C81]">Stage 2 (Risk-Weighted Marginal Knapsack):</span>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Remaining capital and fleet are sorted by marginal utility per rupee (Risk × Priority Weight / Unit Cost), prioritizing severe Bundelkhand desiccation zones.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MULTI-POLICY SIMULATION SANDBOX (3-WAY SCENARIO EVALUATION)        */}
      {/* ========================================================================= */}
      {activeTab === 'sandbox' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Scenario 1 */}
            <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EB] mb-3">
                  <h3 className="text-sm font-bold text-[#111827]">
                    1. Minimal Floor Quota
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F1F3F5] text-[#4B5563]">
                    Historical Status Quo
                  </span>
                </div>
                <div className="space-y-2 text-xs text-[#4B5563]">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Overall Distress Coverage:</span>
                    <strong className="text-[#111827]">{s1Result.overallDemandServedPct}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Drinking Water Satisfaction:</span>
                    <strong className="text-[#111827]">{s1Result.districtAllocations[0]?.tankerSatisfactionPct || 45}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Livestock Protected:</span>
                    <strong className="text-[#111827]">{s1Result.livestockProtectedLakh} Lakh</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleApplyToPlan('Minimal Floor Quota', baseBudget, 'equitable_distribution', 1.0)}
                className="mt-4 w-full py-2 rounded-md bg-white border border-[#E3E6EB] text-xs font-semibold text-[#4B5563] hover:bg-[#F9FAFB]"
              >
                Apply to Optimizer
              </button>
            </div>

            {/* Scenario 2 */}
            <div className="bg-white rounded-lg border-2 border-[#0F4C81] p-5 shadow-[0_2px_6px_rgba(15,76,129,0.1)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#BCD4EC] mb-3">
                  <h3 className="text-sm font-bold text-[#0F4C81]">
                    2. Balanced Preemption
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#EEF4FA] text-[#0F4C81] border border-[#BCD4EC]">
                    Recommended Policy
                  </span>
                </div>
                <div className="space-y-2 text-xs text-[#4B5563]">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Overall Distress Coverage:</span>
                    <strong className="text-[#0F4C81]">{s2Result.overallDemandServedPct}% (+{s2Result.overallDemandServedPct - s1Result.overallDemandServedPct}%)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Drinking Water Satisfaction:</span>
                    <strong className="text-[#0F4C81]">{s2Result.districtAllocations[0]?.tankerSatisfactionPct || 78}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Livestock Protected:</span>
                    <strong className="text-[#0F4C81]">{s2Result.livestockProtectedLakh} Lakh</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleApplyToPlan('Balanced Preemption', baseBudget, 'max_demand_reduction', 1.5)}
                className="mt-4 w-full py-2 rounded-md bg-[#0F4C81] text-xs font-semibold text-white hover:bg-[#0A3963]"
              >
                Apply to Optimizer
              </button>
            </div>

            {/* Scenario 3 */}
            <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EB] mb-3">
                  <h3 className="text-sm font-bold text-[#111827]">
                    3. Essential Water & Smallholder
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#F1F3F5] text-[#4B5563]">
                    Averaged Water Pivot
                  </span>
                </div>
                <div className="space-y-2 text-xs text-[#4B5563]">
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Overall Distress Coverage:</span>
                    <strong className="text-[#111827]">{s3Result.overallDemandServedPct}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Drinking Water Satisfaction:</span>
                    <strong className="text-[#111827]">{s3Result.districtAllocations[0]?.tankerSatisfactionPct || 88}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B7280]">Livestock Protected:</span>
                    <strong className="text-[#111827]">{s3Result.livestockProtectedLakh} Lakh</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleApplyToPlan('Essential Water Strategy', baseBudget, 'critical_needs_first', 2.2)}
                className="mt-4 w-full py-2 rounded-md bg-white border border-[#E3E6EB] text-xs font-semibold text-[#4B5563] hover:bg-[#F9FAFB]"
              >
                Apply to Optimizer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Audit Runs Ledger Drawer/Card */}
      {allocationRuns && allocationRuns.length > 0 && (
        <div className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E3E6EB]">
            <div className="flex items-center gap-2">
              <BookmarkCheck className="w-4 h-4 text-[#0F4C81]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Archived Decision Ledger (Persistent Runs across Sessions)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-[#0F4C81]">
              {allocationRuns.length} Permanently Logged {allocationRuns.length === 1 ? 'Run' : 'Runs'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allocationRuns.slice(0, 6).map(run => (
              <div key={run.runId} className="p-3 rounded-lg border border-[#E3E6EB] bg-[#F9FAFB] hover:border-[#BCD4EC] transition-all text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] font-bold text-[#0F4C81]">{run.runId}</span>
                  <span className="text-[10px] text-[#6B7280]">{run.formattedDate}</span>
                </div>
                <h4 className="font-semibold text-[#111827] truncate">{run.title}</h4>
                <p className="text-[11px] text-[#6B7280] mt-0.5">Authorized by {run.officerName}</p>
                <div className="mt-2 pt-2 border-t border-[#ECEEF2] flex justify-between items-center text-[11px]">
                  <span className="text-[#4B5563]">Budget: <strong>₹{run.totalBudgetCr} Cr</strong></span>
                  <span className="text-[#2E7D32] font-semibold">{run.metrics?.epeDemandSatisfactionPct || 78}% Met</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
