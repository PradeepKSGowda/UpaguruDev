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
  const { data: orgs } = await supabase.from('organizations').select('*');
  console.log('Organizations:', JSON.stringify(orgs, null, 2));

  const { data: examMasters } = await supabase.from('exam_master').select('*');
  console.log('Exam Masters:', JSON.stringify(examMasters, null, 2));

  const { data: legacyExams } = await supabase.from('exams').select('id, slug, title, conducting_body, category');
  console.log('Legacy Exams:', JSON.stringify(legacyExams, null, 2));

  const { data: cycles } = await supabase.from('exam_cycle').select('*');
  console.log('Exam Cycles:', JSON.stringify(cycles, null, 2));
}

main();
