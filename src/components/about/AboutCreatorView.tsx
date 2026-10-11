import React from 'react';
import {
  Sparkles,
  ExternalLink,
  Github,
  Mail,
  MapPin,
  Shield,
  Layers,
  Terminal,
  Heart,
  Code2,
  Cpu,
  ArrowUpRight,
} from 'lucide-react';
import { ProjectHubLogo } from '../common/ProjectHubLogo';

export const AboutCreatorView: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* 1. Hero / Purpose Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-[#38302D] bg-gradient-to-br from-[#191311] via-[#140F0E] to-[#0F0B0A] p-6 sm:p-8 lg:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-xs font-mono text-[#8B5CF6]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Built with Purpose · DevLead Labs</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#F4F8FF]">
            About the Creators
          </h1>

          <p className="text-sm sm:text-base text-[#B4B0B0] leading-relaxed">
            ProjectHub was designed and engineered by <strong className="text-white font-semibold">DevLead Labs</strong> under the technical direction of <strong className="text-white font-semibold">Patel Gaurav</strong>. It represents a focused commitment to building private, reliable developer workspaces where engineering teams retain sovereign control over their roadmaps, data, and credentials.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-[#B4B0B0]">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <Shield className="w-3.5 h-3.5 text-[#34D399]" />
              <span>Sovereign Security</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <Layers className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>PostgreSQL & RLS</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#38302D] bg-[#0F0B0A]/80">
              <Terminal className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Modern Web Stack</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Founder Profile Card (Patel Gaurav) */}
      <section className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          {/* Avatar / Portrait */}
          <div className="relative shrink-0 mx-auto md:mx-0">
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden ring-2 ring-[#8B5CF6]/40 shadow-xl bg-[#211B19] flex items-center justify-center">
              <img
                src="https://avatars.githubusercontent.com/u/108500206?v=4"
                alt="Patel Gaurav"
                onError={(e) => {
                  // Fallback to geometric glyph if GitHub avatar is unavailable
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-full h-full object-cover"
              />
              <div className="flex flex-col items-center justify-center text-center p-2 text-[#8B5CF6]">
                <ProjectHubLogo size="lg" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#34D399] ring-2 ring-[#191311]" title="Active Lead" />
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[#F4F8FF]">
                    Patel Gaurav
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-[#8B5CF6]">
                    Founder & Lead Architect · DevLead Labs
                  </p>
                </div>

                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#211B19] border border-[#38302D] text-[11px] font-mono text-[#B4B0B0] justify-center">
                  <MapPin className="w-3 h-3 text-[#FB7185]" />
                  <span>India</span>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#B4B0B0] leading-relaxed">
              Software engineer and product architect specializing in modern TypeScript ecosystems, database-enforced security models, and developer tooling. As lead of DevLead Labs, Patel Gaurav engineers scalable full-stack applications with an emphasis on high performance, clean interfaces, and verifiable privacy standards.
            </p>

            {/* Verified Links & Socials */}
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs">
              <a
                href="https://github.com/gaurav-tacles"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#38302D] bg-[#211B19] text-[#F4F8FF] hover:border-[#8B5CF6] hover:text-white transition cursor-pointer font-medium"
              >
                <Github className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>GitHub @gaurav-tacles</span>
                <ArrowUpRight className="w-3 h-3 text-[#B4B0B0]" />
              </a>

              <a
                href="mailto:realgauravpatel@gmail.com"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#38302D] bg-[#211B19] text-[#F4F8FF] hover:border-[#8B5CF6] hover:text-white transition cursor-pointer font-medium"
              >
                <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" />
                <span>realgauravpatel@gmail.com</span>
              </a>

              <a
                href="https://github.com/gaurav-tacles/ProjectHub"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-[#8B5CF6] hover:bg-[#8B5CF6]/25 transition cursor-pointer font-medium"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>ProjectHub Repository</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. DevLead Labs & Purpose Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Studio Philosophy */}
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-[#8B5CF6]">
            <Cpu className="w-5 h-5" />
            <h3 className="text-base font-semibold text-[#F4F8FF]">The DevLead Labs Vision</h3>
          </div>
          <p className="text-xs text-[#B4B0B0] leading-relaxed">
            DevLead Labs is an engineering laboratory dedicated to crafting robust digital platforms and developer tools. Rather than building ephemeral utilities, the focus is on architectural durability, strict access controls, and transparent software craftsmanship.
          </p>
          <div className="pt-2 text-xs font-mono text-[#8B5CF6] flex items-center gap-1.5">
            <span>Engineering Lab</span>
            <span>·</span>
            <span>Independent Software Studio</span>
          </div>
        </div>

        {/* Why ProjectHub Exists */}
        <div className="rounded-2xl border border-[#38302D] bg-[#191311] p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-[#34D399]">
            <Shield className="w-5 h-5" />
            <h3 className="text-base font-semibold text-[#F4F8FF]">Why ProjectHub Exists</h3>
          </div>
          <p className="text-xs text-[#B4B0B0] leading-relaxed">
            Modern development teams frequently juggle fragmented tools with opaque permissions. ProjectHub unifies project roadmaps, private documents, task tracking, and personal idea capture into one single-tenant workspace anchored by PostgreSQL Row-Level Security.
          </p>
          <div className="pt-2 text-xs font-mono text-[#34D399] flex items-center gap-1.5">
            <span>Zero Telemetry Clutter</span>
            <span>·</span>
            <span>Verified Role Sovereignty</span>
          </div>
        </div>
      </section>

      {/* 4. Engineering Standards */}
      <section className="rounded-2xl border border-[#38302D] bg-[#0F0B0A] p-6 text-center space-y-3">
        <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#B4B0B0]">
          <ProjectHubLogo size="sm" />
          <span>DevForge Architecture · DevLead Labs · Crafted by Patel Gaurav</span>
        </div>
        <p className="text-xs text-[#B4B0B0]/70 max-w-xl mx-auto">
          Every line of code is structured for direct verification, clear auditability, and long-term maintainability.
        </p>
      </section>
    </div>
  );
};
