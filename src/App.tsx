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
import { AnnouncementsView } from './components/announcements/AnnouncementsView';
import { SecurityView } from './components/security/SecurityView';
import { SettingsView } from './components/settings/SettingsView';
import { AuthScreen } from './components/auth/AuthScreen';
import { LoadingScreen } from './components/auth/LoadingScreen';

const WorkspaceShell: React.FC = () => {
  // Default selected navigation item after authenticated is 'overview' or 'team'
  const [currentView, setCurrentView] = useState<NavView>('overview');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const { activeProjectId, setActiveProjectId } = useWorkspace();

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

          {currentView === 'suggestions' && <SuggestionsView />}

          {currentView === 'tasks' && <TasksView />}

          {currentView === 'documents' && <DocumentsView />}

          {currentView === 'announcements' && <AnnouncementsView />}

          {currentView === 'security' && <SecurityView />}

          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

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
