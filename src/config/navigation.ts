import {
  LayoutDashboard,
  FolderKanban,
  Sparkles,
  Brain,
  Users,
  CheckSquare,
  FileText,
  Lightbulb,
  Bell,
  ShieldCheck,
  Settings,
  LucideIcon,
} from 'lucide-react';

export type NavView =
  | 'overview'
  | 'projects'
  | 'project-detail'
  | 'built-by-us'
  | 'ideas'
  | 'team'
  | 'suggestions'
  | 'tasks'
  | 'documents'
  | 'announcements'
  | 'security'
  | 'settings';

export interface NavItemConfig {
  id: NavView;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badgeKey?: 'projects' | 'ideas' | 'suggestions' | 'announcements';
  featured?: boolean;
  section: 'workspace' | 'showcase' | 'collaboration' | 'system';
}

export const NAVIGATION_ITEMS: NavItemConfig[] = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: LayoutDashboard,
    section: 'workspace',
  },
  {
    id: 'projects',
    label: 'Projects',
    shortLabel: 'Projects',
    icon: FolderKanban,
    badgeKey: 'projects',
    section: 'workspace',
  },
  {
    id: 'built-by-us',
    label: 'Built by Us',
    shortLabel: 'Showcase',
    icon: Sparkles,
    featured: true,
    section: 'showcase',
  },
  {
    id: 'ideas',
    label: 'Ideas & Notes',
    shortLabel: 'Ideas',
    icon: Brain,
    badgeKey: 'ideas',
    section: 'workspace',
  },
  {
    id: 'team',
    label: 'Team Directory',
    shortLabel: 'Team',
    icon: Users,
    section: 'collaboration',
  },
  {
    id: 'tasks',
    label: 'Tasks & Kanban',
    shortLabel: 'Tasks',
    icon: CheckSquare,
    section: 'collaboration',
  },
  {
    id: 'documents',
    label: 'Document Library',
    shortLabel: 'Docs',
    icon: FileText,
    section: 'collaboration',
  },
  {
    id: 'suggestions',
    label: 'Suggestions Center',
    shortLabel: 'Ideas Box',
    icon: Lightbulb,
    badgeKey: 'suggestions',
    section: 'collaboration',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    shortLabel: 'Alerts',
    icon: Bell,
    badgeKey: 'announcements',
    section: 'system',
  },
  {
    id: 'security',
    label: 'Access & Security',
    shortLabel: 'Security',
    icon: ShieldCheck,
    section: 'system',
  },
  {
    id: 'settings',
    label: 'Settings & DB',
    shortLabel: 'Settings',
    icon: Settings,
    section: 'system',
  },
];

export function getBreadcrumbTitle(view: NavView): string {
  switch (view) {
    case 'overview':
      return 'Overview';
    case 'projects':
    case 'project-detail':
      return 'Projects';
    case 'built-by-us':
      return 'Built by Us';
    case 'ideas':
      return 'Ideas & Notes';
    case 'team':
      return 'Team Directory';
    case 'tasks':
      return 'Tasks & Kanban';
    case 'documents':
      return 'Private Documents';
    case 'suggestions':
      return 'Suggestions Center';
    case 'announcements':
      return 'Announcements';
    case 'security':
      return 'Access & Security';
    case 'settings':
      return 'Settings & Database';
    default:
      return 'Workspace';
  }
}
