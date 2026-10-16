import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Shield,
  Key,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  AlertTriangle,
  ExternalLink,
  Laptop,
  LogOut,
  Lock,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../../lib/supabase';
import { logger } from '../../lib/logger';

export const SettingsView: React.FC = () => {
  const { currentUser, isSuperAdmin, resetWorkspaceData, signOut } = useWorkspace();

  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [logs, setLogs] = useState(logger.getHistory());

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.url);
    setSupabaseKey(config.anonKey);
  }, []);

  const handleSaveConfig = () => {
    saveSupabaseConfig(supabaseUrl.trim(), supabaseKey.trim());
    setTestResult({ success: true, message: 'Configuration saved to browser storage.' });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testSupabaseConnection(supabaseUrl.trim(), supabaseKey.trim());
    setTestResult(result);
    setTesting(false);
    setLogs(logger.getHistory());
  };

  const handleCopySchema = async () => {
    try {
      const res = await fetch('/src/db/schema.sql');
      const text = await res.text();
      navigator.clipboard.writeText(text);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#38302D]">
        <div>
          <h1 className="text-xl font-bold text-[#F4F8FF] tracking-tight">Workspace & Infrastructure Settings</h1>
          <p className="text-xs text-[#B4B0B0] mt-0.5">
            Database credentials, Row-Level Security verification, and developer authentication policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button
              onClick={() => {
                if (confirm('Reset workspace database to initial seed state?')) {
                  resetWorkspaceData();
                }
              }}
              className="rounded-xl border border-[#FB7185]/30 bg-[#FB7185]/10 px-3 py-1.5 text-xs font-semibold text-[#FB7185] hover:bg-[#FB7185]/20 transition cursor-pointer"
            >
              Reset Sample Data
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Supabase & Database configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Supabase Connection Manager */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#8B5CF6]" />
                <h2 className="font-semibold text-sm text-[#F4F8FF]">Supabase PostgreSQL Connection</h2>
              </div>
              <span className="font-mono text-[10px] text-[#34D399] bg-[#34D399]/10 px-2 py-0.5 rounded border border-[#34D399]/30">
                PostgreSQL Engine
              </span>
            </div>

            <p className="text-xs text-[#B4B0B0] leading-relaxed">
              Connect your free Supabase project to persist data in cloud PostgreSQL with Row-Level Security (RLS) and Supabase Storage. When credentials are not yet entered, DEBPTH by DevLead Labs runs in offline-first mode with instant responsive caching.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">
                  Supabase Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  placeholder="https://your-project-id.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/40 focus:border-[#8B5CF6] focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#B4B0B0]">
                  Supabase Anon Public API Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full rounded-xl border border-[#38302D] bg-[#0F0B0A] px-3 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/40 focus:border-[#8B5CF6] focus:outline-none font-mono"
                />
              </div>

              {testResult && (
                <div
                  className={`rounded-xl p-3 text-xs border ${
                    testResult.success
                      ? 'bg-[#34D399]/10 border-[#34D399]/30 text-[#34D399]'
                      : 'bg-[#FB7185]/10 border-[#FB7185]/30 text-[#FB7185]'
                  }`}
                >
                  <div className="font-semibold">{testResult.message}</div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveConfig}
                  className="rounded-xl bg-[#211B19] border border-[#38302D] px-4 py-2 text-xs font-semibold text-[#F4F8FF] hover:border-[#8B5CF6] transition cursor-pointer"
                >
                  Save Configuration
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-1.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] px-4 py-2 text-xs font-semibold text-white transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* DDL Schema Viewer & Instructions */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#3B82F6]" />
                <h2 className="font-semibold text-sm text-[#F4F8FF]">Database DDL Schema & RLS Policies</h2>
              </div>
              <button
                onClick={handleCopySchema}
                className="flex items-center gap-1.5 rounded-xl bg-[#211B19] border border-[#38302D] px-3 py-1.5 text-xs font-medium text-[#F4F8FF] hover:border-[#8B5CF6] transition cursor-pointer"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
              </button>
            </div>

            <p className="text-xs text-[#B4B0B0] leading-relaxed">
              Run this script directly in the Supabase SQL Editor. It provisions all tables (profiles, projects, project_members, tasks, milestones, documents, document_access_grants, suggestions, announcements, notifications), constraints, and full Row-Level Security policies.
            </p>

            <div className="rounded-xl bg-[#0F0B0A] p-3 border border-[#38302D] font-mono text-[11px] text-[#B4B0B0] max-h-56 overflow-y-auto">
              <pre className="text-[#B4B0B0] whitespace-pre-wrap">
{`-- Located in: /src/db/schema.sql
-- Run in Supabase SQL Editor:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- PROFILES, PROJECTS, INDEPENDENT MEMBERSHIPS, RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON public.projects 
  FOR SELECT USING (public.has_project_access(id));`}
              </pre>
            </div>
          </div>

          {/* Production Diagnostics & Connectivity Log Viewer */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-[#F4F8FF]">Production Diagnostics & Event Trace</h2>
              <button
                onClick={() => setLogs(logger.getHistory())}
                className="text-xs text-[#8B5CF6] hover:text-[#7C3AED] cursor-pointer"
              >
                Refresh Logs
              </button>
            </div>
            <p className="text-xs text-[#B4B0B0]">
              Operational log stream for debugging network latency, authentication events, and cache transitions.
            </p>

            <div className="rounded-xl bg-[#0F0B0A] p-3 border border-[#38302D] font-mono text-[10px] max-h-48 overflow-y-auto space-y-1">
              {logs.map((lg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#B4B0B0]/60 shrink-0">
                    {new Date(lg.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`uppercase font-bold shrink-0 ${
                      lg.level === 'error'
                        ? 'text-[#FB7185]'
                        : lg.level === 'warn'
                        ? 'text-[#FBBF24]'
                        : 'text-[#8B5CF6]'
                    }`}
                  >
                    [{lg.level}]
                  </span>
                  <span className="text-[#B4B0B0] shrink-0">[{lg.context}]</span>
                  <span className="text-[#F4F8FF]">{lg.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Account & Security Overview */}
        <div className="space-y-6">
          {/* Active Account Details */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 space-y-3 text-xs">
            <h2 className="font-semibold text-sm text-[#F4F8FF] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#8B5CF6]" />
              <span>Current Account Security</span>
            </h2>

            <div className="space-y-2 border-t border-[#38302D] pt-3">
              <div className="flex justify-between text-[#B4B0B0]">
                <span>Name:</span>
                <span className="text-[#F4F8FF] font-medium">{currentUser?.fullName}</span>
              </div>
              <div className="flex justify-between text-[#B4B0B0]">
                <span>Email:</span>
                <span className="text-[#F4F8FF] font-mono">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between text-[#B4B0B0]">
                <span>Workspace Role:</span>
                <span className="text-[#8B5CF6] font-mono uppercase font-semibold">
                  {currentUser?.role}
                </span>
              </div>
              <div className="flex justify-between text-[#B4B0B0]">
                <span>MFA Status:</span>
                <span className="text-[#34D399] font-mono">
                  {currentUser?.mfaEnabled ? 'TOTP Verified' : 'Disabled'}
                </span>
              </div>
            </div>

            {/* Sign Out Action */}
            <div className="pt-3 border-t border-[#38302D]">
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#FB7185]/30 bg-[#FB7185]/10 hover:bg-[#FB7185]/20 text-[#FB7185] py-2 px-3 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out of Session</span>
              </button>
            </div>
          </div>

          {/* Single Super Admin Principle */}
          <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-5 text-xs text-[#B4B0B0] space-y-2.5">
            <h3 className="font-semibold text-[#F4F8FF] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#22D3EE]" />
              <span>Governance Invariants</span>
            </h3>
            <ul className="space-y-2 list-disc list-inside leading-relaxed text-[11px]">
              <li>Exactly one Super Admin controls invitations and restricted documents.</li>
              <li>Workspace membership never grants access to all projects automatically.</li>
              <li>Restricted documents require explicit admin approval with expiration timestamps.</li>
              <li>Single-use invitation tokens prevent public unapproved registration.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
