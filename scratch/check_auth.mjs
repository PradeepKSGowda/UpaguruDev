import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Read .env.local manually
const envConfig = fs.readFileSync(".env.local", "utf8");
const env = {};
envConfig.split("\n").forEach(line => {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) {
    env[key.trim()] = rest.join("=").trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkUser() {
  console.log("Checking user in Supabase Auth...");
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Error listing users:", error);
    return;
  }

  console.log(`Total users found: ${users.length}`);
  const targetEmail = "ksg.pradi@gmail.com".toLowerCase();
  const matched = users.filter(u => u.email?.toLowerCase() === targetEmail);

  if (matched.length === 0) {
    console.log(`\nUser "${targetEmail}" NOT FOUND in auth.users.`);
    console.log("Existing users in auth:");
    users.forEach(u => {
      console.log(`- ID: ${u.id}, Email: ${u.email}, Provider: ${u.app_metadata?.provider}, Confirmed: ${u.email_confirmed_at}`);
    });
  } else {
    for (const u of matched) {
      console.log(`\nUser "${targetEmail}" FOUND:`);
      console.log(`- ID: ${u.id}`);
      console.log(`- Email Confirmed At: ${u.email_confirmed_at || "NOT CONFIRMED"}`);
      console.log(`- Providers: ${JSON.stringify(u.app_metadata?.providers || u.app_metadata?.provider)}`);
      console.log(`- Last Sign In: ${u.last_sign_in_at}`);
      console.log(`- App Metadata:`, u.app_metadata);
      console.log(`- User Metadata:`, u.user_metadata);

      // Check profile in public.profiles
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();

      if (profileErr) {
        console.error("Error checking profiles table:", profileErr);
      } else if (!profile) {
        console.log(`- Profile record in public.profiles: NOT FOUND!`);
      } else {
        console.log(`- Profile Record:`, profile);
      }
    }
  }
}

checkUser().catch(console.error);
