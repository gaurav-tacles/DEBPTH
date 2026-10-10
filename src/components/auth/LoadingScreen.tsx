import React from 'react';

export const LoadingScreen: React.FC<{ message?: string }> = ({
  message = 'Verifying security session and permissions...',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0F0B0A] text-[#F4F8FF] font-['Geist',sans-serif] select-none p-6">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(139,92,246,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="relative flex flex-col items-center max-w-sm text-center">
        {/* Animated Brand Emblem */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#8B5CF6] via-[#3B82F6] to-[#22D3EE] opacity-40 blur-xl animate-pulse" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-[#38302D] bg-[#191311] shadow-2xl">
            <span className="text-2xl font-black tracking-tighter bg-gradient-to-br from-[#F4F8FF] to-[#8B5CF6] bg-clip-text text-transparent">
              ▲
            </span>
          </div>
        </div>

        {/* Title and Product Identity */}
        <h1 className="text-xl font-bold tracking-tight text-[#F4F8FF]">
          Project Apex
        </h1>
        <p className="text-xs font-mono text-[#B4B0B0] mt-1 tracking-wider uppercase">
          Private Developer Workspace
        </p>

        {/* Loading Spinner & Status message */}
        <div className="mt-8 flex items-center gap-3 rounded-full border border-[#38302D] bg-[#191311] px-4 py-2 shadow-inner">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#8B5CF6] border-t-transparent" />
          <span className="text-xs text-[#B4B0B0]">{message}</span>
        </div>

        {/* Security badge footer */}
        <div className="mt-12 flex items-center gap-2 text-[11px] text-[#B4B0B0]/70 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
          <span>Zero-Trust RLS Security Governance</span>
        </div>
      </div>
    </div>
  );
};
