import { createClient } from "@supabase/supabase-js";
import fs from "fs";

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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function promote() {
  const targetEmail = "ksg.pradi@gmail.com";
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error listing users:", error);
    return;
  }

  const user = users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
  if (!user) {
    console.error("User not found:", targetEmail);
    return;
  }

  console.log("Found user ID:", user.id);

  // 1. Update app_metadata in auth.users
  const { data: updatedAuthUser, error: authUpdateErr } = await supabase.auth.admin.updateUserById(
    user.id,
    {
      app_metadata: {
        ...user.app_metadata,
        role: "admin"
      }
    }
  );

  if (authUpdateErr) {
    console.error("Error updating auth user app_metadata:", authUpdateErr);
  } else {
    console.log("Successfully updated auth user app_metadata to role: admin");
  }

  // 2. Update public.profiles
  const { data: updatedProfile, error: profileErr } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id)
    .select()
    .single();

  if (profileErr) {
    console.error("Error updating public.profiles:", profileErr);
  } else {
    console.log("Successfully updated public.profiles to role: admin:", updatedProfile);
  }
}

promote().catch(console.error);
