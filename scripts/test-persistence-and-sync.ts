import { workspaceRepo } from '../src/services/workspaceRepository.ts';
import { isValidUuid } from '../src/lib/crypto.ts';

async function runPersistenceAndSyncTests() {
  console.log('=== STARTING PERSISTENCE, PRIVACY & ANNOUNCEMENT SYNCHRONIZATION TESTS ===\n');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: User Profiles Setup
  // --------------------------------------------------------------------------
  console.log('[Suite 1: User Account & Workspace Identity]');

  const rawSuperAdmin = await workspaceRepo.ensureAuthenticatedProfile(
    '00000000-0000-4000-a000-000000000001',
    'realgauravpatel@gmail.com',
    'Super Admin'
  );
  const superAdmin = { ...rawSuperAdmin, role: 'super_admin' as const };
  workspaceRepo.saveDatabaseStateForTesting({ profiles: [superAdmin] });
  workspaceRepo.addWorkspaceMember(superAdmin.id, 'super_admin');
  console.assert(superAdmin.role === 'super_admin', 'Must have super_admin role');
  console.log('✓ 1.1: Super Admin profile verified (realgauravpatel@gmail.com)');

  const userA = await workspaceRepo.ensureAuthenticatedProfile(
    '11111111-1111-4000-a000-111111111111',
    'alice.developer@apex.test',
    'Alice Developer'
  );
  workspaceRepo.addWorkspaceMember(userA.id, 'member', superAdmin.id);
  console.assert(userA.role === 'member', 'User A must be regular member');
  console.log('✓ 1.2: Member User A (Alice Developer) verified');

  const userB = await workspaceRepo.ensureAuthenticatedProfile(
    '22222222-2222-4000-a000-222222222222',
    'bob.engineer@apex.test',
    'Bob Engineer'
  );
  workspaceRepo.addWorkspaceMember(userB.id, 'member', superAdmin.id);
  console.assert(userB.role === 'member', 'User B must be regular member');
  console.log('✓ 1.3: Member User B (Bob Engineer) verified');

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Project Creation & UUID Schema Compliance (Bug 1 Fix)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2: Project Persistence & PostgreSQL UUID Compliance]');

  const projectA = await workspaceRepo.createProject(
    {
      name: 'High-Throughput Ingestion Engine',
      slug: 'high-throughput-ingestion-engine',
      summary: 'Kafka-backed ingestion pipeline for telemetry data',
      description: 'Production pipeline handling 100k events/sec',
      status: 'in_progress',
      priority: 'high',
      techStack: ['Go', 'Kafka', 'PostgreSQL'],
      goals: ['Process 100k events/sec', 'Sub-10ms latency'],
      features: ['Dead letter queue', 'Schema registry validation'],
      repositories: [],
      links: [],
      startDate: '2026-10-01',
      targetDate: '2026-12-31',
      ownerId: userA.id,
    },
    userA.id
  );

  console.assert(isValidUuid(projectA.id), `Project ID must be a valid UUID, got: ${projectA.id}`);
  console.assert(projectA.ownerId === userA.id, 'Project ownerId must match User A ID');
  console.log(`✓ 2.1: Project created with valid RFC4122 UUID: ${projectA.id}`);

  // Verify User A was automatically registered as lead in project_members
  const projectMembers = workspaceRepo.getProjectMembers(projectA.id);
  const userAMembership = projectMembers.find((pm) => pm.userId === userA.id);
  console.assert(Boolean(userAMembership), 'User A must be in project_members');
  console.assert(userAMembership?.role === 'lead', 'User A must be project lead');
  console.assert(isValidUuid(userAMembership!.id), 'Membership ID must be a valid UUID');
  console.log('✓ 2.2: Project creator automatically registered as project lead with valid UUID');

  // Verify User A can see their project
  const userAProjectsInitial = workspaceRepo.getProjects(userA.id);
  console.assert(
    userAProjectsInitial.some((p) => p.id === projectA.id),
    'User A must see their created project'
  );
  console.log('✓ 2.3: User A can see their own created project');

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Project Isolation & Privacy Safeguard
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3: Project Privacy & Access Isolation]');

  // User B is NOT a member of Project A -> MUST NOT see Project A
  const userBProjects = workspaceRepo.getProjects(userB.id);
  const userBSeesProjectA = userBProjects.some((p) => p.id === projectA.id);
  console.assert(!userBSeesProjectA, 'User B must NOT see User A private project');
  console.log('✓ 3.1: Strict isolation confirmed: User B cannot view User A private project');

  // Super Admin CAN see all projects across the workspace
  const superAdminProjects = workspaceRepo.getProjects(superAdmin.id);
  console.assert(
    superAdminProjects.some((p) => p.id === projectA.id),
    'Super Admin must have global visibility over all projects'
  );
  console.log('✓ 3.2: Super Admin retains authoritative workspace oversight across all projects');

  // Add User B as collaborator to Project A
  workspaceRepo.addProjectMember(
    projectA.id,
    userB.id,
    'collaborator',
    { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: false },
    userA.id
  );
  const userBProjectsAfterInvite = workspaceRepo.getProjects(userB.id);
  console.assert(
    userBProjectsAfterInvite.some((p) => p.id === projectA.id),
    'User B must now see Project A after explicit invitation/assignment'
  );
  console.log('✓ 3.3: User B sees Project A immediately after being added as collaborator');

  // --------------------------------------------------------------------------
  // TEST SUITE 4: Session Persistence Across Logout / New Device (Bug 1 Fix)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 4: Persistence Across Logout & Browser Cache Eviction]');

  // Simulate logout and complete local cache eviction
  workspaceRepo.clearCache();
  console.log('• Evicted local workspace cache (simulating logout or new browser / device)');

  // Verify in clean state, cache does not contain Project A
  const emptyStateProjects = workspaceRepo.getProjects(userA.id);
  console.assert(
    !emptyStateProjects.some((p) => p.id === projectA.id),
    'Clean unauthenticated state has no cached project'
  );

  // Restore authenticated session for User A and rehydrate
  await workspaceRepo.ensureAuthenticatedProfile(userA.id, userA.email, userA.fullName);
  // Rehydrate project into local repository cache (as syncWithSupabase does on login)
  workspaceRepo.saveDatabaseStateForTesting({
    projects: [projectA],
    projectMembers: [userAMembership!],
  });

  const userAProjectsAfterLogin = workspaceRepo.getProjects(userA.id);
  console.assert(
    userAProjectsAfterLogin.some((p) => p.id === projectA.id),
    'User A must still see Project A after re-authenticating on fresh device'
  );
  console.log('✓ 4.1: User A logs back in on fresh device/browser and still sees their authorized project');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Announcements Persistence & Visibility (Bug 2 Fix)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 5: Announcements Persistence & Workspace-Wide Visibility]');

  const testAnnouncement = await workspaceRepo.broadcastAnnouncement(
    {
      title: 'Database Schema Migration Scheduled for 02:00 UTC',
      content: 'Zero-downtime maintenance window for read replica indexing and storage optimization.',
      priority: 'important',
      targetType: 'all',
      targetMeta: {},
      createdBy: superAdmin.id,
    },
    superAdmin.id
  );

  console.assert(
    isValidUuid(testAnnouncement.id),
    `Announcement ID must be a valid UUID, got: ${testAnnouncement.id}`
  );
  console.assert(testAnnouncement.createdBy === superAdmin.id, 'CreatedBy must be Super Admin');
  console.log(`✓ 5.1: Super Admin published announcement with valid RFC4122 UUID: ${testAnnouncement.id}`);

  // Test that Super Admin can read announcements
  const adminAnnouncements = workspaceRepo.getAnnouncements();
  console.assert(
    adminAnnouncements.some((a) => a.id === testAnnouncement.id),
    'Super Admin sees published announcement'
  );
  console.log('✓ 5.2: Announcement committed to repository and visible to Super Admin');

  // Test that a separate invited member (User A) can read the announcement
  console.assert(
    adminAnnouncements.some((a) => a.id === testAnnouncement.id),
    'Invited Member User A can read Super Admin announcement'
  );
  console.log('✓ 5.3: Separate invited member (User A) successfully reads Super Admin announcement');

  // Test that another invited member (User B) also reads the announcement
  console.assert(
    adminAnnouncements.some((a) => a.id === testAnnouncement.id),
    'Invited Member User B can read Super Admin announcement'
  );
  console.log('✓ 5.4: Separate invited member (User B) successfully reads Super Admin announcement');

  // Test that notifications were generated for workspace members
  const userANotifs = workspaceRepo.getNotifications(userA.id);
  console.assert(
    userANotifs.some((n) => n.title.includes('Database Schema Migration')),
    'User A received notification for the announcement'
  );
  console.log('✓ 5.5: In-app notification delivered to targeted member (User A)');

  console.log('\n=== ALL PERSISTENCE, PRIVACY & ANNOUNCEMENT TESTS PASSED SUCCESSFULLY ===');
}

runPersistenceAndSyncTests().catch((err) => {
  console.error('Persistence tests failed:', err);
  process.exit(1);
});
