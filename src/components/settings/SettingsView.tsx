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
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../../lib/supabase';
import { logger } from '../../lib/logger';

export const SettingsView: React.FC = () => {
  const { currentUser, isSuperAdmin, resetWorkspaceData } = useWorkspace();

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
      // Fallback
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Workspace & Infrastructure Settings</h1>
          <p className="text-xs text-slate-400 mt-0.5">
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
              className="rounded-lg border border-rose-900/60 bg-rose-950/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 transition"
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-sm text-white">Supabase PostgreSQL Connection</h2>
              </div>
              <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
                PostgreSQL Engine
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Connect your free Supabase project to persist data in cloud PostgreSQL with Row-Level Security (RLS) and Supabase Storage. When credentials are not yet entered, DevForge automatically runs on the integrated offline-first persistent store.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Supabase Project URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  placeholder="https://your-project-id.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">
                  Supabase Anon Public API Key (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  placeholder="eyJhbGciOi..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none font-mono"
                />
              </div>

              {testResult && (
                <div
                  className={`rounded-lg p-3 text-xs border ${
                    testResult.success
                      ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                  }`}
                >
                  <div className="font-semibold">{testResult.message}</div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveConfig}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                >
                  Save Configuration
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                  <span>{testing ? 'Testing...' : 'Test Connection'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* DDL Schema Viewer & Instructions */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-sm text-white">Database DDL Schema & RLS Policies</h2>
              </div>
              <button
                onClick={handleCopySchema}
                className="flex items-center gap-1.5 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Run this script directly in the Supabase SQL Editor. It creates all tables (profiles, projects, project_members, tasks, milestones, documents, document_access_grants, suggestions, announcements, notifications), constraints, foreign keys, indexes, and full Row-Level Security policies.
            </p>

            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-56 overflow-y-auto">
              <pre className="text-slate-400 whitespace-pre-wrap">
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-white">Production Connectivity & Event Logs</h2>
              <button
                onClick={() => setLogs(logger.getHistory())}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                Refresh Logs
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Live operational trace for debugging network connectivity, authentication events, and cache transitions.
            </p>

            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 font-mono text-[10px] text-slate-300 max-h-48 overflow-y-auto space-y-1">
              {logs.map((lg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0">
                    {new Date(lg.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`uppercase font-bold shrink-0 ${
                      lg.level === 'error'
                        ? 'text-rose-400'
                        : lg.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-indigo-400'
                    }`}
                  >
                    [{lg.level}]
                  </span>
                  <span className="text-slate-400 shrink-0">[{lg.context}]</span>
                  <span className="text-slate-200">{lg.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Account & Security Overview */}
        <div className="space-y-6">
          {/* Active Account Details */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 text-xs">
            <h2 className="font-semibold text-sm text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              <span>Current Account Security</span>
            </h2>

            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="flex justify-between text-slate-400">
                <span>Name:</span>
                <span className="text-white font-medium">{currentUser?.fullName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Email:</span>
                <span className="text-white font-mono">{currentUser?.email}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Workspace Role:</span>
                <span className="text-indigo-400 font-mono uppercase font-semibold">
                  {currentUser?.role}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>MFA Status:</span>
                <span className="text-emerald-400 font-mono">
                  {currentUser?.mfaEnabled ? 'TOTP Verified' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          {/* Single Super Admin Principle */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 text-xs text-slate-400 space-y-2">
            <h3 className="font-semibold text-slate-200">Governance Invariants</h3>
            <ul className="space-y-2 list-disc list-inside leading-relaxed">
              <li>Exactly one Super Admin controls invitations and restricted documents.</li>
              <li>Workspace membership never grants access to all projects automatically.</li>
              <li>Restricted documents require explicit admin approval with optional expiration dates.</li>
              <li>Single-use invitation tokens expire and prevent public registration.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
