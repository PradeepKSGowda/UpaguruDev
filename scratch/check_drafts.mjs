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

const supabase = createClient(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]);

async function checkDrafts() {
  const { data: drafts, error } = await supabase.from("draft_notifications").select("id, source_url, status, extraction_confidence_score");
  if (error) console.error("Error fetching drafts:", error);
  else console.log("Drafts in database:", drafts);
}

checkDrafts().catch(console.error);
