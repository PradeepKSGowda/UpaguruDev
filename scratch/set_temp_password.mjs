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

async function setPassword() {
  const targetEmail = "ksg.pradi@gmail.com";
  const { data: { users } } = await supabase.auth.admin.listUsers();
  const user = users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());

  if (!user) {
    console.error("User not found");
    return;
  }

  const tempPassword = "UpaguruAdmin@2026!";
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: tempPassword,
    email_confirm: true,
    app_metadata: {
      ...user.app_metadata,
      role: "admin"
    }
  });

  if (error) {
    console.error("Error setting password:", error);
  } else {
    console.log(`Successfully configured password and admin role for ${targetEmail}`);
    console.log(`Temporary Password: ${tempPassword}`);
  }
}

setPassword().catch(console.error);
