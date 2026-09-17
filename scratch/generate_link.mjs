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

async function checkLink() {
  const targetEmail = "ksg.pradi@gmail.com";
  
  // Generate a recovery link (password reset)
  const { data: recoveryData, error: recoveryErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: targetEmail,
    options: {
      redirectTo: "http://localhost:3000/admin"
    }
  });

  if (recoveryErr) {
    console.error("Recovery link error:", recoveryErr);
  } else {
    console.log("Recovery Link generated:", recoveryData.properties?.action_link);
  }

  // Generate a magic link
  const { data: magicData, error: magicErr } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: targetEmail,
    options: {
      redirectTo: "http://localhost:3000/admin"
    }
  });

  if (magicErr) {
    console.error("Magic link error:", magicErr);
  } else {
    console.log("Magic Link generated:", magicData.properties?.action_link);
  }
}

checkLink().catch(console.error);
