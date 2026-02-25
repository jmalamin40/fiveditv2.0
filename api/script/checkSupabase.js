require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { getSupabaseConfig, setupSupabaseForInstance, createSupabaseAuthUser } = require('../utils/supabaseSmm');

/**
 * Check if Supabase is configured and can create a project (dry run).
 * Optionally creates an auth user when SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD are set.
 * @param {string} projectName - Unique project name (e.g. 'fivedit-api' or 'smm-test-1')
 * @returns {Promise<boolean>}
 */
async function checkSupabaseProject(projectName) {
  const config = getSupabaseConfig();
  if (!config) {
    console.log('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_ORG_SLUG in api/.env');
    return false;
  }
  console.log('Supabase config OK (org:', config.orgSlug, 'region:', config.region, ')');
  const dbPass = require('crypto').randomBytes(12).toString('base64').replace(/[/+=]/g, 'a') + 'A1!';
  try {
    const supabase = await setupSupabaseForInstance(projectName, dbPass);
    const ok = !!(supabase && supabase.url);
    if (ok) {
      console.log('Project created, URL:', supabase.url);
      const testEmail = process.env.SUPABASE_TEST_EMAIL;
      const testPassword = process.env.SUPABASE_TEST_PASSWORD;
      if (supabase.serviceRoleKey && testEmail && testPassword) {
        const user = await createSupabaseAuthUser(supabase.url, supabase.serviceRoleKey, {
          email: testEmail,
          password: testPassword,
          email_confirm: true,
        });
        if (user) console.log('Auth user created:', user.email, '(id:', user.id, ')');
        else console.log('Auth user creation failed or skipped');
      }
    } else {
      console.log('Setup returned no URL');
    }
    return ok;
  } catch (err) {
    console.error('Setup failed:', err.response?.data || err.message);
    return false;
  }
}

checkSupabaseProject('fivedit-api').then((result) => {
  console.log('Result:', result);
});