import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  ExternalLink,
  Code2,
  FolderGit2,
  Search,
  Check,
  Layers,
  Terminal,
  Globe,
  ImageOff,
  RefreshCw,
  Cpu,
} from 'lucide-react';
import { BUILT_BY_US_PROJECTS, ShowcaseProject } from '../../data/builtByUsData';

export const BuiltByUsView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (projectId: string) => {
    setImageErrors((prev) => ({ ...prev, [projectId]: true }));
  };

  const categories = useMemo(() => {
    const list = Array.from(new Set(BUILT_BY_US_PROJECTS.map((p) => p.category)));
    return ['all', ...list];
  }, []);

  const filteredProjects = useMemo(() => {
    return BUILT_BY_US_PROJECTS.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchSub = p.subtitle.toLowerCase().includes(q);
        const matchDesc = p.description.toLowerCase().includes(q);
        const matchTech = p.technologies.some((t) => t.toLowerCase().includes(q));
        const matchAuthor = p.author.toLowerCase().includes(q);
        if (!matchTitle && !matchSub && !matchDesc && !matchTech && !matchAuthor) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: BUILT_BY_US_PROJECTS.length,
      production: BUILT_BY_US_PROJECTS.filter((p) => p.status === 'Production').length,
      openSource: BUILT_BY_US_PROJECTS.filter((p) => p.status === 'Open Source').length,
      inDev: BUILT_BY_US_PROJECTS.filter((p) => p.status === 'In Development').length,
    };
  }, []);

  const getStatusBadge = (status: ShowcaseProject['status']) => {
    switch (status) {
      case 'Production':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
            Production
          </span>
        );
      case 'Open Source':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#8B5CF6]/15 text-[#8B5CF6] border border-[#8B5CF6]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
            Open Source
          </span>
        );
      case 'In Development':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            In Development
          </span>
        );
      case 'Active Studio':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            Active Studio
          </span>
        );
    }
  };

  const getCategoryIcon = (category: ShowcaseProject['category']) => {
    switch (category) {
      case 'Developer Platform':
        return <Layers className="w-4 h-4 text-[#8B5CF6]" />;
      case 'Developer Tools':
        return <Terminal className="w-4 h-4 text-[#34D399]" />;
      case 'Web Portal':
        return <Globe className="w-4 h-4 text-[#3B82F6]" />;
      case 'Web Application':
        return <Code2 className="w-4 h-4 text-[#F59E0B]" />;
      case 'Design & Studio':
        return <Cpu className="w-4 h-4 text-[#EC4899]" />;
      default:
        return <Layers className="w-4 h-4 text-[#8B5CF6]" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero / Introductory Section */}
      <section className="relative overflow-hidden rounded-2xl border border-[#38302D] bg-gradient-to-br from-[#191311] via-[#140F0E] to-[#0F0B0A] p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-xs font-mono text-[#8B5CF6]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>DevLead Labs · Engineering Showcase</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#F4F8FF]">
            Built by Us
          </h1>

          <p className="text-sm sm:text-base text-[#B4B0B0] leading-relaxed">
            A curated showcase of applications, developer platforms, and architectural experiments engineered by Gaurav Patel and DevLead Labs. Designed with performance, accessible interactions, and modern web standards.
          </p>

          {/* Quick Metrics */}
          <div className="pt-2 flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <span className="text-[#8B5CF6] font-bold text-sm">{stats.total}</span>
              <span className="text-[#B4B0B0]">Total Projects</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <span className="text-[#34D399] font-bold text-sm">{stats.production}</span>
              <span className="text-[#B4B0B0]">Live Products</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <span className="text-[#8B5CF6] font-bold text-sm">{stats.openSource}</span>
              <span className="text-[#B4B0B0]">Open Source</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <span className="text-[#F59E0B] font-bold text-sm">{stats.inDev}</span>
              <span className="text-[#B4B0B0]">In Active Dev</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#B4B0B0]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, technologies, or authors..."
            className="w-full rounded-xl border border-[#38302D] bg-[#191311] pl-9 pr-4 py-2 text-xs text-[#F4F8FF] placeholder:text-[#B4B0B0]/60 focus:border-[#8B5CF6] focus:outline-none transition shadow-xs"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#8B5CF6] text-white shadow-sm shadow-[#8B5CF6]/30'
                  : 'bg-[#191311] border border-[#38302D] text-[#B4B0B0] hover:text-[#F4F8FF] hover:border-[#8B5CF6]/50'
              }`}
            >
              {cat === 'all' ? 'All Works' : cat}
            </button>
          ))}
        </div>
      </section>

      {/* Projects Grid */}
      <section>
        {filteredProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#38302D] p-12 text-center space-y-3 bg-[#191311]/40">
            <Code2 className="w-8 h-8 text-[#B4B0B0]/40 mx-auto" />
            <h3 className="text-sm font-semibold text-[#F4F8FF]">No projects match your filter</h3>
            <p className="text-xs text-[#B4B0B0] max-w-sm mx-auto">
              Try refining your search keyword or selecting a different category.
            </p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-2 text-xs font-semibold text-[#8B5CF6] hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const hasImage = Boolean(project.imageUrl) && !imageErrors[project.id];

              return (
                <article
                  key={project.id}
                  className="group flex flex-col justify-between rounded-2xl border border-[#38302D] bg-[#191311] overflow-hidden transition-all duration-200 hover:border-[#8B5CF6]/50 hover:shadow-xl hover:shadow-[#8B5CF6]/5"
                >
                  {/* Project Image Banner or Stylized Missing-Image State */}
                  {hasImage ? (
                    <div className="relative h-40 w-full overflow-hidden bg-[#0F0B0A] border-b border-[#38302D]/60 flex items-center justify-center p-4">
                      <img
                        src={project.imageUrl}
                        alt={`${project.title} Preview`}
                        onError={() => handleImageError(project.id)}
                        className="max-h-full max-w-full object-contain filter drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        {getStatusBadge(project.status)}
                      </div>
                    </div>
                  ) : (
                    /* Missing-Image State: Clean architectural placeholder */
                    <div className="relative h-28 w-full bg-gradient-to-br from-[#1F1917] to-[#120E0D] border-b border-[#38302D]/60 p-3.5 flex flex-col justify-between overflow-hidden">
                      {/* Subtle geometric pattern backdrop */}
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#8B5CF6_1px,transparent_1px)] [background-size:12px_12px]" />

                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-[#0F0B0A]/80 border border-[#38302D]">
                            {getCategoryIcon(project.category)}
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#B4B0B0]">
                            {project.category}
                          </span>
                        </div>
                        {getStatusBadge(project.status)}
                      </div>

                      <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-[#B4B0B0]/60">
                        <span className="truncate">Initiative ID: #{project.id}</span>
                        <span className="flex items-center gap-1">
                          <ImageOff className="w-3 h-3 text-[#B4B0B0]/40" />
                          <span>No Preview Image</span>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Card Content Body */}
                  <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Category row for cards that have image */}
                      {hasImage && (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-[#B4B0B0]">
                            {project.category}
                          </span>
                        </div>
                      )}

                      {/* Title & Subtitle */}
                      <div>
                        <h2 className="text-lg font-bold text-[#F4F8FF] group-hover:text-white transition flex items-center justify-between gap-2">
                          <span>{project.title}</span>
                          {project.featured && (
                            <span title="Featured Engineering Work">
                              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                            </span>
                          )}
                        </h2>
                        <p className="text-xs font-medium text-[#8B5CF6] mt-0.5">
                          {project.subtitle}
                        </p>
                        <p className="text-[11px] font-mono text-[#B4B0B0]/70 mt-1">
                          By {project.author}
                        </p>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[#B4B0B0] leading-relaxed line-clamp-3">
                        {project.description}
                      </p>

                      {/* Highlights */}
                      {project.highlights.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          {project.highlights.slice(0, 3).map((highlight, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-[11px] text-[#B4B0B0]">
                              <Check className="w-3.5 h-3.5 text-[#34D399] shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{highlight}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Technologies tags */}
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {project.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="rounded-md border border-[#38302D]/70 bg-[#0F0B0A] px-2 py-0.5 text-[10px] font-mono text-[#F4F8FF]/80"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-4 mt-4 border-t border-[#38302D]/60 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        {project.verifiedSourceUrl && (
                          <a
                            href={project.verifiedSourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#38302D] bg-[#211B19] px-3 py-1.5 text-xs font-medium text-[#F4F8FF] hover:border-[#8B5CF6] hover:text-white transition cursor-pointer"
                            title={`View ${project.title} on GitHub`}
                          >
                            <FolderGit2 className="w-3.5 h-3.5 text-[#8B5CF6]" />
                            <span>Source Code</span>
                          </a>
                        )}

                        {project.verifiedLiveUrl && (
                          <a
                            href={project.verifiedLiveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#8B5CF6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#7C3AED] transition shadow-xs cursor-pointer"
                            title={`Open live app for ${project.title}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Live Demo</span>
                          </a>
                        )}
                      </div>

                      {!project.verifiedSourceUrl && !project.verifiedLiveUrl && (
                        <span className="text-[11px] font-mono text-[#B4B0B0]/60 italic">
                          Private Studio Work
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
