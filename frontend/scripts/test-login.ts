/**
 * Test Login Functionality
 * Tests login with both SHA-256 and bcrypt password hashes
 */

import { hashPassword, verifyPassword } from '../lib/auth';

async function testPasswordHashing() {
  console.log('🧪 Testing Password Hashing and Verification...\n');

  const testPassword = 'testpassword123';

  // Test 1: SHA-256 hash (old format)
  console.log('Test 1: SHA-256 Hash (Backward Compatibility)');
  const crypto = await import('crypto');
  const sha256Hash = crypto.createHash('sha256').update(testPassword).digest('hex');
  console.log(`  SHA-256 Hash: ${sha256Hash.substring(0, 20)}...`);
  
  const sha256Result = await verifyPassword(testPassword, sha256Hash);
  console.log(`  ✅ SHA-256 Verification: ${sha256Result ? 'PASS' : 'FAIL'}\n`);

  // Test 2: bcrypt hash (new format)
  console.log('Test 2: bcrypt Hash (New Format)');
  const bcryptHash = await hashPassword(testPassword);
  console.log(`  bcrypt Hash: ${bcryptHash.substring(0, 20)}...`);
  
  const bcryptResult = await verifyPassword(testPassword, bcryptHash);
  console.log(`  ✅ bcrypt Verification: ${bcryptResult ? 'PASS' : 'FAIL'}\n`);

  // Test 3: Wrong password
  console.log('Test 3: Wrong Password');
  const wrongPasswordResult = await verifyPassword('wrongpassword', bcryptHash);
  console.log(`  ✅ Wrong Password Rejected: ${wrongPasswordResult ? 'FAIL' : 'PASS'}\n`);

  // Test 4: Hash format detection
  console.log('Test 4: Hash Format Detection');
  const isBcrypt = bcryptHash.startsWith('$2a$') || bcryptHash.startsWith('$2b$') || bcryptHash.startsWith('$2y$');
  const isSha256 = /^[a-f0-9]{64}$/i.test(sha256Hash);
  console.log(`  bcrypt detected: ${isBcrypt ? '✅' : '❌'}`);
  console.log(`  SHA-256 detected: ${isSha256 ? '✅' : '❌'}\n`);

  // Summary
  console.log('📊 Test Summary:');
  console.log(`  SHA-256 backward compatibility: ${sha256Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  bcrypt new format: ${bcryptResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Wrong password rejection: ${!wrongPasswordResult ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = sha256Result && bcryptResult && !wrongPasswordResult;
  console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'}`);
  
  return allPassed;
}

// Run tests
testPasswordHashing()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Test error:', error);
    process.exit(1);
  });
