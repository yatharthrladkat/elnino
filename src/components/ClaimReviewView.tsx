import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { FarmerClaim } from '../types/index.ts';
import { ClipboardCheck, Search, Filter, CheckCircle2, AlertCircle, X, ExternalLink, ShieldCheck, Dna } from 'lucide-react';
import { CropGenomicsExplorer } from './CropGenomicsExplorer';

export const ClaimReviewView: React.FC = () => {
  const { claims, authorizeBatchClaims, updateClaimStatus, showToast } = useApp();

  const [districtFilter, setDistrictFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [inspectingClaim, setInspectingClaim] = useState<FarmerClaim | null>(null);
  const [showGenomicsExplorer, setShowGenomicsExplorer] = useState(false);

  const filteredClaims = claims.filter(c => {
    if (districtFilter !== 'all' && c.district.toLowerCase() !== districtFilter.toLowerCase()) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (
      searchId &&
      !c.id.toLowerCase().includes(searchId.toLowerCase()) &&
      !c.farmerName.toLowerCase().includes(searchId.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleBatchApproveFiltered = () => {
    const eligibleClaims = filteredClaims.filter(c => {
      if (c.status === 'Duplicate') return false;
      const variance = Math.abs(c.claimedLoss - c.spectralLossIndex);
      return variance <= 15;
    });

    if (eligibleClaims.length === 0) {
      showToast(
        'No Eligible Claims',
        'No filtered claims match the verification tolerance (|claimed - spectral| ≤ 15%). Discrepant claims require manual field audit.',
        'warning'
      );
      return;
    }

    const eligibleIds = eligibleClaims.map(c => c.id);
    authorizeBatchClaims(eligibleIds);
    showToast(
      'Batch Clearance Authorized',
      `${eligibleClaims.length} verified claims (|claimed - spectral| ≤ 15%) authorized for DBT. Discrepant/duplicate claims retained for ground review.`,
      'primary'
    );
  };

  const handleApprove = (claim: FarmerClaim) => {
    updateClaimStatus(claim.id, 'Genuine');
    showToast('Claim Approved', `${claim.farmerName} (${claim.id}) marked genuine for DBT disbursement.`, 'primary');
    setInspectingClaim(null);
  };

  const handleMarkReview = (claim: FarmerClaim) => {
    updateClaimStatus(claim.id, 'Needs Review');
    showToast('Sent to Field Inspector', `${claim.id} flagged for Taluka Agricultural Officer ground inspection.`, 'warning');
    setInspectingClaim(null);
  };

  const handleMarkDuplicate = (claim: FarmerClaim) => {
    updateClaimStatus(claim.id, 'Duplicate');
    showToast('Flagged as Duplicate', `${claim.id} marked as overlapping parcel record.`, 'error');
    setInspectingClaim(null);
  };

  return (
    <div className="flex flex-col w-full gap-5 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-xl font-bold text-[#111827] tracking-tight">
            Crop Distress Claims Verification
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Automated Sentinel-2 multispectral NDVI verification against self-reported farmer distress dossiers
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setShowGenomicsExplorer(!showGenomicsExplorer)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#BCD4EC] bg-[#EEF4FA] text-[#0F4C81] text-xs font-semibold hover:bg-[#DCE8F5] transition-colors"
          >
            <Dna className="w-3.5 h-3.5" />
            <span>{showGenomicsExplorer ? 'Hide Crop Genomics' : 'Crop Genomics Explorer'}</span>
          </button>

          <button
            type="button"
            onClick={handleBatchApproveFiltered}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0F4C81] text-white text-xs font-semibold hover:bg-[#0A3963] shadow-[0_1px_2px_rgba(16,24,40,0.08)] transition-colors cursor-pointer"
            title="Authorize filtered claims with spectral variance ≤ 15%"
          >
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Authorize verified claims (≤15% diff)</span>
          </button>
        </div>
      </div>

      {/* Crop Genomics & Agronomic Science Explorer for Crop Distress Verification */}
      {showGenomicsExplorer && (
        <CropGenomicsExplorer />
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 stroke-[1.5]" />
              <input
                type="text"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                placeholder="Search claim ID or farmer name..."
                className="bg-[#F6F7F9] text-xs text-[#111827] pl-9 pr-3 py-1.5 rounded-md border border-[#E3E6EB] focus:bg-white focus:border-[#0F4C81] focus:ring-1 focus:ring-[#0F4C81] w-64"
              />
            </div>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={e => setDistrictFilter(e.target.value)}
              className="bg-[#F6F7F9] text-xs text-[#111827] px-3 py-1.5 rounded-md border border-[#E3E6EB] focus:bg-white focus:border-[#0F4C81]"
            >
              <option value="all">All Districts</option>
              <option value="Tikamgarh">Tikamgarh</option>
              <option value="Chhatarpur">Chhatarpur</option>
              <option value="Barwani">Barwani</option>
              <option value="Sheopur">Sheopur</option>
              <option value="Khargone">Khargone</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#F6F7F9] text-xs text-[#111827] px-3 py-1.5 rounded-md border border-[#E3E6EB] focus:bg-white focus:border-[#0F4C81]"
            >
              <option value="all">All Statuses</option>
              <option value="Genuine">Genuine</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Duplicate">Duplicate</option>
            </select>
          </div>

          <div className="text-xs text-[#6B7280]">
            Showing <strong className="text-[#111827]">{filteredClaims.length}</strong> of {claims.length} claims
          </div>
        </div>
      </div>

      {/* Claims Table */}
      <div className="bg-white rounded-lg border border-[#E3E6EB] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-[#E3E6EB] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider bg-[#FAFBFC]">
                <th className="py-2.5 px-3">Claim ID</th>
                <th className="py-2.5 px-3">Farmer & Taluka</th>
                <th className="py-2.5 px-3">Crop & Area</th>
                <th className="py-2.5 px-3">Reported Loss</th>
                <th className="py-2.5 px-3">Satellite NDVI Index</th>
                <th className="py-2.5 px-3">Verification Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E6EB]">
              {filteredClaims.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[#6B7280]">
                    No claims match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredClaims.map(c => {
                  const variance = Math.abs(c.claimedLoss - c.spectralLossIndex);
                  const isHighVariance = variance > 25;

                  return (
                    <tr key={c.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-medium text-xs text-[#0F4C81]">
                        {c.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-[#111827] block">{c.farmerName}</span>
                        <span className="text-[11px] text-[#6B7280]">{c.taluka}, {c.district}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-[#4B5563]">
                        {c.cropType} · {c.plotSizeHectares} Ha
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#C62828] tabular-nums">
                        {c.claimedLoss}%
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-[#111827] tabular-nums">
                            {c.spectralLossIndex}%
                          </span>
                          {isHighVariance && (
                            <span className="text-[10px] text-[#C62828] bg-[#FDECEA] px-1 rounded font-medium">
                              Δ {variance}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              c.status === 'Genuine'
                                ? 'bg-[#2E7D32]'
                                : c.status === 'Needs Review'
                                ? 'bg-[#B26A00]'
                                : 'bg-[#C62828]'
                            }`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              c.status === 'Genuine'
                                ? 'text-[#2E7D32]'
                                : c.status === 'Needs Review'
                                ? 'text-[#B26A00]'
                                : 'text-[#C62828]'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingClaim(c)}
                          className="text-xs font-semibold text-[#0F4C81] hover:underline"
                        >
                          Inspect dossier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspection Modal */}
      {inspectingClaim && (
        <div className="fixed inset-0 z-50 bg-[#111827]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-[#E3E6EB] shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start pb-3 border-b border-[#E3E6EB]">
              <div>
                <span className="text-[11px] font-mono text-[#0F4C81]">{inspectingClaim.id}</span>
                <h3 className="text-base font-bold text-[#111827]">
                  {inspectingClaim.farmerName}
                </h3>
                <p className="text-xs text-[#6B7280]">
                  {inspectingClaim.taluka}, {inspectingClaim.district} · {inspectingClaim.cropType} ({inspectingClaim.plotSizeHectares} Ha)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingClaim(null)}
                className="text-[#9CA3AF] hover:text-[#111827]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded bg-[#F9FAFB] border border-[#E3E6EB]">
                  <span className="text-[11px] text-[#6B7280]">Self-Reported Loss</span>
                  <span className="text-lg font-bold text-[#C62828] block mt-0.5 tabular-nums">
                    {inspectingClaim.claimedLoss}%
                  </span>
                </div>
                <div className="p-3 rounded bg-[#F9FAFB] border border-[#E3E6EB]">
                  <span className="text-[11px] text-[#6B7280]">Sentinel-2 Spectral Loss</span>
                  <span className="text-lg font-bold text-[#0F4C81] block mt-0.5 tabular-nums">
                    {inspectingClaim.spectralLossIndex}%
                  </span>
                </div>
              </div>

              <div className="p-3 rounded bg-[#F9FAFB] border border-[#E3E6EB] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Plot Confidence Score:</span>
                  <span className="font-semibold text-[#111827]">{inspectingClaim.confidence}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Submission Date:</span>
                  <span className="text-[#111827]">{inspectingClaim.submissionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7280]">Khasra / Land Revenue Record:</span>
                  <span className="font-semibold text-[#2E7D32]">Digitally Verified (MP Bhulekh / RCMS)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#E3E6EB]">
              <button
                type="button"
                onClick={() => handleMarkDuplicate(inspectingClaim)}
                className="px-3 py-1.5 rounded-md border border-[#F5C6CB] text-xs font-medium text-[#C62828] hover:bg-[#FDECEA]"
              >
                Flag Duplicate
              </button>
              <button
                type="button"
                onClick={() => handleMarkReview(inspectingClaim)}
                className="px-3 py-1.5 rounded-md border border-[#FFE082] text-xs font-medium text-[#B26A00] hover:bg-[#FFF8E1]"
              >
                Send to Field Review
              </button>
              <button
                type="button"
                onClick={() => handleApprove(inspectingClaim)}
                className="px-4 py-1.5 rounded-md bg-[#0F4C81] text-white text-xs font-semibold hover:bg-[#0A3963]"
              >
                Authorize DBT Grant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
