import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { AppHeader } from './components/layout/AppHeader';
import { AppSidebar, NavView } from './components/layout/AppSidebar';
import { MobileNav } from './components/layout/MobileNav';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { NotificationDrawer } from './components/notifications/NotificationDrawer';
import { DashboardView } from './components/dashboard/DashboardView';
import { ProjectList } from './components/projects/ProjectList';
import { ProjectDetail } from './components/projects/ProjectDetail';
import { TasksView } from './components/tasks/TasksView';
import { MilestonesView } from './components/milestones/MilestonesView';
import { DocumentsView } from './components/documents/DocumentsView';
import { SuggestionsView } from './components/suggestions/SuggestionsView';
import { TeamDirectory } from './components/team/TeamDirectory';
import { IdeasView } from './components/ideas/IdeasView';
import { IdeaCaptureModal } from './components/ideas/IdeaCaptureModal';
import { AnnouncementsView } from './components/announcements/AnnouncementsView';
import { SecurityView } from './components/security/SecurityView';
import { SettingsView } from './components/settings/SettingsView';
import { AuthScreen } from './components/auth/AuthScreen';
import { LoadingScreen } from './components/auth/LoadingScreen';
import { Brain } from 'lucide-react';

const WorkspaceShell: React.FC = () => {
  // Default selected navigation item after authenticated is 'overview' or 'team'
  const [currentView, setCurrentView] = useState<NavView>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isIdeaModalOpen, setIsIdeaModalOpen] = useState(false);

  const { activeProjectId, setActiveProjectId, createIdea } = useWorkspace();

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveProjectId(projectId);
    setCurrentView('project-detail');
  };

  const handleNavigate = (view: NavView) => {
    setCurrentView(view);
  };

  return (
    <div className="min-h-screen bg-[#0F0B0A] text-[#F4F8FF] flex flex-col font-['Geist',sans-serif] selection:bg-[#8B5CF6] selection:text-white">
      {/* Top Application Header */}
      <AppHeader
        currentView={currentView}
        onToggleMobileNav={() => setIsMobileNavOpen(!isMobileNavOpen)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
      />

      {/* Main Container with Sidebar + Main View */}
      <div className="flex flex-1 w-full max-w-7xl mx-auto">
        <AppSidebar currentView={currentView} onNavigate={handleNavigate} />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
          {currentView === 'overview' && (
            <DashboardView
              onNavigateToProjects={() => setCurrentView('projects')}
              onNavigateToTasks={() => setCurrentView('tasks')}
              onNavigateToTeam={() => setCurrentView('team')}
              onNavigateToSuggestions={() => setCurrentView('suggestions')}
              onSelectProject={handleSelectProject}
            />
          )}

          {currentView === 'projects' && (
            <ProjectList
              onSelectProject={handleSelectProject}
              searchFilter=""
            />
          )}

          {currentView === 'project-detail' && (
            <ProjectDetail
              projectId={selectedProjectId || activeProjectId || ''}
              onBack={() => setCurrentView('projects')}
              onNavigateToTasks={() => setCurrentView('tasks')}
              onNavigateToDocs={() => setCurrentView('documents')}
            />
          )}

          {currentView === 'team' && <TeamDirectory />}

          {currentView === 'ideas' && <IdeasView />}

          {currentView === 'suggestions' && <SuggestionsView />}

          {currentView === 'tasks' && <TasksView />}

          {currentView === 'documents' && <DocumentsView />}

          {currentView === 'announcements' && <AnnouncementsView />}

          {currentView === 'security' && <SecurityView />}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Floating Action Button for Ideas Quick-Capture (Prominent on mobile, accessible on desktop) */}
      <aside aria-label="Quick capture" className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          onClick={() => setIsIdeaModalOpen(true)}
          className="group flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] p-3.5 sm:px-4 sm:py-3 text-white shadow-xl shadow-[#8B5CF6]/25 transition-all hover:shadow-[#8B5CF6]/40 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-[#0F0B0A]"
          aria-label="Capture an idea"
          title="Capture an idea"
        >
          <Brain className="h-5 w-5 transition-transform group-hover:rotate-12" />
          <span className="hidden sm:inline text-xs font-semibold tracking-wide">Capture Idea</span>
        </button>
      </aside>

      {/* Quick Idea Capture Modal */}
      <IdeaCaptureModal
        isOpen={isIdeaModalOpen}
        onClose={() => setIsIdeaModalOpen(false)}
        onSave={(data) => createIdea(data)}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNav
        currentView={currentView}
        onNavigate={handleNavigate}
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateTo={(view) => setCurrentView(view as NavView)}
      />

      {/* Offline Status Badge */}
      <OfflineIndicator />
    </div>
  );
};

const ProtectedAppRouter: React.FC = () => {
  const { isAuthenticated, isCheckingAuth, currentUser } = useWorkspace();

  // Phase 2 Step 3: While checking the session, display a polished branded loading screen
  if (isCheckingAuth) {
    return <LoadingScreen message="Verifying session and security tokens..." />;
  }

  // Phase 2 Step 4: If no valid session exists, show the login screen
  if (!isAuthenticated || !currentUser) {
    return <AuthScreen />;
  }

  // Phase 2 Step 8: Only after successful authentication, display the protected workspace
  return <WorkspaceShell />;
};

export default function App() {
  return (
    <WorkspaceProvider>
      <ProtectedAppRouter />
    </WorkspaceProvider>
  );
}
