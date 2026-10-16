export interface ShowcaseProject {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: 'Developer Platform' | 'Web Portal' | 'Developer Tools' | 'Web Application' | 'Design & Studio';
  status: 'Production' | 'Open Source' | 'In Development' | 'Active Studio';
  author: string;
  technologies: string[];
  verifiedSourceUrl?: string;
  verifiedLiveUrl?: string;
  imageUrl?: string;
  featured?: boolean;
  highlights: string[];
  stats?: { label: string; value: string }[];
}

export const BUILT_BY_US_PROJECTS: ShowcaseProject[] = [
  {
    id: 'projecthub',
    title: 'DEBPTH',
    subtitle: 'by DevLead Labs — Private Developer Workspace & Team Hub',
    description:
      'A private engineering workspace engineered for software teams and project leads. Combines unified email/password authentication, database-enforced Super Admin security, task management, encrypted document repository, repository tracking, and a personal ideas capture system.',
    category: 'Developer Platform',
    status: 'Production',
    author: 'Gaurav Patel & DevLead Labs',
    technologies: ['React 18', 'TypeScript', 'Tailwind CSS', 'Supabase', 'PostgreSQL', 'Vite', 'PWA'],
    verifiedSourceUrl: 'https://github.com/gaurav-tacles/ProjectHub',
    imageUrl: '/pwa-512x512.png',
    featured: true,
    highlights: [
      'Single unified login with server-side Super Admin role enforcement',
      'Row-Level Security on PostgreSQL for projects, documents, and personal ideas',
      'Mobile-first Floating Action Button for rapid idea capture',
      'Progressive Web App with offline-first capabilities',
    ],
    stats: [
      { label: 'Role Security', value: 'PostgreSQL RLS' },
      { label: 'Platform', value: 'PWA Ready' },
    ],
  },
  {
    id: 'campushub',
    title: 'CampusHub',
    subtitle: 'Multi-Role College Management Portal',
    description:
      'A multi-role college administration and student management portal designed to streamline academic scheduling, attendance tracking, faculty workflows, and student records.',
    category: 'Web Portal',
    status: 'Open Source',
    author: 'Gaurav Patel (gaurav-tacles)',
    technologies: ['PHP', 'MySQL', 'JavaScript', 'HTML5', 'CSS3'],
    verifiedSourceUrl: 'https://github.com/gaurav-tacles/CampusHub',
    featured: true,
    highlights: [
      'Multi-role access for administrators, faculty, and students',
      'Relational database architecture for student academic history',
      'Automated administrative records and course assignment',
    ],
    stats: [
      { label: 'Database', value: 'MySQL' },
      { label: 'Architecture', value: 'Multi-Role Portal' },
    ],
  },
  {
    id: 'regexvault',
    title: 'RegexVault',
    subtitle: 'Developer Pattern Library & Validator',
    description:
      'An intuitive web tool that enables developers to quickly search, inspect, and copy verified regular expression patterns for common input fields, validation rules, and data parsing.',
    category: 'Developer Tools',
    status: 'Open Source',
    author: 'Gaurav Patel (gaurav-tacles)',
    technologies: ['JavaScript', 'HTML5', 'CSS3', 'RegEx Engine'],
    verifiedSourceUrl: 'https://github.com/gaurav-tacles/RegexVault',
    featured: true,
    highlights: [
      'Instant pattern search for form validation and data sanitization',
      'Tested expression snippets for emails, phone numbers, URLs, and tokens',
      'Zero-dependency lightweight frontend client',
    ],
    stats: [
      { label: 'Target', value: 'Full-Stack Developers' },
      { label: 'Access', value: 'Open Source' },
    ],
  },
  {
    id: 'devlead-labs',
    title: 'DevLead Labs',
    subtitle: 'Software Architecture & Product Engineering Studio',
    description:
      'The engineering lab and software studio led by Gaurav Patel. Focuses on architecting scalable web applications, developer toolchains, modern UI systems, and private cloud software.',
    category: 'Design & Studio',
    status: 'Active Studio',
    author: 'DevLead Labs & Gaurav Patel',
    technologies: ['Web Architecture', 'Full-Stack Systems', 'Cloud Native', 'Design Systems'],
    featured: true,
    highlights: [
      'Architectural foundation for DEBPTH, Lunexa, and Deora',
      'Focus on high-velocity developer tools and privacy-first SaaS',
      'Tailored design systems built with precision typography and micro-interactions',
    ],
    stats: [
      { label: 'Organization', value: 'DevLead Labs' },
      { label: 'Focus', value: 'Modern Web & SaaS' },
    ],
  },
  {
    id: 'lunexa',
    title: 'Lunexa',
    subtitle: 'Modern Web Application Initiative',
    description:
      'A next-generation digital web application concept engineered under DevLead Labs, exploring modular UI architecture, performant state flows, and reactive developer interfaces.',
    category: 'Web Application',
    status: 'In Development',
    author: 'DevLead Labs',
    technologies: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'],
    featured: false,
    highlights: [
      'Component-driven reactive user experience',
      'High-performance rendering pipeline',
      'In active development under DevLead Labs',
    ],
    stats: [{ label: 'Status', value: 'In Active Development' }],
  },
  {
    id: 'deora',
    title: 'Deora',
    subtitle: 'Digital Brand & Web Experience Platform',
    description:
      'A bespoke digital experience platform created by DevLead Labs focusing on minimalist design, accessible interactions, and fluid typography for digital engagement.',
    category: 'Web Application',
    status: 'In Development',
    author: 'DevLead Labs',
    technologies: ['React', 'TypeScript', 'Modern CSS Architecture'],
    featured: false,
    highlights: [
      'Refined typographic hierarchy with dark aesthetic principles',
      'Touch-optimized responsive interfaces',
      'In active development under DevLead Labs',
    ],
    stats: [{ label: 'Status', value: 'In Active Development' }],
  },
  {
    id: 'lavuirte',
    title: 'Lavuirte',
    subtitle: 'Design-Forward Digital Product Experience',
    description:
      'A specialized digital application experience crafted by DevLead Labs highlighting precision frontend engineering, dark-mode visual hierarchy, and performance.',
    category: 'Design & Studio',
    status: 'In Development',
    author: 'DevLead Labs',
    technologies: ['Frontend Engineering', 'UI/UX Architecture', 'Micro-Interactions'],
    featured: false,
    highlights: [
      'Tailored design system and bespoke component kit',
      'Engineered for maximum accessibility and viewport presence',
      'In active development under DevLead Labs',
    ],
    stats: [{ label: 'Status', value: 'In Active Development' }],
  },
  {
    id: 'eventhub',
    title: 'EventHub',
    subtitle: 'Virtual Event Coordination & Management System',
    description:
      'A menu-driven Python application designed to coordinate, schedule, and handle participants for virtual events with structured data tracking.',
    category: 'Developer Tools',
    status: 'Open Source',
    author: 'Gaurav Patel (gaurav-tacles)',
    technologies: ['Python', 'CLI Architecture', 'Data Structures'],
    verifiedSourceUrl: 'https://github.com/gaurav-tacles/EventHub',
    featured: false,
    highlights: [
      'Automated virtual event registration and roster tracking',
      'Clean menu-driven console workflow',
      'Modular Python codebase',
    ],
    stats: [{ label: 'Language', value: 'Python' }],
  },
];
