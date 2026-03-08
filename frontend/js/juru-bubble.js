/**
 * Juru (Jadisatu Asisten) — Bubble chat AI
 * Sumber: (1) Backend Juru (Gemini + CRUD agent-api) — default. (2) Kimi Free API dari Pengaturan — opsional.
 */
(function () {
    var JURU_BACKEND_URL = 'https://dwpkokavxjvtrltntjtn.supabase.co/functions/v1/juru-chat';
    var JURU_USE_MOCK_API = false; // Backend sudah dideploy: gunakan endpoint asli
    var JURU_CLIENT_TIMEZONE = (Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Asia/Makassar';
    var SUPABASE_ANON_KEY = 'sb_publishable_T5-XcRCVYuXvukpmPSO2cw_JBcOBwD1';
    var currentConvId = null;
    var settingsCache = null;
    var juruService = null;
    var userSettingsService = null;

    function getAssistantName() {
        return (settingsCache && settingsCache.juru_display_name) ? settingsCache.juru_display_name : 'Juru';
    }

    function createBubbleDOM() {
        if (document.getElementById('juru-bubble-root')) return;
        var root = document.createElement('div');
        root.id = 'juru-bubble-root';
        root.innerHTML =
            '<div id="juru-panel" class="hidden fixed bottom-20 right-6 w-[380px] max-h-[500px] flex flex-col rounded-2xl border border-white/10 bg-[#18181b] shadow-2xl z-[100] overflow-hidden">' +
            '  <div class="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/30">' +
            '    <span class="font-semibold text-white flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span><span id="juru-panel-title">Juru</span></span>' +
            '    <button type="button" id="juru-panel-close" class="p-1.5 rounded-lg hover:bg-white/10 text-gray-400"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>' +
            '  </div>' +
            '  <div id="juru-messages" class="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[340px] text-sm"></div>' +
            '  <div class="p-3 border-t border-white/10 bg-black/20">' +
            '    <div class="flex gap-2">' +
            '      <textarea id="juru-input" rows="2" placeholder="Tulis pesan ke Juru..." class="flex-1 resize-none rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-white placeholder-gray-500 outline-none focus:border-purple-500/50 text-sm"></textarea>' +
            '      <button type="button" id="juru-send" class="self-end px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium shrink-0">Kirim</button>' +
            '    </div>' +
            '  </div>' +
            '</div>' +
            '<button type="button" id="juru-toggle" class="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg flex items-center justify-center z-[99] transition-transform hover:scale-105">' +
            '  <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>' +
            '</button>';
        document.body.appendChild(root);
    }

    function showPanel(open) {
        var panel = document.getElementById('juru-panel');
        if (!panel) return;
        if (open) panel.classList.remove('hidden'); else panel.classList.add('hidden');
    }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderMarkdownBasic(text) {
        if (!text) return '';
        var escaped = escapeHtml(text);
        // Bold **text**
        escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Inline code `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black\\/40 border border-white\\/5 text-xs">$1</code>');

        var lines = escaped.split(/\r?\n/);
        var html = '';
        var inList = false;

        function closeList() {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (/^\s*[-*]\s+/.test(line)) {
                if (!inList) {
                    html += '<ul class="list-disc list-inside space-y-1 mt-1 mb-1">';
                    inList = true;
                }
                var item = line.replace(/^\s*[-*]\s+/, '');
                html += '<li>' + item + '</li>';
            } else if (line.trim() === '') {
                closeList();
                html += '<br/>';
            } else {
                closeList();
                html += '<p class="mb-1">' + line + '</p>';
            }
        }

        closeList();
        return html;
    }

    function appendMessage(role, content, isTemp) {
        var container = document.getElementById('juru-messages');
        if (!container) return;
        var div = document.createElement('div');
        div.className = 'flex ' + (role === 'user' ? 'justify-end' : 'justify-start');
        var bubble = document.createElement('div');
        bubble.className = 'max-w-[85%] px-3 py-2 rounded-xl text-sm ' + (role === 'user' ? 'bg-purple-600 text-white' : 'bg-white/10 text-gray-200');
        if (role === 'assistant' && !isTemp) {
            bubble.innerHTML = renderMarkdownBasic(content);
        } else {
            bubble.textContent = content;
            bubble.style.whiteSpace = 'pre-wrap';
        }
        div.appendChild(bubble);
        if (isTemp) div.setAttribute('data-temp', '1');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    function removeTempMessage() {
        var el = document.querySelector('#juru-messages [data-temp="1"]');
        if (el) el.remove();
    }

    function setLoading(loading) {
        var btn = document.getElementById('juru-send');
        if (btn) btn.disabled = loading;
    }

    /** Pastikan kita punya user & client; kalau currentUser belum diset dashboard, ambil dari session Supabase */
    function ensureAuth() {
        return new Promise(function (resolve, reject) {
            if (window.currentUser && window.supabaseClient) {
                resolve({ user: window.currentUser, supabase: window.supabaseClient });
                return;
            }
            if (!window.supabaseClient || !window.supabaseClient.auth) {
                reject(new Error('Supabase belum siap'));
                return;
            }
            window.supabaseClient.auth.getSession().then(function (r) {
                var session = r.data && r.data.session;
                var user = session && session.user;
                if (user) {
                    window.currentUser = user;
                    resolve({ user: user, supabase: window.supabaseClient });
                } else {
                    reject(new Error('Belum login'));
                }
            }).catch(function (e) {
                reject(e);
            });
        });
    }

    /** Panggil Kimi Free API (kimi-free-api). Format respons sama seperti OpenAI. */
    function callKimiFreeApi(messages, baseUrl, refreshToken) {
        var url = (baseUrl || '').replace(/\/$/, '') + '/v1/chat/completions';
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + refreshToken
            },
            body: JSON.stringify({
                model: 'kimi',
                messages: messages,
                use_search: false,
                stream: false
            })
        }).then(function (res) {
            if (!res.ok) return res.json().then(function (e) { throw new Error(e.error && e.error.message ? e.error.message : res.statusText); }).catch(function () { throw new Error(res.statusText); });
            return res.json();
        });
    }

    /** Panggil backend Juru (Gemini + tools) sesuai kontrak API. Wajib kirim session JWT agar agent-api tahu user. */
    function callJuruBackend(messages) {
        if (JURU_USE_MOCK_API) {
            return callJuruBackendMock(messages);
        }
        return ensureAuth().then(function (auth) {
            var user = auth.user;
            return auth.supabase.auth.getSession();
        }).then(function (r) {
            var session = r.data && r.data.session;
            var accessToken = session && session.access_token;
            if (!accessToken) return Promise.reject(new Error('Session tidak ada'));
            var payload = {
                messages: (messages || []).map(function (m) {
                    return { role: m.role, content: m.content };
                }),
                user_id: (session && session.user && session.user.id) ? session.user.id : (window.currentUser && window.currentUser.id) || null,
                client_timezone: JURU_CLIENT_TIMEZONE
            };
            return fetch(JURU_BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + accessToken
                },
                body: JSON.stringify(payload)
            });
        }).then(function (res) {
            if (!res.ok) {
                return res.json()
                    .then(function (e) {
                        var msg = typeof e.error === 'string' ? e.error : (e.error && e.error.message) ? e.error.message : res.statusText;
                        if (e.error && typeof e.error === 'object' && e.error.message) msg = e.error.message;
                        throw new Error(res.status + ': ' + msg);
                    })
                    .catch(function () { throw new Error(res.status + ': ' + res.statusText); });
            }
            return res.json();
        });
    }

    /** Prioritas: (1) Backend Juru (Gemini + CRUD) sebagai default. (2) Kimi Free API hanya jika user mengaktifkan di Pengaturan. */
    function callKimi(messages) {
        var s = settingsCache;
        if (s && s.juru_use_free_api && s.juru_free_api_base_url && s.juru_refresh_token_encrypted) {
            return callKimiFreeApi(messages, s.juru_free_api_base_url, s.juru_refresh_token_encrypted);
        }
        return callJuruBackend(messages);
    }

    function openPanel() {
        ensureAuth()
            .then(function () {
                showPanel(true);
                var title = document.getElementById('juru-panel-title');
                if (title) title.textContent = getAssistantName();
                loadSettingsAndConversation();
            })
            .catch(function () {
                var t = typeof showToast === 'function' ? showToast : (typeof window.toast === 'function' ? window.toast : null);
                if (t) t('Silakan login untuk pakai Juru.'); else alert('Silakan login untuk pakai Juru.');
            });
    }

    function loadSettingsAndConversation() {
        if (!window.currentUser || !window.supabaseClient) return;
        if (!userSettingsService) userSettingsService = new UserSettingsService(window.supabaseClient);
        if (!juruService) juruService = new JuruService(window.supabaseClient);
        var container = document.getElementById('juru-messages');
        var userId = window.currentUser.id;
        userSettingsService.getSettings(userId).then(function (s) {
            settingsCache = s;
            var titleEl = document.getElementById('juru-panel-title');
            if (titleEl) titleEl.textContent = getAssistantName();
            return juruService.getConversations(userId);
        }).then(function (convs) {
            if (convs.length) {
                currentConvId = convs[0].id;
                return juruService.getMessages(currentConvId).then(function (msgs) {
                    container.innerHTML = '';
                    msgs.forEach(function (m) {
                        if (m.role !== 'system') appendMessage(m.role, m.content, false);
                    });
                    container.scrollTop = container.scrollHeight;
                });
            } else {
                return juruService.createConversation(userId, 'Percakapan baru').then(function (c) {
                    currentConvId = c.id;
                    container.innerHTML = '<p class="text-gray-500 text-sm">Halo! Saya ' + getAssistantName() + '. Tanya apa saja atau minta bantuan mengatur task, notes, atau konten.</p>';
                });
            }
        }).catch(function (err) {
            console.warn('Juru load settings/conv:', err);
            container.innerHTML = '<p class="text-gray-500 text-sm">Halo! Saya ' + getAssistantName() + '. Tanya apa saja. (Riwayat percakapan butuh migration SQL di Supabase.)</p>';
        });
    }

    function sendMessage() {
        var input = document.getElementById('juru-input');
        if (!input) return;
        var text = (input.value || '').trim();
        if (!text) return;
        ensureAuth()
            .then(function (auth) {
                var supabase = auth.supabase;
                var userId = auth.user.id;
                if (!juruService) juruService = new JuruService(supabase);
                if (!userSettingsService) userSettingsService = new UserSettingsService(supabase);
                input.value = '';
                appendMessage('user', text, false);
                setLoading(true);
                if (!currentConvId) {
                    juruService.createConversation(userId, text.substring(0, 50)).then(function (c) {
                        currentConvId = c.id;
                        juruService.addMessage(currentConvId, 'user', text).then(function () {
                            requestKimiReply(text);
                        }).catch(function () {
                            requestKimiReplyWithoutHistory(text);
                            var t = typeof showToast === 'function' ? showToast : (typeof window.toast === 'function' ? window.toast : null);
                            if (t) t('Riwayat tidak tersimpan. Jalankan migration SQL di Supabase.');
                        });
                    }).catch(function () {
                        requestKimiReplyWithoutHistory(text);
                        var t = typeof showToast === 'function' ? showToast : (typeof window.toast === 'function' ? window.toast : null);
                        if (t) t('Riwayat tidak tersimpan. Jalankan migration SQL di Supabase.');
                    });
                } else {
                    juruService.addMessage(currentConvId, 'user', text).then(function () {
                        requestKimiReply(text);
                    }).catch(function () {
                        requestKimiReplyWithoutHistory(text);
                        var t = typeof showToast === 'function' ? showToast : (typeof window.toast === 'function' ? window.toast : null);
                        if (t) t('Pesan ini tidak tersimpan. Jalankan migration SQL di Supabase.');
                    });
                }
            })
            .catch(function () {
                var t = typeof showToast === 'function' ? showToast : (typeof window.toast === 'function' ? window.toast : null);
                if (t) t('Silakan login dulu.'); else alert('Silakan login dulu.');
            });
    }

    function getSystemPrompt() {
        return 'Kamu adalah ' + getAssistantName() + ', asisten pribadi di platform JadiSatu. Kamu membantu user mengatur task, project, catatan, konten kreatif, dan agent. Jawablah dengan ramah dan singkat. '
            + 'Jika user minta buat task atau project dan sistem sudah membuatnya, konfirmasi singkat dan sarankan cek Dashboard atau halaman Projects. '
            + 'Jika user hanya konfirmasi (misalnya "setuju buatkan" atau "prioritas normal") tanpa menyebut nama project/task lagi, sarankan mereka mengetik kalimat lengkap agar sistem bisa eksekusi, contoh: "buat project Jadisatu test" atau "buat task Manifesto deadline besok".';
    }

    /** Refresh dashboard/workspace agar daftar task, project, notes terbaru tampil setelah Juru melakukan CRUD di backend. */
    function refreshWorkspace() {
        if (typeof window.loadOverviewData === 'function') window.loadOverviewData();
        if (typeof window.loadTasks === 'function') window.loadTasks();
        if (typeof window.loadProjects === 'function') window.loadProjects();
        if (typeof window.loadNotes === 'function') window.loadNotes();
    }

    // --------- Rich response helper (Smart Card) ----------

    function appendSmartCardsFromUpdates(dataUpdates) {
        if (!dataUpdates || !dataUpdates.cards || !dataUpdates.cards.length) return;
        var container = document.getElementById('juru-messages');
        if (!container) return;
        dataUpdates.cards.forEach(function (card) {
            var wrapper = document.createElement('div');
            wrapper.className = 'flex justify-start mt-1';
            var cardEl = document.createElement('div');
            cardEl.className = 'max-w-[90%] w-full rounded-xl border border-purple-500/30 bg-purple-950/40 text-sm text-purple-50 p-3 shadow-lg';

            var title = document.createElement('div');
            title.className = 'font-semibold mb-1 flex items-center gap-1';
            title.textContent = card.title || 'Ringkasan data';
            cardEl.appendChild(title);

            if (card.subtitle) {
                var sub = document.createElement('div');
                sub.className = 'text-xs text-purple-200/80 mb-1';
                sub.textContent = card.subtitle;
                cardEl.appendChild(sub);
            }

            if (Array.isArray(card.items) && card.items.length) {
                var list = document.createElement('ul');
                list.className = 'mt-1 space-y-1';
                card.items.forEach(function (item) {
                    var li = document.createElement('li');
                    li.className = 'flex justify-between gap-2 text-xs bg-black/20 rounded-lg px-2 py-1';
                    var left = document.createElement('span');
                    left.className = 'font-medium';
                    left.textContent = item.title || item.name || '-';
                    var right = document.createElement('span');
                    right.className = 'text-[10px] text-purple-200/70';
                    right.textContent = item.meta || item.status || '';
                    li.appendChild(left);
                    li.appendChild(right);
                    list.appendChild(li);
                });
                cardEl.appendChild(list);
            }

            wrapper.appendChild(cardEl);
            container.appendChild(wrapper);
        });
        container.scrollTop = container.scrollHeight;
    }

    /** Panggil Kimi dengan satu pesan user (tanpa riwayat DB). Dipakai saat DB belum siap / gagal simpan. */
    function requestKimiReplyWithoutHistory(userText) {
        var systemPrompt = getSystemPrompt();
        var apiMessages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
        ];
        appendMessage('assistant', '...', true);
        callKimi(apiMessages)
            .then(function (data) {
                removeTempMessage();
                handleJuruApiResponse(data);
            })
            .catch(function (err) {
                removeTempMessage();
                var msg = (err && err.message) ? err.message : 'Gagal memanggil AI. Cek koneksi.';
                appendMessage('assistant', msg, false);
            })
            .finally(function () { removeTempMessage(); setLoading(false); });
    }

    function requestKimiReply(lastUserText) {
        juruService.getMessages(currentConvId).then(function (msgs) {
            var apiMessages = msgs.filter(function (m) { return m.role !== 'system'; }).map(function (m) {
                return { role: m.role === 'user' ? 'user' : 'assistant', content: m.content };
            });
            if (apiMessages.length > 20) apiMessages = apiMessages.slice(-20);
            apiMessages.unshift({ role: 'system', content: getSystemPrompt() });
            appendMessage('assistant', '...', true);
            callKimi(apiMessages)
                .then(function (data) {
                    removeTempMessage();
                    var content = (data && data.reply != null)
                        ? String(data.reply || '').trim()
                        : (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
                            ? String(data.choices[0].message.content || '').trim()
                            : 'Maaf, tidak ada respons.';
                    appendMessage('assistant', content, false);
                    if (data && data.data_updates && data.data_updates.refresh_needed) {
                        refreshWorkspace();
                    }
                    appendSmartCardsFromUpdates(data && data.data_updates);
                    juruService.addMessage(currentConvId, 'assistant', content).catch(function () {});
                })
                .catch(function (err) {
                    removeTempMessage();
                    var msg = (err && err.message) ? err.message : 'Gagal memanggil AI. Cek API key dan koneksi.';
                    appendMessage('assistant', msg, false);
                })
                .finally(function () { removeTempMessage(); setLoading(false); });
        }).catch(function () {
            requestKimiReplyWithoutHistory(lastUserText);
        });
    }

    function handleJuruApiResponse(data) {
        var content = (data && data.reply != null)
            ? String(data.reply || '').trim()
            : (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
                ? String(data.choices[0].message.content || '').trim()
                : 'Maaf, tidak ada respons.';
        appendMessage('assistant', content, false);
        if (data && data.data_updates && data.data_updates.refresh_needed) {
            refreshWorkspace();
        }
        appendSmartCardsFromUpdates(data && data.data_updates);
    }

    function callJuruBackendMock(messages) {
        // Mock sederhana untuk visualisasi UI tanpa bergantung pada Edge Function backend.
        var last = (messages && messages.length) ? messages[messages.length - 1] : { content: '' };
        var text = (last && last.content) ? String(last.content) : '';
        var lower = text.toLowerCase();

        var reply = '**Juru (Mock)**\n\n';
        var actionType = null;
        var items = [];

        if (lower.indexOf('task') >= 0 || lower.indexOf('tugas') >= 0) {
            actionType = 'CREATE_TASK';
            reply += 'Berikut beberapa task yang *Juru* baca dari workspace Anda (data mock):\n';
            items = [
                { title: 'Review roadmap Jadisatu', meta: 'Today • high' },
                { title: 'Follow up calon customer', meta: 'Today • medium' },
                { title: 'Update dashboard AI Agents', meta: 'This week • medium' }
            ];
        } else if (lower.indexOf('project') >= 0 || lower.indexOf('proyek') >= 0) {
            actionType = 'CREATE_PROJECT';
            reply += 'Saya menyiapkan ringkasan beberapa project aktif (data mock):\n';
            items = [
                { title: 'Jadisatu OS v1 Launch', meta: 'Work • 65% progress' },
                { title: 'Personal Knowledge Garden', meta: 'Personal • 30% progress' }
            ];
        } else {
            reply += 'Saya menerima pesan Anda dan akan membantu mengatur task, project, atau catatan. Coba minta: `list task hari ini` atau `ringkas project aktif saya`.';
            items = [];
        }

        var dataUpdates = {
            action_type: actionType,
            refresh_needed: !!actionType,
            cards: items.length ? [{
                type: actionType === 'CREATE_TASK' ? 'tasks_summary' : 'projects_summary',
                title: actionType === 'CREATE_TASK' ? 'Task Anda Hari Ini (Mock)' : 'Project Aktif (Mock)',
                subtitle: 'Contoh tampilan kartu pintar dari backend',
                items: items
            }] : []
        };

        return Promise.resolve({
            reply: reply,
            data_updates: dataUpdates
        });
    }

    function init() {
        createBubbleDOM();
        document.getElementById('juru-toggle').addEventListener('click', function () {
            var panel = document.getElementById('juru-panel');
            if (panel.classList.contains('hidden')) openPanel(); else showPanel(false);
        });
        document.getElementById('juru-panel-close').addEventListener('click', function () { showPanel(false); });
        document.getElementById('juru-send').addEventListener('click', sendMessage);
        document.getElementById('juru-input').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
