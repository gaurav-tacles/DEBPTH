import React from 'react';

interface ProjectHubLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
  variant?: 'default' | 'monochrome';
}

export const ProjectHubLogo: React.FC<ProjectHubLogoProps> = ({
  size = 'md',
  showWordmark = false,
  className = '',
  variant = 'default',
}) => {
  const sizeMap = {
    sm: { icon: 'w-6 h-6', text: 'text-xs', subtext: 'text-[9px]' },
    md: { icon: 'w-8 h-8', text: 'text-sm', subtext: 'text-[10px]' },
    lg: { icon: 'w-10 h-10', text: 'text-base', subtext: 'text-xs' },
    xl: { icon: 'w-14 h-14', text: 'text-xl', subtext: 'text-xs' },
  };

  const { icon, text, subtext } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Vector Emblem */}
      <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#1E1428] to-[#120E18] border border-[#8B5CF6]/30 shadow-lg shadow-[#8B5CF6]/10 shrink-0 ${icon} p-1.5`}>
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          aria-label="DEBPTH Logo"
        >
          <defs>
            <linearGradient id="ph-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="ph-grad-accent" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>
          </defs>

          {/* Hexagonal Hub Nodes */}
          <path
            d="M16 3L27 9.5V22.5L16 29L5 22.5V9.5L16 3Z"
            stroke="url(#ph-grad-primary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-90"
          />
          {/* Inner Apex Chevron */}
          <path
            d="M16 8L22 12V20L16 24L10 20V12L16 8Z"
            fill="url(#ph-grad-primary)"
            fillOpacity="0.2"
            stroke="url(#ph-grad-primary)"
            strokeWidth="1.5"
          />
          {/* Central Nexus Core */}
          <circle cx="16" cy="16" r="3" fill="#F4F8FF" />
          {/* Branch Connectors */}
          <line x1="16" y1="8" x2="16" y2="13" stroke="url(#ph-grad-accent)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="20" x2="13.5" y2="18" stroke="url(#ph-grad-accent)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="22" y1="20" x2="18.5" y2="18" stroke="url(#ph-grad-accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* Optional Wordmark */}
      {showWordmark && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold tracking-tight text-[#F4F8FF] ${text}`}>
              DEB<span className="text-[#8B5CF6]">PTH</span>
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" title="Cluster Active" />
          </div>
          <span className={`font-mono text-[#8B5CF6] truncate ${subtext}`}>
            by DevLead Labs
          </span>
        </div>
      )}
    </div>
  );
};

export { ProjectHubLogo as DebpthLogo };
