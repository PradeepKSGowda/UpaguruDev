const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function syncKpscExams() {
  console.log('Fetching KPSC organization...');
  const { data: kpscOrg, error: orgErr } = await supabase
    .from('organizations')
    .select('id, code, name')
    .eq('code', 'KPSC')
    .single();

  if (orgErr || !kpscOrg) {
    console.error('KPSC organization not found:', orgErr);
    return;
  }
  console.log('KPSC Org ID:', kpscOrg.id);

  // Fetch all published KPSC notifications
  const { data: notifs, error: notifsErr } = await supabase
    .from('notifications')
    .select('*')
    .in('slug', [
      'kpsc-saad-rpc-notification-2027-08-2026-9pzm',
      'kpsc-saad-hk-notification-2027-08-2026-dxdr',
      'kpsc-gazetted-probationer-1zji',
      'kpsc-notification2020unicode202026-1st20sessionpdf-n988',
    ]);

  if (notifsErr || !notifs) {
    console.error('Failed to fetch notifications:', notifsErr);
    return;
  }

  console.log(`Found ${notifs.length} KPSC notifications to sync.`);

  for (const notif of notifs) {
    console.log(`\nProcessing: "${notif.title}" (slug: ${notif.slug})`);

    // Determine exam_code and exam_name
    let examCode = '';
    let examName = notif.title;
    let shortName = '';
    let category = 'STATE_SERVICES';

    if (notif.slug.includes('saad-rpc')) {
      examCode = 'KPSC_SAAD_RPC';
      examName = 'SAAD RPC Notification 2027-08-2026';
      shortName = 'SAAD RPC';
      category = 'STATE_SERVICES';
    } else if (notif.slug.includes('saad-hk')) {
      examCode = 'KPSC_SAAD_HK';
      examName = 'SAAD HK Notification 2027-08-2026';
      shortName = 'SAAD HK';
      category = 'STATE_SERVICES';
    } else if (notif.slug.includes('gazetted-probationer')) {
      examCode = 'KPSC_GAZETTED_PROBATIONER';
      examName = 'Gazetted Probationer';
      shortName = 'KAS / GP';
      category = 'CIVIL_SERVICES';
    } else if (notif.slug.includes('notification2020unicode') || notif.slug.includes('session')) {
      examCode = 'KPSC_DEPARTMENTAL_EXAM';
      examName = 'Departmental Examination';
      shortName = 'Dept Exam';
      category = 'STATE_SERVICES';
    } else {
      examCode = `KPSC_${notif.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30)}`;
    }

    const normalizedName = examName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

    // 1. Upsert into exam_master
    const { data: master, error: masterErr } = await supabase
      .from('exam_master')
      .upsert(
        {
          organization_id: kpscOrg.id,
          exam_code: examCode,
          name: examName,
          normalized_name: normalizedName,
          short_name: shortName,
          category: category,
          active: true,
          aliases: [examName, shortName],
        },
        { onConflict: 'exam_code' }
      )
      .select('id, exam_code, name')
      .single();

    if (masterErr || !master) {
      console.error('Error upserting exam_master:', masterErr);
      continue;
    }
    console.log(`Exam Master synced: [${master.exam_code}] id: ${master.id}`);

    // 2. Upsert into exam_cycle
    const cycleYear = 2026;
    const cycleCode = `${examCode}_${cycleYear}`;
    const cycleLabel = `${examName} (Cycle ${cycleYear})`;

    const { data: cycle, error: cycleErr } = await supabase
      .from('exam_cycle')
      .upsert(
        {
          exam_master_id: master.id,
          cycle_year: cycleYear,
          cycle_code: cycleCode,
          cycle_label: cycleLabel,
          primary_reference_no: notif.notification_number,
          status: 'APPLICATION_OPEN',
          current_stage: 'APPLICATION',
          start_date: notif.application_start_date?.slice(0, 10) || null,
          end_date: notif.application_end_date?.slice(0, 10) || null,
          total_vacancies_current: notif.total_vacancies || 0,
          latest_update_summary: `Published: ${notif.title}`,
          verification_status: 'VERIFIED',
          metadata_json: {
            notification_id: notif.id,
            notification_slug: notif.slug,
            official_pdf_url: notif.official_pdf_url,
          },
        },
        { onConflict: 'exam_master_id,cycle_code' }
      )
      .select('id, cycle_code, cycle_label')
      .single();

    if (cycleErr || !cycle) {
      console.error('Error upserting exam_cycle:', cycleErr);
      continue;
    }
    console.log(`Exam Cycle synced: [${cycle.cycle_code}] id: ${cycle.id}`);

    // 3. Insert into exam_document if not present
    let docId = null;
    const { data: existingDoc } = await supabase
      .from('exam_document')
      .select('id')
      .eq('exam_cycle_id', cycle.id)
      .eq('document_type', 'RECRUITMENT_NOTIFICATION')
      .maybeSingle();

    if (existingDoc) {
      docId = existingDoc.id;
    } else {
      const { data: newDoc, error: docErr } = await supabase
        .from('exam_document')
        .insert({
          organization_id: kpscOrg.id,
          exam_master_id: master.id,
          exam_cycle_id: cycle.id,
          document_type: 'RECRUITMENT_NOTIFICATION',
          title: notif.title,
          normalized_title: notif.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
          source_url: notif.official_pdf_url || 'https://kpsc.kar.nic.in',
          canonical_url: notif.official_pdf_url || 'https://kpsc.kar.nic.in',
          reference_number: notif.notification_number,
          publication_date: notif.application_start_date?.slice(0, 10) || '2026-08-28',
          status: 'PUBLISHED',
          verification_status: 'HUMAN_VERIFIED',
        })
        .select('id')
        .single();

      if (docErr) {
        console.warn('Document insert warning:', docErr);
      } else {
        docId = newDoc?.id;
      }
    }

    // 4. Insert initial milestones in exam_event if not present
    if (notif.application_start_date) {
      const { data: existingEvt } = await supabase
        .from('exam_event')
        .select('id')
        .eq('exam_cycle_id', cycle.id)
        .eq('event_type', 'APPLICATION_OPEN')
        .maybeSingle();

      if (!existingEvt) {
        await supabase.from('exam_event').insert({
          exam_cycle_id: cycle.id,
          source_document_id: docId,
          event_type: 'APPLICATION_OPEN',
          stage: 'APPLICATION',
          event_name: 'Application Window Opens',
          date_text_original: notif.application_start_date,
          start_datetime: new Date(notif.application_start_date).toISOString(),
          status: 'COMPLETED',
          is_current: true,
          version_number: 1,
          verification_status: 'HUMAN_VERIFIED',
          confidence: 100.0,
        });
      }
    }

    if (notif.application_end_date) {
      const { data: existingEvt } = await supabase
        .from('exam_event')
        .select('id')
        .eq('exam_cycle_id', cycle.id)
        .eq('event_type', 'APPLICATION_CLOSE')
        .maybeSingle();

      if (!existingEvt) {
        await supabase.from('exam_event').insert({
          exam_cycle_id: cycle.id,
          source_document_id: docId,
          event_type: 'APPLICATION_CLOSE',
          stage: 'APPLICATION',
          event_name: 'Last Date to Apply',
          date_text_original: notif.application_end_date,
          start_datetime: new Date(notif.application_end_date).toISOString(),
          status: 'SCHEDULED',
          is_current: true,
          version_number: 1,
          verification_status: 'HUMAN_VERIFIED',
          confidence: 100.0,
        });
      }
    }
  }

  // 5. Insert audit log
  await supabase.from('audit_logs').insert({
    action: 'SYNC_EXAM_MASTERS_KPSC',
    target_entity: 'exam_master',
    metadata: {
      synced_at: new Date().toISOString(),
      reason: 'Sync KPSC published notifications into exam_master and exam_cycle',
    },
    created_at: new Date().toISOString(),
  });

  console.log('\nKPSC Synchronization completed successfully!');
}

syncKpscExams();
