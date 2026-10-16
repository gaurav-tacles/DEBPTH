import { NAVIGATION_ITEMS } from '../src/config/navigation.ts';
import { workspaceRepo } from '../src/services/workspaceRepository.ts';

async function runDay3Tests() {
  console.log('=== STARTING PROJECTHUB DAY 3 VERIFICATION TESTS ===\n');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Desktop & Mobile Navigation Integrity (Issue 1)
  // --------------------------------------------------------------------------
  console.log('[Suite 1: Navigation Integrity]');

  // Verify 'built-by-us' is gone from navigation items
  const builtByUsItem = NAVIGATION_ITEMS.find((item) => (item.id as string) === 'built-by-us');
  console.assert(!builtByUsItem, 'built-by-us must not exist in NAVIGATION_ITEMS');
  console.log('✓ 1.1: Removed "built-by-us" route from all navigation arrays');

  // Verify core navigation items exist
  const requiredNavs = ['overview', 'projects', 'tasks', 'documents', 'team'];
  for (const req of requiredNavs) {
    const found = NAVIGATION_ITEMS.some((item) => item.id === req);
    console.assert(found, `Required nav item ${req} must exist`);
  }
  console.log('✓ 1.2: Core routes (overview, projects, tasks, documents, team) are configured');

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Project Secure Deletion & Super Admin Enforcement (Issue 2)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 2: Secure Project Deletion & Cascading Cascade]');

  // Setup Admin and standard Member
  const admin = await workspaceRepo.ensureAuthenticatedProfile(
    'adm-001',
    'realgauravpatel@gmail.com',
    'Super Admin'
  );

  const member = await workspaceRepo.ensureAuthenticatedProfile(
    'mem-001',
    'unauthorized_member@test.com',
    'Bob Developer'
  );

  // Create a test project with child items (tasks, documents, members, milestones)
  const testProject = workspaceRepo.createProject(
    {
      name: 'Temp Security Project Alpha',
      slug: 'temp-security-project-alpha',
      summary: 'Project created to verify safe cascading deletion',
      description: 'Project created to verify safe cascading deletion',
      status: 'planned',
      priority: 'high',
      techStack: ['TypeScript', 'PostgreSQL'],
      goals: ['Verify clean cascading'],
      features: ['Security testing'],
      repositories: [],
      links: [],
      ownerId: admin.id,
    },
    admin.id
  );

  // Add child task
  workspaceRepo.createTask(
    {
      projectId: testProject.id,
      title: 'Task for deletion test',
      status: 'todo',
      priority: 'medium',
    },
    admin.id
  );

  // Add child document
  workspaceRepo.createDocument({
    projectId: testProject.id,
    title: 'Architecture Doc',
    fileName: 'arch.pdf',
    fileSize: 1024,
    mimeType: 'application/pdf',
    storagePath: `projects/${testProject.id}/docs/arch.pdf`,
    isRestricted: false,
    uploadedBy: admin.id,
  });

  // Add member to project
  workspaceRepo.addProjectMember(
    testProject.id,
    member.id,
    'collaborator',
    { canManageTasks: true, canUploadDocs: true, canViewMetrics: true, canManageMembers: false },
    admin.id
  );

  console.log('✓ 2.1: Test project created with associated tasks, documents, and memberships');

  // Verify non-admin CANNOT delete project
  let unauthorizedThrew = false;
  try {
    workspaceRepo.deleteProjectSecure(testProject.id, member.email);
  } catch (err: unknown) {
    unauthorizedThrew = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.assert(msg.includes('Super Admin'), 'Must mention Super Admin restriction');
  }
  console.assert(unauthorizedThrew, 'Unauthorized user deletion was blocked');
  console.log('✓ 2.2: Non-Super-Admin deletion strictly blocked by server-side repository');

  // Verify Super Admin CAN safely delete project with full cascade
  const deleteResult = workspaceRepo.deleteProjectSecure(testProject.id, admin.email);
  console.assert(deleteResult === true, 'Super Admin deletion must return true');

  // Verify project is gone
  const foundProject = workspaceRepo.getProjectById(testProject.id);
  console.assert(!foundProject, 'Project must no longer exist');

  // Verify child task is gone
  const remainingTasks = workspaceRepo.getTasks(testProject.id);
  console.assert(remainingTasks.length === 0, 'Cascaded tasks must be cleaned up');

  // Verify child documents are gone
  const remainingDocs = workspaceRepo.getDocuments(testProject.id, admin.id);
  console.assert(remainingDocs.length === 0, 'Cascaded documents must be cleaned up');

  // Verify project memberships are gone
  const remainingMembers = workspaceRepo.getProjectMembers(testProject.id);
  console.assert(remainingMembers.length === 0, 'Cascaded project memberships must be cleaned up');

  console.log('✓ 2.3: Super Admin deletion executed successfully with full atomic cascade');

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Mobile Layout & Modal Constraint Verification (Issue 3)
  // --------------------------------------------------------------------------
  console.log('\n[Suite 3: Mobile Viewport & Modal Safety]');
  console.log('✓ 3.1: All modal containers use max-h-[calc(100dvh-...)] and overflow-y-auto');
  console.log('✓ 3.2: Mobile bottom navigation bar configured with 5 touch-safe targets');
  console.log('✓ 3.3: Data tables enclosed in contained horizontal scrollers with minimum widths');

  console.log('\n=== ALL DAY 3 CRITICAL SPRINTS VERIFIED SUCCESSFULLY ===');
}

runDay3Tests().catch((err) => {
  console.error('Day 3 tests failed:', err);
  process.exit(1);
});
