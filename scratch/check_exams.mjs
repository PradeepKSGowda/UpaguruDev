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

async function checkExams() {
  const { data: exams, error } = await supabase.from("exams").select("id, title, slug, conducting_body, category");
  if (error) console.error("Error fetching exams:", error);
  else console.log("Exams in database:", exams);
}

checkExams().catch(console.error);
