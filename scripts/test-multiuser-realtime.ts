import { workspaceRepo } from '../src/services/workspaceRepository';
import { generateSecureToken, hashTokenSync, isValidUuid } from '../src/lib/crypto';
import { DEFAULT_VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '../src/lib/vapid';

async function runTests() {
  console.log('--- Starting DEBPTH Multi-User Data, Security & Realtime Test Suite ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  // Test 1: 256-Bit Cryptographic Entropy for Invitation Tokens
  const rawToken = generateSecureToken();
  const hexPart = rawToken.replace('ph_inv_', '');
  assert(rawToken.startsWith('ph_inv_'), 'Invitation token has ph_inv_ prefix');
  assert(hexPart.length >= 64, `Invitation token has >= 256 bits of entropy (hex length: ${hexPart.length})`);

  const tokenHash = hashTokenSync(rawToken);
  assert(tokenHash.length === 64, `Token hash is exactly 64-char SHA-256 hex string (${tokenHash.length})`);
  assert(tokenHash !== rawToken, 'Raw token and token hash are completely distinct');

  // Test 2: Suggestions Shared Data Visibility (Multi-User Collaboration)
  const adminId = '00000000-0000-4000-8000-000000000099';
  const superAdmin = await workspaceRepo.ensureAuthenticatedProfile(
    adminId,
    'realgauravpatel@gmail.com',
    'Gaurav Patel (Super Admin)'
  );
  assert(Boolean(superAdmin && superAdmin.role === 'super_admin'), 'Super Admin profile exists');

  // Create test member A and test member B
  const memberAId = '00000000-0000-4000-8000-000000000001';
  const memberBId = '00000000-0000-4000-8000-000000000002';
  await workspaceRepo.ensureAuthenticatedProfile(memberAId, 'member.a@debpth.test', 'Member A');
  await workspaceRepo.ensureAuthenticatedProfile(memberBId, 'member.b@debpth.test', 'Member B');
  workspaceRepo.addWorkspaceMember(memberAId, 'member', adminId);
  workspaceRepo.addWorkspaceMember(memberBId, 'member', adminId);

  const sugA = workspaceRepo.createSuggestion({
    title: 'Multi-User Collaboration Board',
    description: 'Ensure all team members can see each other suggestions.',
    category: 'feature',
    submitterId: memberAId,
  });

  assert(isValidUuid(sugA.id), `Suggestion ID is a valid RFC4122 UUID: ${sugA.id}`);

  // Member B retrieves suggestions
  const allSuggestionsForB = workspaceRepo.getSuggestions(memberBId);
  const foundSugA = allSuggestionsForB.find((s) => s.id === sugA.id);
  assert(
    Boolean(foundSugA),
    'Member B can see Member A suggestion (fixing multi-user shared data bug)'
  );

  // Test 3: Status update on suggestion
  workspaceRepo.updateSuggestionStatus(
    sugA.id,
    'under_review',
    'Admin reviewing this collaboration feature',
    'We are rolling this out workspace-wide',
    superAdmin?.id
  );
  const updatedSug = workspaceRepo.getSuggestions().find((s) => s.id === sugA.id);
  assert(
    updatedSug?.status === 'under_review',
    'Suggestion status successfully updated to under_review'
  );

  // Test 4: Private Ideas Strict User Isolation
  const ideaA = workspaceRepo.createIdea(
    {
      title: 'Private Engineering Note',
      description: 'Strictly confidential architecture ideas.',
      category: 'architecture',
      priority: 'high',
      status: 'inbox',
      tags: ['security', 'private'],
    },
    memberAId
  );

  const memberBIdeas = workspaceRepo.getIdeas(memberBId);
  const leakedIdea = memberBIdeas.find((i) => i.id === ideaA.id);
  assert(
    !leakedIdea,
    'Member B CANNOT see Member A private personal idea (strict isolation verified)'
  );

  const memberAIdeas = workspaceRepo.getIdeas(memberAId);
  const foundIdeaA = memberAIdeas.find((i) => i.id === ideaA.id);
  assert(
    Boolean(foundIdeaA),
    'Member A can retrieve their own private idea'
  );

  // Test 5: Tasks, Milestones, and Documents UUID generation
  let testProject = workspaceRepo.getProjects()[0];
  if (!testProject) {
    testProject = await workspaceRepo.createProject({
      name: 'DEBPTH Infrastructure Core',
      slug: 'debpth-infrastructure-core',
      summary: 'Test project for multi-user real-time capabilities',
      description: 'Test project description',
      goals: ['Realtime sync', 'Multi-user collaboration'],
      features: ['Live updates', 'Web push'],
      status: 'in_progress',
      priority: 'high',
      techStack: ['React', 'Supabase', 'TypeScript'],
      repositories: [],
      links: [],
      ownerId: superAdmin.id,
    }, superAdmin.id);
  }
  assert(Boolean(testProject), 'Test project exists');

  if (testProject) {
    const task = workspaceRepo.createTask(
      {
        projectId: testProject.id,
        title: 'Realtime WebSocket verification',
        description: 'Verify live channel sync',
        status: 'in_progress',
        priority: 'high',
        tags: ['Realtime', 'Supabase'],
      },
      superAdmin!.id
    );
    assert(isValidUuid(task.id), `Task ID is a valid RFC4122 UUID: ${task.id}`);

    const milestone = workspaceRepo.createMilestone({
      projectId: testProject.id,
      title: 'v2.0 Multi-User Realtime Upgrade',
      dueDate: '2026-12-31',
      status: 'open',
    });
    assert(isValidUuid(milestone.id), `Milestone ID is a valid RFC4122 UUID: ${milestone.id}`);

    const doc = workspaceRepo.createDocument({
      projectId: testProject.id,
      title: 'Realtime Architecture Specification',
      fileName: 'architecture.pdf',
      fileSize: 1048576,
      mimeType: 'application/pdf',
      storagePath: 'docs/architecture.pdf',
      isRestricted: true,
      uploadedBy: superAdmin!.id,
    });
    assert(isValidUuid(doc.id), `Document ID is a valid RFC4122 UUID: ${doc.id}`);

    const grant = workspaceRepo.requestDocumentAccess(
      doc.id,
      memberAId,
      'Need access to review architecture'
    );
    assert(isValidUuid(grant.id), `Document grant ID is a valid RFC4122 UUID: ${grant.id}`);
  }

  // Test 6: VAPID Public Key and Base64 Conversion
  assert(DEFAULT_VAPID_PUBLIC_KEY.length > 50, 'Default VAPID public key is configured');
  const vapidBytes = urlBase64ToUint8Array(DEFAULT_VAPID_PUBLIC_KEY);
  assert(vapidBytes.length === 65, `VAPID uncompressed P-256 public key is exactly 65 bytes (${vapidBytes.length})`);

  console.log(`\n--- Test Summary: ${passed} / ${total} tests passed ---`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
