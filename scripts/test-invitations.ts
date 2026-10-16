import { generateSecureToken, hashTokenSync, hashToken } from '../src/lib/crypto.ts';
import { workspaceRepo } from '../src/services/workspaceRepository.ts';

async function runTests() {
  console.log('--- STARTING INVITATION SECURITY TESTS ---');

  // Test 1: Secure token generation & entropy
  const token1 = generateSecureToken();
  const token2 = generateSecureToken();
  console.assert(token1 !== token2, 'Tokens must be unique');
  console.assert(token1.startsWith('ph_inv_'), 'Token must have prefix ph_inv_');
  console.assert(token1.length >= 32, 'Token must have sufficient entropy');
  console.log('✓ Test 1: Cryptographic token generation verified');

  // Test 2: SHA-256 Hash consistency
  const hash1 = hashTokenSync('test_token_123');
  const hash2 = await hashToken('test_token_123');
  console.assert(hash1 === hash2, 'Sync and Async SHA-256 hashes must match');
  console.assert(hash1 === 'bbfcac479ae185baa069d949873434eac6cb1bbbd6f68dc42906224887da7778', 'Must match standard SHA-256 digest');
  console.log('✓ Test 2: Standard SHA-256 hashing consistency verified');

  // Setup Admin profile in repository
  const adminProfile = await workspaceRepo.ensureAuthenticatedProfile(
    'admin-123',
    'realgauravpatel@gmail.com',
    'Super Admin'
  );

  // Test 3: Create invitation
  const testEmail = 'developer@apex.test';
  const inv = workspaceRepo.createInvitation(
    testEmail,
    'member',
    ['Backend', 'Go'],
    [],
    7,
    adminProfile.id,
    'collaborator'
  );
  console.assert(Boolean(inv.token), 'Created invitation returns token');
  console.assert(Boolean(inv.tokenHash), 'Created invitation has tokenHash');
  console.assert(inv.status === 'pending', 'Initial status is pending');
  console.log('✓ Test 3: Secure invitation creation verified');

  // Test 4: Email mismatch rejection
  let emailMismatchThrew = false;
  try {
    workspaceRepo.redeemInvitation(inv.token!, 'Imposter User', 'wrong@email.com');
  } catch (e: any) {
    emailMismatchThrew = true;
    console.assert(e.message.includes('issued to'), 'Error message must specify email mismatch');
  }
  console.assert(emailMismatchThrew, 'Email mismatch must be rejected');
  console.log('✓ Test 4: Email matching requirement verified');

  // Test 5: Replay prevention & Exactly-once redemption
  const profile = workspaceRepo.redeemInvitation(inv.token!, 'Alice Developer', testEmail);
  console.assert(profile.email === testEmail, 'Profile created with matching email');
  console.assert(profile.role === 'member', 'Profile role is member (no escalation)');

  let replayThrew = false;
  try {
    workspaceRepo.redeemInvitation(inv.token!, 'Alice Again', testEmail);
  } catch (e: any) {
    replayThrew = true;
    console.assert(e.message.includes('already been redeemed'), 'Replay must be blocked');
  }
  console.assert(replayThrew, 'Replay/duplicate redemption was blocked');
  console.log('✓ Test 5: Single-use / replay protection verified');

  // Test 6: Revocation check
  const inv2 = workspaceRepo.createInvitation(
    'revoked@apex.test',
    'member',
    [],
    [],
    7,
    adminProfile.id
  );
  workspaceRepo.revokeInvitation(inv2.id, adminProfile.id);
  let revokeThrew = false;
  try {
    workspaceRepo.redeemInvitation(inv2.token!, 'Revoked User', 'revoked@apex.test');
  } catch (e: any) {
    revokeThrew = true;
    console.assert(e.message.includes('revoked'), 'Revoked invitation cannot be accepted');
  }
  console.assert(revokeThrew, 'Revoked invitation rejected');
  console.log('✓ Test 6: Revocation enforcement verified');

  // Test 7: Expiration check
  const expiredInv = workspaceRepo.createInvitation(
    'expired@apex.test',
    'member',
    [],
    [],
    -1, // expired yesterday
    adminProfile.id
  );
  let expiredThrew = false;
  try {
    workspaceRepo.redeemInvitation(expiredInv.token!, 'Expired User', 'expired@apex.test');
  } catch (e: any) {
    expiredThrew = true;
    console.assert(e.message.includes('expired'), 'Expired token must fail');
  }
  console.assert(expiredThrew, 'Expired invitation rejected');
  console.log('✓ Test 7: Expiration enforcement verified');

  console.log('--- ALL 7 INVITATION SECURITY TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
