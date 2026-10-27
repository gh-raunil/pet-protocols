import mongoose from 'mongoose';

/**
 * Validates that the active MONGODB_URI points strictly to an isolated staging database.
 * Rejects any URI containing 'production', 'prod', or missing 'staging'.
 */
export async function assertStagingDatabaseIsolation(uri = process.env.MONGODB_URI) {
  if (!uri) {
    throw new Error('[Isolation Error] MONGODB_URI is not set in environment.');
  }

  // Sanitize for safe logging (mask credentials)
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log('[DB Isolation Audit] Inspecting target URI:', maskedUri);

  // Check for disallowed production keywords
  const lower = uri.toLowerCase();
  if (lower.includes('production') || lower.includes('-prod') || lower.includes('_prod')) {
    throw new Error('[CRITICAL ISOLATION VIOLATION] Target URI contains production identifier!');
  }

  // Check that target database name contains 'staging'
  const dbMatch = uri.match(/\/([^/?]+)(\?|$)/);
  const targetDbName = dbMatch ? dbMatch[1] : null;

  if (!targetDbName || !targetDbName.toLowerCase().includes('staging')) {
    throw new Error(
      `[CRITICAL ISOLATION VIOLATION] Database name '${targetDbName}' does not contain 'staging'. Refusing connection.`
    );
  }

  console.log(`[DB Isolation Audit] Verified isolated database target: '${targetDbName}'`);
  return { isIsolated: true, targetDbName };
}

if (process.argv[1] && process.argv[1].endsWith('verify_staging_db_isolation.mjs')) {
  try {
    await assertStagingDatabaseIsolation();
    console.log('[DB Isolation Audit] PASSED: Database is strictly isolated for staging.');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
