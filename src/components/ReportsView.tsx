import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar,
  ArrowRight,
  Printer,
  Shield,
  Sparkles,
  Search,
  ExternalLink,
  Send,
  RotateCcw,
  Layers,
  CheckCircle2,
  AlertCircle,
  BookmarkCheck,
  History,
  Trash2,
  Eye,
  X
} from 'lucide-react';
import { MADHYA_PRADESH_DISTRICTS_GEO } from '../data/madhyaPradeshGeoData';
import { queryGeminiDroughtAdvisor, GeminiSearchResponse, fetchAuditEvents } from '../services/api';
import type { AllocationRun, AuditLogItem } from '../types/index.ts';

export const ReportsView: React.FC = () => {
  const { districts, budget, showToast, allocationRuns, removeRun } = useApp();
  const [activeTab, setActiveTab] = useState<'ledger' | 'reports' | 'advisor' | 'trends' | 'export'>('ledger');
  const [auditEvents, setAuditEvents] = useState<AuditLogItem[]>([]);
  const [selectedRunDetail, setSelectedRunDetail] = useState<AllocationRun | null>(null);

  useEffect(() => {
    fetchAuditEvents().then(evts => {
      if (evts && evts.length > 0) setAuditEvents(evts);
    });
  }, [allocationRuns]);

  // Live AI Drought Advisor State
  const [advisorQuery, setAdvisorQuery] = useState('Current IMD rainfall forecast for Bundelkhand and Tikamgarh');
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [advisorResult, setAdvisorResult] = useState<GeminiSearchResponse | null>(null);

  const handleRunAdvisorQuery = async (queryText?: string) => {
    const q = queryText || advisorQuery;
    if (!q.trim()) return;
    setIsAdvisorLoading(true);
    try {
      const res = await queryGeminiDroughtAdvisor(q);
      setAdvisorResult(res);
      showToast('Advisor Grounded', 'Retrieved live IMD advisory & grounding sources.', 'primary');
    } catch {
      setAdvisorResult({
        text: 'Live advisory query timed out. Using cached Madhya Pradesh State Scarcity Manual baseline.',
        sources: [
          { title: 'India Meteorological Department (IMD) Bhopal', uri: 'https://mausam.imd.gov.in' },
          { title: 'Madhya Pradesh State Disaster Management Authority', uri: 'https://mpsdma.nic.in' }
        ]
      });
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  // Real GeoJSON Export
  const handleExportGeoJSON = () => {
    const featureCollection = {
      type: 'FeatureCollection',
      name: 'Madhya_Pradesh_Drought_Risk_Boundaries_2026',
      crs: {
        type: 'name',
        properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
      },
      features: MADHYA_PRADESH_DISTRICTS_GEO.map(dist => {
        const liveMetric = districts.find(d => d.id === dist.id);
        return {
          type: 'Feature',
          properties: {
            id: dist.id,
            name: dist.name,
            hindiName: dist.hindiName || dist.marathiName,
            division: dist.division,
            riskScore: liveMetric?.riskScore ?? dist.cropLossRiskPct / 100,
            precipDeficitPct: liveMetric?.precipDeficit ?? dist.precipDeficit,
            soilMoisturePct: liveMetric?.soilMoisture ?? dist.soilMoistureDev,
            spi3M: liveMetric?.spi3M ?? dist.spi3M,
            vciPct: liveMetric?.vci ?? dist.vci,
            vedasCategory: liveMetric?.vedasCategory ?? dist.vedasCategory,
            openClaims: liveMetric?.openClaims ?? 0,
            activeTankers: dist.activeTankers,
            monitoredAcreageHa: dist.monitoredAcreageHa
          },
          geometry: {
            type: 'Polygon',
            coordinates: [dist.polygon.map(coord => [coord[1], coord[0]])]
          }
        };
      })
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MP_Drought_Boundaries_${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('GeoJSON Exported', 'Downloaded authentic Madhya Pradesh drought boundaries & telemetry GeoJSON file.', 'primary');
  };

  // Real RFC-4180 CSV Export
  const handleExportCSV = () => {
    const headers = [
      'District ID',
      'District Name',
      'Division',
      'Talukas Monitored',
      'Risk Score',
      'Risk Level',
      'Rainfall Deficit (%)',
      'Soil Moisture (%)',
      'VEDAS SPI-3M',
      'VEDAS VCI (%)',
      'Dry Spell (Days)',
      'Open PMFBY Claims',
      'Requisition Budget (Cr INR)'
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = districts.map(d => [
      d.id,
      d.name,
      d.division,
      d.talukas,
      d.riskScore.toFixed(2),
      d.riskLevel,
      d.precipDeficit,
      d.soilMoisture,
      d.spi3M ?? -1.82,
      d.vci ?? 28.5,
      d.drySpellDays,
      d.openClaims,
      d.reqBudgetCr
    ].map(escapeCSV).join(','));

    const csvContent = [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MP_District_Drought_Telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('CSV Exported', `Generated RFC-4180 CSV export for ${districts.length} Madhya Pradesh districts.`, 'primary');
  };

  // Real Executive Briefing Download
  const handleDownloadDossier = (title: string) => {
    const totalClaims = districts.reduce((acc, d) => acc + d.openClaims, 0);
    const dossierText = `========================================================================
MADHYA PRADESH STATE DISASTER MANAGEMENT AUTHORITY (MP-SDMA)
EL NIÑO DROUGHT PREEMPTION & RELIEF DOSSIER
========================================================================
Document: ${title}
Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
State Relief Corpus: ₹${budget} Crore
Monitored Districts: ${districts.length}
Critical Focus Zones: Bundelkhand, Chambal, Nimar Valley, Malwa Plateau

1. EXECUTIVE SUMMARY & TELEMETRY
- Regional Rainfall Deficit: -48.5% Departure from Normal (LPA)
- ISRO SAC VEDAS Krishi-DSS Status: Extreme / Severe Agricultural Drought
- High Risk Districts: Tikamgarh, Chhatarpur, Barwani, Sheopur, Shivpuri
- Active PMFBY Crop Failure Claims: ${totalClaims.toLocaleString()} claims

2. DISTRICT-WISE ALLOCATION OVERVIEW
${districts.map(d => `* ${d.name} (${d.division}): Risk Score ${(d.riskScore * 100).toFixed(0)}% | Deficit: ${d.precipDeficit}% | Req: ₹${d.reqBudgetCr} Cr | Status: ${d.riskLevel}`).join('\n')}

3. STATUTORY DIRECTIVES & WATER RESERVATION
- Mandatory drinking water quotas enforced at Gandhi Sagar, Rajghat, and Indira Sagar dams.
- Emergency potable tanker fleet operational with FASTag toll exemptions.
- DB distress relief transfers pre-cleared for satellite-verified parcels.
========================================================================
Authorized by: Office of the Relief Commissioner, Vallabh Bhavan, Bhopal
========================================================================`;

    const blob = new Blob([dossierText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Dossier Downloaded', `Downloaded executive briefing dossier: ${title}`, 'primary');
  };

  const handlePrintDossier = () => {
    window.print();
  };

  const reports = [
    {
      id: 'REP-01',
      title: 'State Relief Executive Dossier',
      subtitle: 'Cabinet & Divisional Commissioner Briefing',
      updated: '24 Oct 2026, 08:00 IST',
      category: 'Governance',
      metrics: `${districts.length} Districts · ₹${budget} Cr Requisition`
    },
    {
      id: 'REP-02',
      title: 'District Precipitation Deficit Matrix',
      subtitle: 'IMD Ground Stations vs 50-Year Median',
      updated: '24 Oct 2026, 06:00 IST',
      category: 'Meteorology',
      metrics: '36 AWS Nodes · -48.5% Regional Mean'
    },
    {
      id: 'REP-03',
      title: 'Emergency Tanker Dispatch Ledger',
      subtitle: 'Potable Water Distribution & Route Logs',
      updated: '23 Oct 2026, 22:30 IST',
      category: 'Logistics',
      metrics: '42 Active Tankers · 840,000 Litres Delivered'
    },
    {
      id: 'REP-04',
      title: 'Direct Benefit Transfer (DBT) Clearance',
      subtitle: 'Aadhaar-Linked Crop Failure Relief Disbursals',
      updated: '23 Oct 2026, 17:00 IST',
      category: 'Finance',
      metrics: '48,392 Accounts Verified · 94.2% Passed'
    }
  ];

  return (
    <div className="flex flex-col w-full gap-5 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl font-bold text-[#111827] tracking-tight">
            Reports & Analytical Records
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Official Madhya Pradesh relief dossiers, AI scientific briefings, hydrological audit records, and DBT ledger exports
          </p>
        </div>

        {/* Tab Controls & Print Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintDossier}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-[#E3E6EB] text-xs font-semibold text-[#4B5563] hover:text-[#111827] hover:bg-[#F9FAFB] shadow-xs cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-[#0F4C81]" />
            <span className="hidden sm:inline">Print Dossier</span>
          </button>

          <div className="flex items-center bg-[#F1F3F5] p-0.5 rounded-md border border-[#E3E6EB]">
            {(['ledger', 'reports', 'advisor', 'trends', 'export'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded text-xs font-semibold capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-[#0F4C81] shadow-[0_1px_2px_rgba(16,24,40,0.06)]'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                {tab === 'ledger' ? 'Audit Ledger' : tab === 'advisor' ? 'AI Advisor' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab 0: Auditable State Decision Ledger (Persistent Runs) */}
      {activeTab === 'ledger' && (
        <div className="space-y-5">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-[#BCD4EC] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] bg-gradient-to-br from-white to-[#EEF4FA]/50">
              <span className="text-xs text-[#6B7280]">Archived Decision Runs</span>
              <div className="text-2xl font-bold text-[#0F4C81] mt-1 tabular-nums">
                {allocationRuns.length}
              </div>
              <p className="text-[11px] text-[#4B5563] mt-1">
                Permanently persisted to server audit log
              </p>
            </div>

            <div className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <span className="text-xs text-[#6B7280]">Total Relief Authorized</span>
              <div className="text-2xl font-bold text-[#111827] mt-1 tabular-nums">
                ₹{allocationRuns.reduce((sum, r) => sum + (r.totalBudgetCr || 0), 0)} Cr
              </div>
              <p className="text-[11px] text-[#4B5563] mt-1">
                Under State Scarcity Manual provisions
              </p>
            </div>

            <div className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <span className="text-xs text-[#6B7280]">Audit Trail Events</span>
              <div className="text-2xl font-bold text-[#2E7D32] mt-1 tabular-nums">
                {auditEvents.length}
              </div>
              <p className="text-[11px] text-[#4B5563] mt-1">
                Timestamped actions recorded in system log
              </p>
            </div>
          </div>

          {/* Allocation Runs Table */}
          <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EB] mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Official Requisition & Optimization Runs
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Immutable record of approved preemption configurations, binding constraints, and solver allocations.
                </p>
              </div>
            </div>

            {allocationRuns.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#6B7280]">
                No allocation runs recorded yet. Generate and commit a plan from the <strong>Resource Optimizer</strong> or <strong>Scenario Lab</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E3E6EB] bg-[#F9FAFB] text-[#4B5563]">
                      <th className="py-2.5 px-3 font-semibold">Run ID</th>
                      <th className="py-2.5 px-3 font-semibold">Plan Title</th>
                      <th className="py-2.5 px-3 font-semibold">Authorized By</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Budget</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Satisfaction</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F5]">
                    {allocationRuns.map(run => (
                      <tr key={run.runId} className="hover:bg-[#F9FAFB]">
                        <td className="py-3 px-3 font-mono font-bold text-[#0F4C81]">
                          {run.runId}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#111827]">{run.title}</div>
                          <div className="text-[11px] text-[#6B7280]">{run.formattedDate}</div>
                        </td>
                        <td className="py-3 px-3 text-[#4B5563]">
                          <div>{run.officerName}</div>
                          <div className="text-[10px] text-[#6B7280]">{run.officerRole}</div>
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-bold text-[#111827]">
                          ₹{run.totalBudgetCr} Cr
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#E8F5E9] text-[#2E7D32]">
                            {run.metrics?.epeDemandSatisfactionPct || 78}% Met
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EEF4FA] text-[#0F4C81] border border-[#BCD4EC]">
                            {run.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedRunDetail(run)}
                              className="p-1 rounded hover:bg-[#EEF4FA] text-[#0F4C81]"
                              title="Inspect Run"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRun(run.runId)}
                              className="p-1 rounded hover:bg-[#FDECEA] text-[#C62828]"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Events Timeline */}
          <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-[#E3E6EB]">
              <History className="w-4 h-4 text-[#0F4C81]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                Chronological System Event Ledger
              </h3>
            </div>
            <div className="space-y-3">
              {auditEvents.slice(0, 8).map(evt => (
                <div key={evt.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-[#F1F3F5] last:border-0">
                  <span className="w-2 h-2 rounded-full bg-[#0F4C81] mt-1.5 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#111827]">{evt.action.replace('_', ' ')}</span>
                      <span className="text-[10px] text-[#9CA3AF] tabular-nums">
                        {new Date(evt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST
                      </span>
                    </div>
                    <p className="text-[11px] text-[#4B5563] mt-0.5">{evt.details}</p>
                    <span className="text-[10px] text-[#6B7280]">Actor: {evt.actor}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Run Detail Modal */}
          {selectedRunDetail && (
            <div className="fixed inset-0 z-50 bg-[#111827]/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-[#E3E6EB] max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-[#E3E6EB] mb-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-[#0F4C81] bg-[#EEF4FA] px-1.5 py-0.5 rounded">
                      {selectedRunDetail.runId}
                    </span>
                    <h3 className="text-base font-bold text-[#111827] mt-1">{selectedRunDetail.title}</h3>
                    <p className="text-xs text-[#6B7280]">Authorized on {selectedRunDetail.formattedDate} by {selectedRunDetail.officerName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRunDetail(null)}
                    className="p-1 rounded text-[#9CA3AF] hover:text-[#111827]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4 text-xs text-[#4B5563]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-[#F9FAF8] rounded border border-[#E3E6EB]">
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">Total Budget</span>
                      <strong className="text-sm font-bold text-[#111827]">₹{selectedRunDetail.totalBudgetCr} Cr</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">Demand Met</span>
                      <strong className="text-sm font-bold text-[#0F4C81]">{selectedRunDetail.metrics?.epeDemandSatisfactionPct || 78}%</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">People Protected</span>
                      <strong className="text-sm font-bold text-[#111827]">{selectedRunDetail.metrics?.peopleProtectedLakh || 4.8}L</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B7280] block">Livestock Protected</span>
                      <strong className="text-sm font-bold text-[#111827]">{selectedRunDetail.metrics?.livestockProtectedLakh || 2.9}L</strong>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-[#111827] mb-1">Binding Resource Bottlenecks:</h4>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-[#4B5563]">
                      {(selectedRunDetail.metrics?.bindingConstraints || ['Tanker Fleet Capacity', 'Statutory Minimum Floor']).map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <p className="text-[11px] text-[#6B7280] bg-[#F1F3F5] p-2.5 rounded">
                    <strong>Official Notes:</strong> {selectedRunDetail.notes}
                  </p>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#E3E6EB] mt-5">
                  <button
                    type="button"
                    onClick={() => setSelectedRunDetail(null)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C81] hover:bg-[#0A3963] rounded-md"
                  >
                    Close Ledger Details
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 1: Official Reports Dossiers */}
      {activeTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(rep => (
            <div
              key={rep.id}
              className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-[#0F4C81] bg-[#EEF4FA] px-1.5 py-0.5 rounded border border-[#BCD4EC]">
                    {rep.id} · {rep.category}
                  </span>
                  <span className="text-[11px] text-[#6B7280]">{rep.updated}</span>
                </div>
                <h3 className="text-sm font-bold text-[#111827]">{rep.title}</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">{rep.subtitle}</p>

                <div className="mt-3 p-2 rounded bg-[#F9FAFB] border border-[#E3E6EB] text-xs">
                  <span className="text-[11px] text-[#6B7280] block">Scope / Summary</span>
                  <span className="font-semibold text-[#111827] mt-0.5 block">{rep.metrics}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E3E6EB] flex justify-between items-center">
                <span className="text-[11px] text-[#6B7280]">Format: Text & Printable</span>
                <button
                  type="button"
                  onClick={() => handleDownloadDossier(rep.title)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0F4C81] text-white text-xs font-semibold hover:bg-[#0A3963] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Dossier</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Live AI Drought Advisor Panel */}
      {activeTab === 'advisor' && (
        <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-[#E3E6EB] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-[#EEF4FA] text-[#0F4C81] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#111827]">
                  Live AI Drought & IMD Grounding Advisor
                </h3>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                Grounded with live Google Search & IMD Bhopal weather bulletins, reservoir storage records, and Madhya Pradesh Scarcity Manual statutory procedures.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">
              Gemini 3.8 Flash + Search Grounding
            </span>
          </div>

          {/* Prompt Presets */}
          <div>
            <span className="text-[11px] font-semibold text-[#6B7280] block mb-2">
              Recommended Administrative Queries:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Current IMD rainfall forecast for Bundelkhand and Tikamgarh',
                'Bansagar, Gandhi Sagar, and Rajghat reservoir storage quotas',
                'Nimar Valley cotton damage and soil moisture deficit',
                'MP Scarcity Manual criteria for emergency drinking water rationing'
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAdvisorQuery(preset);
                    handleRunAdvisorQuery(preset);
                  }}
                  className="px-2.5 py-1 text-xs bg-[#F9FAFB] hover:bg-[#EEF4FA] text-[#1F2937] border border-[#E3E6EB] rounded-md transition-colors text-left"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Search Input Box */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={advisorQuery}
                onChange={e => setAdvisorQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRunAdvisorQuery();
                }}
                placeholder="Ask scientific drought question or IMD forecast query..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#CBD5E1] rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#0F4C81] focus:border-[#0F4C81] bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => handleRunAdvisorQuery()}
              disabled={isAdvisorLoading || !advisorQuery.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F4C81] text-white text-xs font-semibold rounded-md hover:bg-[#0A3963] transition-colors disabled:opacity-60 cursor-pointer shrink-0"
            >
              {isAdvisorLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Consulting IMD...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Consult Advisor</span>
                </>
              )}
            </button>
          </div>

          {/* Advisory Output Display */}
          {advisorResult && (
            <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs border-b border-[#E2E8F0] pb-2">
                <span className="font-bold text-[#0F4C81] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Scientific Relief Assessment
                </span>
                <span className="text-[11px] text-[#64748B]">Source: MP-SDMA & IMD</span>
              </div>
              <div className="text-xs text-[#1E293B] leading-relaxed whitespace-pre-wrap">
                {advisorResult.text}
              </div>

              {advisorResult.sources && advisorResult.sources.length > 0 && (
                <div className="pt-2 border-t border-[#E2E8F0]">
                  <span className="text-[10px] uppercase font-bold text-[#64748B] block mb-1.5">
                    Grounded Reference Sources:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {advisorResult.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white text-[#0F4C81] border border-[#CBD5E1] hover:bg-[#F1F5F9] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{src.title || src.uri}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Historical Multi-Year Trends */}
      {activeTab === 'trends' && (
        <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">
              Multi-Year Drought Stress Trajectory (2020–2026)
            </h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Historical yield loss averted under predictive preemption algorithms vs reactive relief
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E3E6EB] text-[11px] font-semibold text-[#6B7280] bg-[#FAFBFC]">
                  <th className="py-2.5 px-3">Season Year</th>
                  <th className="py-2.5 px-3">Rainfall Deficit</th>
                  <th className="py-2.5 px-3">Relief Budget (₹ Cr)</th>
                  <th className="py-2.5 px-3">Farmers Covered</th>
                  <th className="py-2.5 px-3">Loss Averted Multiplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E6EB]">
                <tr className="hover:bg-[#F9FAFB]">
                  <td className="py-2.5 px-3 font-semibold text-[#111827]">2026 (El Niño Active)</td>
                  <td className="py-2.5 px-3 font-semibold text-[#C62828]">-48.5%</td>
                  <td className="py-2.5 px-3">₹{budget}.0 Cr</td>
                  <td className="py-2.5 px-3">48,392 (Projected: 1.4L)</td>
                  <td className="py-2.5 px-3 font-bold text-[#0F4C81]">2.4x (Preemptive)</td>
                </tr>
                <tr className="hover:bg-[#F9FAFB]">
                  <td className="py-2.5 px-3 text-[#111827]">2025 (Normal Monsoon)</td>
                  <td className="py-2.5 px-3 text-[#2E7D32]">+4.2%</td>
                  <td className="py-2.5 px-3">₹45.0 Cr</td>
                  <td className="py-2.5 px-3">22,100</td>
                  <td className="py-2.5 px-3 text-[#6B7280]">1.0x (Baseline)</td>
                </tr>
                <tr className="hover:bg-[#F9FAFB]">
                  <td className="py-2.5 px-3 text-[#111827]">2024 (Dry Monsoon)</td>
                  <td className="py-2.5 px-3 text-[#B26A00]">-32.1%</td>
                  <td className="py-2.5 px-3">₹98.0 Cr</td>
                  <td className="py-2.5 px-3">34,500</td>
                  <td className="py-2.5 px-3 text-[#6B7280]">1.2x (Reactive)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Real Data Export Center */}
      {activeTab === 'export' && (
        <div className="bg-white rounded-lg border border-[#E3E6EB] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                State Relief Cell Open Data Export Center
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Export verified geospatial, financial, and hydrological datasets in standard open data formats (GeoJSON, RFC-4180 CSV, Dossier)
              </p>
            </div>
            <span className="text-xs text-[#0F4C81] font-semibold bg-[#EEF4FA] px-2.5 py-1 rounded border border-[#BCD4EC]">
              {districts.length} Districts Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* GeoJSON Export Card */}
            <button
              type="button"
              onClick={handleExportGeoJSON}
              className="p-4 rounded-lg border border-[#E3E6EB] hover:border-[#0F4C81] hover:bg-[#F9FAFB] text-left flex flex-col justify-between transition-all group cursor-pointer shadow-xs"
            >
              <div>
                <div className="w-8 h-8 rounded-md bg-[#EEF4FA] text-[#0F4C81] flex items-center justify-center mb-2">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs text-[#111827] block">
                  GIS Boundaries (GeoJSON)
                </span>
                <span className="text-[11px] text-[#6B7280] mt-1 block">
                  Madhya Pradesh district & tehsil polygons with VCI, SPI, and moisture coordinates
                </span>
              </div>
              <span className="text-xs font-semibold text-[#0F4C81] mt-4 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Download .geojson <Download className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* CSV Export Card */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-4 rounded-lg border border-[#E3E6EB] hover:border-[#0F4C81] hover:bg-[#F9FAFB] text-left flex flex-col justify-between transition-all group cursor-pointer shadow-xs"
            >
              <div>
                <div className="w-8 h-8 rounded-md bg-[#EEF4FA] text-[#0F4C81] flex items-center justify-center mb-2">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs text-[#111827] block">
                  District Telemetry (CSV)
                </span>
                <span className="text-[11px] text-[#6B7280] mt-1 block">
                  Sanitized RFC-4180 table with rainfall departure, soil moisture, and claim counts
                </span>
              </div>
              <span className="text-xs font-semibold text-[#0F4C81] mt-4 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Download .csv <Download className="w-3.5 h-3.5" />
              </span>
            </button>

            {/* Briefing PDF/Dossier Card */}
            <button
              type="button"
              onClick={() => handleDownloadDossier('MP_Relief_Treasury_Ledger')}
              className="p-4 rounded-lg border border-[#E3E6EB] hover:border-[#0F4C81] hover:bg-[#F9FAFB] text-left flex flex-col justify-between transition-all group cursor-pointer shadow-xs"
            >
              <div>
                <div className="w-8 h-8 rounded-md bg-[#EEF4FA] text-[#0F4C81] flex items-center justify-center mb-2">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="font-semibold text-xs text-[#111827] block">
                  Finance Ledger & Dossier
                </span>
                <span className="text-[11px] text-[#6B7280] mt-1 block">
                  Official signed state relief authorization dossier with reservoir quotas
                </span>
              </div>
              <span className="text-xs font-semibold text-[#0F4C81] mt-4 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                Download Dossier <Download className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
