import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  AlertCircle,
  Users,
  Star,
  Eye,
  ExternalLink,
  RefreshCw,
  FolderKanban,
  Check,
  Shield,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { logger } from '../../lib/logger';

interface RepoSummary {
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  description: string;
}

interface CommitItem {
  sha: string;
  author: string;
  message: string;
  date: string;
}

interface ContributorItem {
  login: string;
  contributions: number;
  avatar_url: string;
}

export const GitHubView: React.FC = () => {
  const { projects, activeProjectId } = useWorkspace();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(activeProjectId || projects[0]?.id || '');

  const project = projects.find((p) => p.id === selectedProjectId);
  const repositories = project?.repositories || [];
  const [selectedRepo, setSelectedRepo] = useState<string>(repositories[0]?.name || 'facebook/react');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoSummary, setRepoSummary] = useState<RepoSummary | null>(null);
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [contributors, setContributors] = useState<ContributorItem[]>([]);
  const [dataSource, setDataSource] = useState<'live' | 'cached' | 'offline'>('live');

  // Sync selected repo when project changes
  useEffect(() => {
    if (repositories.length > 0) {
      setSelectedRepo(repositories[0].name);
    }
  }, [selectedProjectId]);

  // Fetch real GitHub repository metadata
  const fetchRepoData = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setError(null);

    const cacheKey = `gh_cache_${selectedRepo}`;
    try {
      logger.info('GitHubAPI', `Fetching live GitHub data for ${selectedRepo}`);
      // 1. Repo general info
      const repoRes = await fetch(`https://api.github.com/repos/${selectedRepo}`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });

      if (!repoRes.ok) {
        if (repoRes.status === 403) {
          throw new Error('GitHub API rate limit exceeded. Using cached repository data.');
        } else if (repoRes.status === 404) {
          throw new Error(`Repository "${selectedRepo}" not found or requires authentication.`);
        } else {
          throw new Error(`GitHub API returned status ${repoRes.status}`);
        }
      }

      const repoJson = await repoRes.json();
      const summary: RepoSummary = {
        stars: repoJson.stargazers_count,
        forks: repoJson.forks_count,
        openIssues: repoJson.open_issues_count,
        defaultBranch: repoJson.default_branch,
        description: repoJson.description || 'No description provided',
      };
      setRepoSummary(summary);

      // 2. Commits
      const commitsRes = await fetch(`https://api.github.com/repos/${selectedRepo}/commits?per_page=6`);
      if (commitsRes.ok) {
        const commitsJson = await commitsRes.json();
        const parsedCommits: CommitItem[] = commitsJson.map((c: any) => ({
          sha: c.sha.slice(0, 7),
          author: c.commit.author?.name || c.author?.login || 'Committer',
          message: c.commit.message.split('\n')[0],
          date: c.commit.author?.date || new Date().toISOString(),
        }));
        setCommits(parsedCommits);
      }

      // 3. Contributors
      const contribRes = await fetch(`https://api.github.com/repos/${selectedRepo}/contributors?per_page=6`);
      if (contribRes.ok) {
        const contribJson = await contribRes.json();
        const parsedContribs: ContributorItem[] = contribJson.map((ct: any) => ({
          login: ct.login,
          contributions: ct.contributions,
          avatar_url: ct.avatar_url,
        }));
        setContributors(parsedContribs);
      }

      setDataSource('live');
      // Save cache
      localStorage.setItem(cacheKey, JSON.stringify({ summary, timestamp: Date.now() }));
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.warn('GitHubAPI', 'Error fetching repo, checking local cache', errMsg);

      // Fallback to cache if available
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        setRepoSummary(parsed.summary);
        setDataSource('cached');
        setError(`${errMsg} Displaying cached metrics.`);
      } else {
        setError(errMsg);
        setDataSource('offline');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepoData();
  }, [selectedRepo]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Repository Activity</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Explicitly mapped repositories for authorized projects. Live telemetry and commit history.
          </p>
        </div>

        <button
          onClick={fetchRepoData}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Selectors Bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {repositories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Mapped Repository:</span>
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none font-mono"
            >
              {repositories.map((r, idx) => (
                <option key={idx} value={r.name}>
                  {r.name} [{r.branch}]
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`font-mono text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${
              dataSource === 'live'
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                : 'bg-amber-950/40 text-amber-400 border border-amber-900/40'
            }`}
          >
            {dataSource === 'live' ? 'Live API Connected' : 'Cached Snapshot'}
          </span>
        </div>
      </div>

      {/* Error or Rate limit notice */}
      {error && (
        <div className="rounded-lg bg-amber-950/30 border border-amber-800/60 p-3 text-xs text-amber-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Repo Stats Row */}
      {repoSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-amber-400" /> Stars
            </span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {repoSummary.stars.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-indigo-400" /> Forks
            </span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {repoSummary.forks.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-emerald-400" /> Open Issues / PRs
            </span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {repoSummary.openIssues.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-blue-400" /> Default Branch
            </span>
            <div className="text-sm font-semibold font-mono text-slate-200 mt-2">
              {repoSummary.defaultBranch}
            </div>
          </div>
        </div>
      )}

      {/* Commits & Contributors 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Commits */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-indigo-400" />
              <span>Recent Commit Log ({selectedRepo})</span>
            </h2>
            <a
              href={`https://github.com/${selectedRepo}/commits`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              All Commits <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-2">
            {commits.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center text-xs text-slate-500">
                {loading ? 'Fetching commits from GitHub...' : 'No commit information available.'}
              </div>
            ) : (
              commits.map((commit, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:border-slate-700 transition"
                >
                  <div className="space-y-1">
                    <div className="font-mono text-xs text-slate-200 font-medium line-clamp-1">
                      {commit.message}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{commit.author}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[10px]">
                        {new Date(commit.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-[11px] text-indigo-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0 self-start sm:self-center">
                    {commit.sha}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Contributors */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Top Contributors</span>
          </h2>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            {contributors.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">
                {loading ? 'Fetching contributors...' : 'No contributor data.'}
              </div>
            ) : (
              contributors.map((contrib, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs border-b border-slate-800/60 pb-2 last:border-b-0"
                >
                  <div className="flex items-center gap-2.5">
                    <img
                      src={contrib.avatar_url}
                      alt={contrib.login}
                      className="w-6 h-6 rounded-md object-cover"
                    />
                    <span className="font-mono text-slate-200">@{contrib.login}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {contrib.contributions} commits
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
