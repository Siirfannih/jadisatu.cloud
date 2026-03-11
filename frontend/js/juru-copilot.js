/**
 * Juru AI Copilot - Dark Mode (Monk Mode)
 * Floating chat widget for content creation assistance
 * Mirrors the Light mode JuruCopilot but in vanilla JS with Dark mode styling
 */
(function () {
  'use strict';

  const supabase = window.supabaseClient;
  if (!supabase) return;

  let isOpen = false;
  let messages = [];
  let recentContent = [];

  // ── Quick Actions ──
  const QUICK_ACTIONS = [
    { icon: 'lightbulb', label: 'Ide Konten Baru', command: 'create content idea' },
    { icon: 'file-text', label: 'Generate Script', command: 'generate script' },
    { icon: 'search', label: 'Riset Topik', command: 'research topic' },
    { icon: 'check-square', label: 'Buat Task', command: 'create task' },
  ];

  // ── Script Templates (matches Light mode's narrative/generate mock) ──
  const SCRIPT_TEMPLATES = {
    youtube: (topic, angle) =>
      `[INTRO - Hook]\n"Most people are completely wrong about ${topic}. Here's what they're missing..."\n\n` +
      `[SECTION 1 - Context]\n"Let me break down what's actually happening with ${topic}..."\n` +
      `- Set the scene with current data\n- Reference 2-3 key statistics\n- Establish credibility\n\n` +
      `[SECTION 2 - Main Insight]\n"The real story behind ${angle}..."\n` +
      `- Present your unique perspective\n- Use examples and analogies\n- Show data that supports your view\n\n` +
      `[SECTION 3 - Practical Application]\n"Here's how you can use this..."\n` +
      `- Step-by-step breakdown\n- Real examples\n- Common mistakes to avoid\n\n` +
      `[OUTRO - CTA]\n"If this helped you understand ${topic}, hit subscribe."`,

    instagram: (topic, angle) =>
      `[SLIDE 1 - Hook]\n"${angle}" (bold text, eye-catching visual)\n\n` +
      `[SLIDE 2 - Problem]\nMost creators struggle with ${topic} because they focus on the wrong things.\n\n` +
      `[SLIDE 3 - Insight 1]\nKey finding: [Data point about ${topic}]\n\n` +
      `[SLIDE 4 - Insight 2]\nWhat the data actually shows...\n\n` +
      `[SLIDE 5 - Insight 3]\nThe pattern most people miss...\n\n` +
      `[SLIDE 6 - Action Step]\nHere's what to do next:\n1. [Step 1]\n2. [Step 2]\n3. [Step 3]\n\n` +
      `[SLIDE 7 - CTA]\nSave this for later. Follow for more on ${topic}.`,

    tiktok: (topic, angle) =>
      `[0-3s HOOK]\n"Stop scrolling if you care about ${topic}"\n\n` +
      `[3-15s PROBLEM]\n"Everyone is talking about this wrong..."\n\n` +
      `[15-40s MAIN CONTENT]\n"Here's what's actually happening with ${angle}..."\n` +
      `- Point 1 (with visual)\n- Point 2 (with visual)\n- Point 3 (with visual)\n\n` +
      `[40-55s VALUE]\n"The one thing you need to know..."\n\n` +
      `[55-60s CTA]\n"Follow for more. Link in bio."`,

    twitter: (topic, angle) =>
      `THREAD: ${angle}\n\n` +
      `1/ Let's talk about ${topic}. Here's what actually matters...\n\n` +
      `2/ First, the context: [Key background info]\n\n` +
      `3/ Most takes are surface-level. Here's what they're missing...\n\n` +
      `4/ The data tells a different story: [Specific data point]\n\n` +
      `5/ Why this matters for you: [Practical implication]\n\n` +
      `6/ Here's the move: [Actionable advice]\n\n` +
      `7/ TL;DR:\n- [Key point 1]\n- [Key point 2]\n- [Key point 3]`,

    linkedin: (topic, angle) =>
      `${angle}\n\n` +
      `I've been deep in the data on ${topic}, and here's what I found:\n\n` +
      `The conventional wisdom says one thing.\nThe data says another.\n\n` +
      `Here are 3 key insights:\n\n` +
      `1. [Insight with supporting evidence]\n\n` +
      `2. [Counter-intuitive finding]\n\n` +
      `3. [Actionable takeaway]\n\n` +
      `What's your take? Drop a comment below.`,
  };

  // ── Research Mock (matches Light mode's narrative/research mock) ──
  function generateMockResearch(topic) {
    return {
      research_summary: `Research summary for "${topic}":\n\n` +
        `Key findings from analysis of current trends and data:\n` +
        `1. Growing interest in ${topic} across social media platforms\n` +
        `2. Top creators are approaching this from unique angles\n` +
        `3. Audience engagement peaks when combining personal stories with data\n` +
        `4. The most viral content about ${topic} uses contrarian hooks`,
      content_angles: [
        { angle: `The Hidden Truth About ${topic}`, platform: 'youtube', format: 'Long-form video (8-12 min)', description: `Deep dive analysis revealing what most people miss about ${topic}` },
        { angle: `${topic}: What Nobody Tells You`, platform: 'twitter', format: 'Thread (8-10 tweets)', description: `Contrarian thread breaking down common misconceptions` },
        { angle: `I Tried ${topic} for 30 Days`, platform: 'instagram', format: 'Carousel (7-10 slides)', description: `Personal experiment documenting real results and lessons` },
        { angle: `Why ${topic} Changes Everything`, platform: 'tiktok', format: 'Short-form video (30-60s)', description: `Quick-hit hook with surprising data points` },
      ],
      topic,
      researched_at: new Date().toISOString(),
    };
  }

  // ── Command Processing ──
  async function processCommand(input) {
    const lower = input.toLowerCase().trim();

    // Create content idea
    if (lower.includes('create content') || lower.includes('ide konten') || lower.includes('new idea')) {
      const title = input.replace(/create content idea|ide konten baru|new idea/gi, '').trim() || 'Untitled Content';
      try {
        const user = await getUser();
        if (!user) return { text: '⚠️ Kamu belum login. Silakan login dulu.' };
        const { error } = await supabase.from('contents').insert({
          title, user_id: user.id, status: 'idea', platform: 'instagram',
        });
        if (error) throw error;
        return { text: `✅ Ide konten "${title}" berhasil dibuat!\n\nBuka Creative Hub untuk melanjutkan.`, action: 'content_created' };
      } catch (e) {
        return { text: `❌ Gagal membuat ide: ${e.message}` };
      }
    }

    // Generate script
    if (lower.includes('generate script') || lower.includes('buat script') || lower.includes('buat skrip')) {
      const topic = input.replace(/generate script|buat script|buat skrip/gi, '').trim();
      if (!topic && recentContent.length > 0) {
        const latest = recentContent[0];
        const script = (SCRIPT_TEMPLATES.instagram)(latest.title, `Deep Dive: ${latest.title}`);
        return { text: `📝 Script untuk "${latest.title}":\n\n${script}`, action: 'script_generated' };
      }
      if (!topic) return { text: '💡 Tulis topik setelah perintah.\nContoh: "generate script personal branding"' };
      const script = (SCRIPT_TEMPLATES.instagram)(topic, `Deep Dive: ${topic}`);
      return { text: `📝 Script untuk "${topic}":\n\n${script}`, action: 'script_generated' };
    }

    // Research
    if (lower.includes('research') || lower.includes('riset')) {
      const topic = input.replace(/research topic|research|riset topik|riset/gi, '').trim();
      if (!topic) return { text: '💡 Tulis topik setelah perintah.\nContoh: "research personal branding"' };
      const research = generateMockResearch(topic);
      let anglesText = research.content_angles.map((a, i) =>
        `${i + 1}. 🎯 ${a.angle}\n   Platform: ${a.platform} | Format: ${a.format}\n   ${a.description}`
      ).join('\n\n');
      return {
        text: `🔍 Hasil riset "${topic}":\n\n${research.research_summary}\n\n📐 Content Angles:\n\n${anglesText}`,
        action: 'research_done',
      };
    }

    // Create task
    if (lower.includes('create task') || lower.includes('buat task') || lower.includes('tambah task')) {
      const title = input.replace(/create task|buat task|tambah task/gi, '').trim() || 'New Task';
      try {
        const user = await getUser();
        if (!user) return { text: '⚠️ Kamu belum login.' };
        const { error } = await supabase.from('tasks').insert({
          title, user_id: user.id, status: 'todo', priority: 'medium', domain: 'work',
        });
        if (error) throw error;
        return { text: `✅ Task "${title}" berhasil dibuat!`, action: 'task_created' };
      } catch (e) {
        return { text: `❌ Gagal membuat task: ${e.message}` };
      }
    }

    // Help / default
    return {
      text: `🤖 Hai! Aku Juru, asisten AI-mu.\n\nBerikut yang bisa aku bantu:\n` +
        `• "ide konten [judul]" — Buat ide konten baru\n` +
        `• "generate script [topik]" — Generate script konten\n` +
        `• "research [topik]" — Riset topik konten\n` +
        `• "buat task [judul]" — Buat task baru\n\n` +
        `Ketik perintah di atas atau gunakan quick actions di bawah! 👇`,
    };
  }

  async function getUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch { return null; }
  }

  async function loadRecentContent() {
    try {
      const user = await getUser();
      if (!user) return;
      const { data } = await supabase.from('contents')
        .select('id,title,status,platform')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) recentContent = data;
    } catch { /* silent */ }
  }

  // ── UI Rendering ──
  function createCopilotUI() {
    // Floating button
    const btn = document.createElement('button');
    btn.id = 'juru-fab';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="m2 14 6-6 6 6"/><path d="M9 17c0 .6.4 1 1 1h4c.6 0 1-.4 1-1"/></svg>`;
    btn.className = 'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-2xl shadow-violet-500/30 flex items-center justify-center hover:scale-110 transition-all duration-200 cursor-pointer';
    btn.title = 'Juru AI Copilot';
    btn.onclick = toggleCopilot;

    // Chat panel
    const panel = document.createElement('div');
    panel.id = 'juru-panel';
    panel.className = 'fixed bottom-24 right-6 z-50 w-96 max-h-[32rem] bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden transition-all duration-300 opacity-0 scale-95 pointer-events-none';
    panel.innerHTML = `
      <div class="flex items-center justify-between p-4 border-b border-white/10">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="m2 14 6-6 6 6"/></svg>
          </div>
          <div>
            <p class="text-sm font-bold text-white">Juru</p>
            <p class="text-[10px] text-gray-500">AI Copilot</p>
          </div>
        </div>
        <button onclick="document.getElementById('juru-fab').click()" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div id="juru-messages" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px]"></div>
      <div id="juru-quick-actions" class="px-4 pb-2 flex flex-wrap gap-1.5"></div>
      <div class="p-3 border-t border-white/10">
        <div class="flex gap-2">
          <input id="juru-input" type="text" placeholder="Ketik perintah atau tanya Juru..."
            class="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30" />
          <button id="juru-send" class="px-3 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    // Render quick actions
    const qaContainer = document.getElementById('juru-quick-actions');
    QUICK_ACTIONS.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] text-gray-400 hover:text-white transition-all flex items-center gap-1.5';
      btn.innerHTML = `<i data-lucide="${action.icon}" class="w-3 h-3"></i>${action.label}`;
      btn.onclick = () => handleSend(action.command);
      qaContainer.appendChild(btn);
    });

    // Enter to send
    document.getElementById('juru-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });
    document.getElementById('juru-send').addEventListener('click', () => handleSend());

    // Add initial greeting
    addMessage('assistant', '🤖 Hai! Aku Juru, asisten AI-mu.\nKetik perintah atau pilih quick action di bawah.');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  function toggleCopilot() {
    isOpen = !isOpen;
    const panel = document.getElementById('juru-panel');
    const fab = document.getElementById('juru-fab');
    if (isOpen) {
      panel.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
      panel.classList.add('opacity-100', 'scale-100');
      fab.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
      loadRecentContent();
      setTimeout(() => document.getElementById('juru-input')?.focus(), 200);
    } else {
      panel.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
      panel.classList.remove('opacity-100', 'scale-100');
      fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="m2 14 6-6 6 6"/><path d="M9 17c0 .6.4 1 1 1h4c.6 0 1-.4 1-1"/></svg>`;
    }
  }

  function addMessage(role, text) {
    messages.push({ role, text });
    renderMessages();
  }

  function renderMessages() {
    const container = document.getElementById('juru-messages');
    if (!container) return;
    container.innerHTML = messages.map(m => {
      if (m.role === 'user') {
        return `<div class="flex justify-end"><div class="max-w-[85%] bg-violet-600/20 border border-violet-500/20 text-violet-200 text-sm px-3 py-2 rounded-xl rounded-br-sm whitespace-pre-wrap">${escapeHtml(m.text)}</div></div>`;
      }
      return `<div class="flex justify-start"><div class="max-w-[85%] bg-white/5 border border-white/10 text-gray-300 text-sm px-3 py-2 rounded-xl rounded-bl-sm whitespace-pre-wrap">${escapeHtml(m.text)}</div></div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  async function handleSend(overrideText) {
    const input = document.getElementById('juru-input');
    const text = overrideText || input.value.trim();
    if (!text) return;
    input.value = '';

    addMessage('user', text);

    // Show loading
    const loadingId = Date.now();
    const container = document.getElementById('juru-messages');
    const loadingEl = document.createElement('div');
    loadingEl.id = 'loading-' + loadingId;
    loadingEl.className = 'flex justify-start';
    loadingEl.innerHTML = `<div class="bg-white/5 border border-white/10 text-gray-500 text-sm px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-2"><span class="animate-pulse">⏳</span> Juru sedang berpikir...</div>`;
    container.appendChild(loadingEl);
    container.scrollTop = container.scrollHeight;

    const response = await processCommand(text);

    // Remove loading
    document.getElementById('loading-' + loadingId)?.remove();
    addMessage('assistant', response.text);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>');
  }

  // ── Initialize ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createCopilotUI);
  } else {
    createCopilotUI();
  }
})();
