import { createClient } from '@supabase/supabase-js';

const PERSONA_ID = 'golden-user-001';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

const url = required('SUPABASE_URL');
const secretKey = required('SUPABASE_SECRET_KEY');
const email = required('GOLDEN_USER_EMAIL').toLowerCase();
const password = required('GOLDEN_USER_PASSWORD');

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
  throw new Error('SUPABASE_URL_invalid');
}
if (!secretKey.startsWith('sb_secret_')) {
  throw new Error('SUPABASE_SECRET_KEY_must_be_modern_secret_key');
}
if (!email.includes('@')) throw new Error('GOLDEN_USER_EMAIL_invalid');
if (password.length < 12) throw new Error('GOLDEN_USER_PASSWORD_too_short');

const supabase = createClient(url, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findByEmail() {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const found = data.users.find(
      (user) => user.email?.toLowerCase() === email,
    );
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

let user = await findByEmail();
let action = 'updated';

if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  if (!data.user) throw new Error('golden_user_create_returned_no_user');
  user = data.user;
  action = 'created';
}

const { data: updated, error: updateError } =
  await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: {
      ...(user.app_metadata ?? {}),
      synthetic: true,
      persona_id: PERSONA_ID,
      environment: 'development',
    },
  });
if (updateError) throw updateError;
if (!updated.user) throw new Error('golden_user_update_returned_no_user');

console.log(
  JSON.stringify({
    action,
    personaId: PERSONA_ID,
    userId: updated.user.id,
    email: updated.user.email,
    emailConfirmed: Boolean(updated.user.email_confirmed_at),
  }),
);
