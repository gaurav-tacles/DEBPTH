import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';

export const SecurityView: React.FC = () => {
  const { currentUser, isSuperAdmin, profiles, invitations } = useWorkspace();
  const [copiedKey, setCopiedKey] = useState(false);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F4F8FF]">Access & Security Governance</h1>
          <p className="text-xs text-[#B4B0B0] mt-1">
            Zero-trust private workspace authorization, Row-Level Security policies, and TOTP authentication status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase font-bold text-[#34D399] bg-[#34D399]/10 px-2.5 py-1 rounded-lg border border-[#34D399]/30 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>RLS Active & Enforced</span>
          </span>
        </div>
      </div>

      {/* 2. Governance Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Super Admin Authority */}
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[#B4B0B0]">Workspace Authority</span>
            <Shield className="w-4 h-4 text-[#8B5CF6]" />
          </div>
          <div className="text-base font-semibold text-[#F4F8FF]">Single Super Admin</div>
          <p className="text-xs text-[#B4B0B0] leading-relaxed">
            One designated account ({profiles.find((p) => p.role === 'super_admin')?.email}) governs invitations, project provisioning, and restricted document approvals.
          </p>
        </div>

        {/* Card 2: Closed Workspace Registration */}
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[#B4B0B0]">Registration Flow</span>
            <Lock className="w-4 h-4 text-[#22D3EE]" />
          </div>
          <div className="text-base font-semibold text-[#F4F8FF]">Token-Gated Invitations</div>
          <p className="text-xs text-[#B4B0B0] leading-relaxed">
            Public self-registration is permanently disabled. Access requires an unexpired, single-use token cryptographically linked to the invitee email.
          </p>
        </div>

        {/* Card 3: Project Isolation */}
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-[#B4B0B0]">Scoping Rule</span>
            <Terminal className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-base font-semibold text-[#F4F8FF]">Independent Memberships</div>
          <p className="text-xs text-[#B4B0B0] leading-relaxed">
            Workspace membership does not automatically grant access to projects. Non-members cannot view tasks, repositories, or documents.
          </p>
        </div>
      </div>

      {/* 3. Member MFA Status Table */}
      <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-[#8B5CF6]" />
            <h2 className="font-semibold text-sm text-[#F4F8FF]">Team Multi-Factor Authentication Roster</h2>
          </div>
          <span className="text-[11px] font-mono text-[#B4B0B0]">
            {profiles.filter((p) => p.mfaEnabled).length} of {profiles.length} Verified
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#38302D] bg-[#0F0B0A]">
          <table className="w-full text-left text-xs min-w-[560px]">
            <thead className="border-b border-[#38302D] bg-[#191311] text-[10px] font-mono uppercase text-[#B4B0B0]">
              <tr>
                <th className="p-3.5">Member</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">MFA Status</th>
                <th className="p-3.5">GitHub Identity</th>
                <th className="p-3.5 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#38302D] text-[#F4F8FF]">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-[#191311]/50 transition">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <img src={p.avatarUrl} alt="" className="w-7 h-7 rounded-lg object-cover ring-1 ring-[#38302D]" />
                      <div>
                        <div className="font-semibold text-xs text-[#F4F8FF]">{p.fullName}</div>
                        <div className="text-[11px] font-mono text-[#B4B0B0]">{p.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span className="font-mono text-[10px] uppercase font-bold text-[#8B5CF6]">
                      {p.role === 'super_admin' ? 'SUPER ADMIN' : 'MEMBER'}
                    </span>
                  </td>

                  <td className="p-3.5">
                    {p.mfaEnabled ? (
                      <span className="flex items-center gap-1.5 font-medium text-[#34D399]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>TOTP Verified</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 font-medium text-[#FB7185]">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Disabled</span>
                      </span>
                    )}
                  </td>

                  <td className="p-3.5 font-mono text-xs text-[#22D3EE]">
                    {p.githubUsername ? `@${p.githubUsername}` : '—'}
                  </td>

                  <td className="p-3.5 text-right font-mono text-[11px] text-[#B4B0B0]">
                    Hardware / App Authenticator
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
