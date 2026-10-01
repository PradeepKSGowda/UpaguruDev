const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const notifId = '729be90e-7b19-4a37-acba-55860aded418';
  
  // 1. Update notification record
  const { data: updated, error: notifErr } = await supabase
    .from('notifications')
    .update({
      application_end_date: '2026-09-28',
      updated_at: new Date().toISOString()
    })
    .eq('id', notifId)
    .select('id, slug, title, application_start_date, application_end_date')
    .single();

  if (notifErr) {
    console.error('Error updating notification:', notifErr);
    return;
  }
  console.log('Updated notification:', updated);

  // 2. Insert audit log entry
  const { error: auditErr } = await supabase
    .from('audit_logs')
    .insert({
      admin_id: '934f69d9-f3f0-4911-a8fe-d7822414efc5',
      action: 'NOTIFICATION_UPDATED',
      target_entity: 'notifications',
      target_id: notifId,
      metadata: {
        change: 'Corrected application_end_date from 2026-09-07 to 2026-09-28',
        notification_id: notifId,
        slug: updated.slug,
        title: updated.title,
      }
    });

  if (auditErr) {
    console.warn('Audit log warning:', auditErr);
  } else {
    console.log('Audit log successfully recorded.');
  }
}

main();
