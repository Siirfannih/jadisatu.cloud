import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://dwpkokavxjvtrltntjtn.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "sb_secret_eGoO9OanI0Pd7DTk7_sd6g_KwKwFzf2";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyBMKh4mN18bZQ7nh5B-JJ9cwRIeOiLkjuo";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const genai = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genai.getGenerativeModel({ model: "gemini-embedding-001" });

function composeText(c) {
  return [c.title, c.hook_text, c.value_text, c.cta_text, c.script, c.caption]
    .filter(Boolean)
    .join("\n\n");
}

async function main() {
  console.log("Fetching contents without embeddings...");
  const { data: contents, error } = await supabase
    .from("contents")
    .select("id, title, script, caption, hook_text, value_text, cta_text, platform")
    .is("embedded_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  console.log(`Found ${contents.length} contents to embed`);

  let embedded = 0;
  for (const c of contents) {
    const text = composeText(c);
    if (text.trim().length === 0) {
      console.log(`  Skip ${c.id} (empty)`);
      continue;
    }
    try {
      const result = await model.embedContent(text);
      const embedding = result.embedding.values.slice(0, 768);
      const { error: updateErr } = await supabase
        .from("contents")
        .update({
          embedding: JSON.stringify(embedding),
          embedded_at: new Date().toISOString(),
        })
        .eq("id", c.id);

      if (updateErr) {
        console.error(`  Error ${c.id}:`, updateErr.message);
      } else {
        embedded++;
        console.log(`  OK ${c.id} - "${(c.title || "").slice(0, 40)}" (${embedding.length}d)`);
      }
    } catch (e) {
      console.error(`  Embed error ${c.id}:`, e.message);
    }
    // Rate limit
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log(`\nDone. Embedded ${embedded}/${contents.length} contents`);
}

main();
