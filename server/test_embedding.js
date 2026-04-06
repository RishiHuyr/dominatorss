require('dotenv').config();
const aiService = require('./services/aiService');

async function runTest() {
  console.log('--- STARTING EMBEDDING TEST ---');

  // Test 1: Valid Text
  console.log('\nTest 1: Valid Text');
  const validVector = await aiService.generateEmbedding('This is a test issue about a login bug.');
  if (validVector && Array.isArray(validVector)) {
    console.log('✅ Test 1 Passed: Generated vector of length', validVector.length);
  } else {
    console.error('❌ Test 1 Failed: Vector not generated.');
  }

  // Test 2: Empty Text
  console.log('\nTest 2: Empty Text');
  const emptyVector = await aiService.generateEmbedding('');
  if (emptyVector === null) {
    console.log('✅ Test 2 Passed: Returned null for empty text.');
  } else {
    console.error('❌ Test 2 Failed: Did not return null for empty text.');
  }

  // Test 3: Large Text
  console.log('\nTest 3: Large Text (Truncation check)');
  const largeText = 'A'.repeat(10000);
  const largeVector = await aiService.generateEmbedding(largeText);
  if (largeVector && Array.isArray(largeVector)) {
    console.log('✅ Test 3 Passed: Generated vector for large text.');
  } else {
    console.error('❌ Test 3 Failed: Vector not generated for large text.');
  }

  console.log('\n--- TEST COMPLETE ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
