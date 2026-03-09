import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const JURU_EDGE_URL = "https://dwpkokavxjvtrltntjtn.supabase.co/functions/v1/juru-chat";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messages, conversation_id, client_timezone } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    // Get session for auth token
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    // Call the Supabase Edge Function (Gemini + CRUD tools)
    const edgeResponse = await fetch(JURU_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
        user_id: user.id,
        client_timezone: client_timezone || "Asia/Makassar",
      }),
    });

    if (!edgeResponse.ok) {
      const errText = await edgeResponse.text().catch(() => "Unknown error");
      console.error("Juru Edge Function error:", edgeResponse.status, errText);
      return NextResponse.json({
        reply: "Maaf, saya sedang mengalami gangguan. Coba lagi sebentar.",
        data_updates: { refresh_needed: false, cards: [] },
      });
    }

    const data = await edgeResponse.json();

    // Try to persist messages (graceful fail if tables don't exist)
    try {
      if (conversation_id) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg) {
          await supabase.from("juru_messages").insert({
            conversation_id,
            role: lastUserMsg.role,
            content: lastUserMsg.content,
          });
        }
        if (data.reply) {
          await supabase.from("juru_messages").insert({
            conversation_id,
            role: "assistant",
            content: data.reply,
          });
          await supabase.from("juru_conversations").update({
            updated_at: new Date().toISOString(),
          }).eq("id", conversation_id);
        }
      }
    } catch (persistErr) {
      // Tables may not exist yet - that's OK
    }

    return NextResponse.json({
      reply: data.reply || "Hmm, saya tidak dapat memproses permintaan itu.",
      data_updates: data.data_updates || { refresh_needed: false, cards: [] },
    });
  } catch (error: any) {
    console.error("Juru API error:", error);
    return NextResponse.json({
      reply: "Terjadi kesalahan. Silakan coba lagi.",
      data_updates: { refresh_needed: false, cards: [] },
    });
  }
}
