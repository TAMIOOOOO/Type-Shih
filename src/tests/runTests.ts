import { runAllTests } from './testDefinitions.js';

async function main() {
  console.log('🧪 Starting Typing Speed Game Test Suite...\n');

  const results = await runAllTests();
  let passedCount = 0;
  let failedCount = 0;

  for (const res of results) {
    if (res.passed) {
      passedCount++;
      console.log(`  ✅ [${res.category}] ${res.name} (${res.durationMs}ms)`);
    } else {
      failedCount++;
      console.error(`  ❌ [${res.category}] ${res.name} (${res.durationMs}ms)`);
      console.error(`     Error: ${res.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log(`Summary: ${passedCount} passed, ${failedCount} failed of ${results.length} total tests.`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
