/**
 * Creative Hub — content items (idea → script → ready → published).
 * Storage: Supabase (contents table - unified with Light mode) when client+userId provided;
 *          else localStorage (jadisatu_creative_items) as fallback.
 * Both Dark mode and Light mode now share the same 'contents' table.
 */
(function () {
    var STORAGE_KEY = 'jadisatu_creative_items';
    var STATUSES = ['idea', 'scripting', 'script', 'ready', 'published'];
    var PLATFORMS = ['tiktok', 'linkedin', 'instagram', 'threads', 'youtube', 'twitter'];
    var TABLE = 'contents';

    function generateId() {
        return 'ch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    }

    function loadAll() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function saveAll(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
            return true;
        } catch (e) {
            return false;
        }
    }

    function CreativeHubService(supabaseClient, userId) {
        this._client = supabaseClient || null;
        this._userId = userId || null;
        this._useSupabase = !!(this._client && this._userId);

        this.getItems = function (opts) {
            if (this._useSupabase) {
                var self = this;
                var platformFilter = (opts && opts.platform) ? String(opts.platform).toLowerCase() : null;
                var query = self._client.from(TABLE).select('*').eq('user_id', self._userId).order('created_at', { ascending: false });
                if (platformFilter && platformFilter !== 'all') {
                    query = query.eq('platform', platformFilter);
                }
                return query.then(function (res) {
                    if (res.error) throw res.error;
                    return (res.data || []).map(mapFromDb);
                }).catch(function (e) {
                    console.error('CreativeHubService getItems (Supabase):', e);
                    return [];
                });
            }
            var list = loadAll();
            var platformFilter = (opts && opts.platform) ? String(opts.platform).toLowerCase() : null;
            if (platformFilter && platformFilter !== 'all') {
                list = list.filter(function (item) {
                    var plats = item.platform || [];
                    if (typeof plats === 'string') return plats.toLowerCase() === platformFilter;
                    return plats.some(function (p) { return String(p).toLowerCase() === platformFilter; });
                });
            }
            return list;
        };

        this.getItem = function (id) {
            if (this._useSupabase) {
                var self = this;
                return self._client.from(TABLE).select('*').eq('user_id', self._userId).eq('id', id).maybeSingle()
                    .then(function (res) {
                        if (res.error) throw res.error;
                        return res.data ? mapFromDb(res.data) : null;
                    })
                    .catch(function (e) {
                        console.error('CreativeHubService getItem (Supabase):', e);
                        return null;
                    });
            }
            var list = loadAll();
            return list.find(function (item) { return item.id === id; }) || null;
        };

        this.addIdea = function (title, platforms) {
            if (this._useSupabase) {
                var self = this;
                var platformStr = Array.isArray(platforms) ? (platforms[0] || 'instagram') : (platforms || 'instagram');
                var row = {
                    user_id: self._userId,
                    title: String(title || '').trim() || 'Tanpa judul',
                    script: '',
                    caption: '',
                    hook_text: '',
                    value_text: '',
                    cta_text: '',
                    status: 'idea',
                    platform: String(platformStr).toLowerCase()
                };
                return self._client.from(TABLE).insert(row).select().single()
                    .then(function (res) {
                        if (res.error) throw res.error;
                        return mapFromDb(res.data);
                    })
                    .catch(function (e) {
                        console.error('CreativeHubService addIdea (Supabase):', e);
                        throw e;
                    });
            }
            var list = loadAll();
            var item = {
                id: generateId(),
                title: String(title || '').trim() || 'Tanpa judul',
                hook_text: '',
                value_text: '',
                cta_text: '',
                full_script: '',
                status: 'idea',
                platform: Array.isArray(platforms) ? platforms : (platforms ? [platforms] : []),
                created_at: new Date().toISOString(),
                published_url: null,
                scheduled_date: null
            };
            list.push(item);
            saveAll(list);
            return item;
        };

        this.updateItem = function (id, updates) {
            if (this._useSupabase) {
                var self = this;
                var allowed = {};
                if (updates.title !== undefined) allowed.title = String(updates.title).trim() || undefined;
                if (updates.hook_text !== undefined) allowed.hook_text = updates.hook_text;
                if (updates.value_text !== undefined) allowed.value_text = updates.value_text;
                if (updates.cta_text !== undefined) allowed.cta_text = updates.cta_text;
                if (updates.full_script !== undefined) allowed.script = updates.full_script;
                if (updates.script !== undefined) allowed.script = updates.script;
                if (updates.status !== undefined && STATUSES.indexOf(updates.status) !== -1) allowed.status = updates.status;
                if (updates.platform !== undefined) {
                    var p = updates.platform;
                    allowed.platform = Array.isArray(p) ? (p[0] || 'instagram') : String(p).toLowerCase();
                }
                if (updates.published_url !== undefined) allowed.published_url = updates.published_url;
                if (updates.scheduled_date !== undefined) {
                    allowed.publish_date = updates.scheduled_date ? String(updates.scheduled_date).split('T')[0] : null;
                }
                if (updates.publish_date !== undefined) {
                    allowed.publish_date = updates.publish_date ? String(updates.publish_date).split('T')[0] : null;
                }
                if (updates.caption !== undefined) allowed.caption = updates.caption;
                if (updates.canva_template_url !== undefined) allowed.canva_template_url = updates.canva_template_url;
                if (updates.canva_design_id !== undefined) allowed.canva_design_id = updates.canva_design_id;
                if (updates.carousel_slide_count !== undefined) allowed.carousel_slide_count = updates.carousel_slide_count;
                if (updates.approval_rate !== undefined) allowed.approval_rate = updates.approval_rate;
                if (updates.export_timestamp !== undefined) allowed.export_timestamp = updates.export_timestamp;
                if (updates.brand_config !== undefined) allowed.brand_config = updates.brand_config;
                Object.keys(allowed).forEach(function (k) { if (allowed[k] === undefined) delete allowed[k]; });
                if (Object.keys(allowed).length === 0) return Promise.resolve(null);
                return self._client.from(TABLE).update(allowed).eq('user_id', self._userId).eq('id', id).select().single()
                    .then(function (res) {
                        if (res.error) throw res.error;
                        return mapFromDb(res.data);
                    })
                    .catch(function (e) {
                        console.error('CreativeHubService updateItem (Supabase):', e);
                        throw e;
                    });
            }
            var list = loadAll();
            var idx = list.findIndex(function (item) { return item.id === id; });
            if (idx === -1) return null;
            var item = list[idx];
            if (updates.title !== undefined) item.title = String(updates.title).trim() || item.title;
            if (updates.hook_text !== undefined) item.hook_text = updates.hook_text;
            if (updates.value_text !== undefined) item.value_text = updates.value_text;
            if (updates.cta_text !== undefined) item.cta_text = updates.cta_text;
            if (updates.full_script !== undefined) item.full_script = updates.full_script;
            if (updates.status !== undefined && STATUSES.indexOf(updates.status) !== -1) item.status = updates.status;
            if (updates.platform !== undefined) item.platform = Array.isArray(updates.platform) ? updates.platform : [updates.platform];
            if (updates.published_url !== undefined) item.published_url = updates.published_url;
            if (updates.scheduled_date !== undefined) item.scheduled_date = updates.scheduled_date ? String(updates.scheduled_date).split('T')[0] : null;
            list[idx] = item;
            saveAll(list);
            return item;
        };

        this.deleteItem = function (id) {
            if (this._useSupabase) {
                var self = this;
                return self._client.from(TABLE).delete().eq('user_id', self._userId).eq('id', id)
                    .then(function (res) {
                        if (res.error) throw res.error;
                        return true;
                    })
                    .catch(function (e) {
                        console.error('CreativeHubService deleteItem (Supabase):', e);
                        throw e;
                    });
            }
            var list = loadAll().filter(function (item) { return item.id !== id; });
            saveAll(list);
            return true;
        };

        this.getCounts = function (platformFilter) {
            var self = this;
            if (this._useSupabase) {
                return Promise.resolve(self.getItems(platformFilter ? { platform: platformFilter } : {})).then(function (list) {
                    var counts = { idea: 0, scripting: 0, script: 0, ready: 0, published: 0, total: list.length };
                    list.forEach(function (item) {
                        var s = (item.status || 'idea').toLowerCase();
                        if (counts.hasOwnProperty(s)) counts[s]++;
                    });
                    return counts;
                });
            }
            var list = this.getItems(platformFilter ? { platform: platformFilter } : {});
            var counts = { idea: 0, scripting: 0, script: 0, ready: 0, published: 0, total: list.length };
            list.forEach(function (item) {
                var s = (item.status || 'idea').toLowerCase();
                if (counts.hasOwnProperty(s)) counts[s]++;
            });
            return counts;
        };

        this.getNextAction = function (platformFilter) {
            var self = this;
            if (this._useSupabase) {
                var q = self._client.from(TABLE).select('*').eq('user_id', self._userId).eq('status', 'ready').order('created_at', { ascending: true }).limit(1);
                if (platformFilter && platformFilter !== 'all') q = q.eq('platform', platformFilter);
                return q.maybeSingle().then(function (res) {
                    if (res.error) throw res.error;
                    return res.data ? mapFromDb(res.data) : null;
                }).catch(function (e) {
                    console.error('CreativeHubService getNextAction (Supabase):', e);
                    return null;
                });
            }
            var list = this.getItems(platformFilter ? { platform: platformFilter } : {});
            var ready = list.filter(function (item) { return (item.status || '').toLowerCase() === 'ready'; });
            ready.sort(function (a, b) { return new Date(a.created_at || 0) - new Date(b.created_at || 0); });
            return ready[0] || null;
        };
    }

    /**
     * Map DB row (contents table) to Dark mode's expected format.
     * Ensures backward compatibility with existing Dark mode UI code.
     */
    function mapFromDb(row) {
        if (!row) return row;
        return {
            id: row.id,
            user_id: row.user_id,
            title: row.title,
            hook_text: row.hook_text || '',
            value_text: row.value_text || '',
            cta_text: row.cta_text || '',
            full_script: row.script || '',
            script: row.script || '',
            caption: row.caption || '',
            status: row.status === 'script' ? 'scripting' : row.status,
            platform: row.platform ? [row.platform] : [],
            published_url: row.published_url || null,
            scheduled_date: row.publish_date || null,
            publish_date: row.publish_date || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            thumbnail: row.thumbnail || '',
            carousel_assets: row.carousel_assets || [],
            canva_template_url: row.canva_template_url || null,
            canva_design_id: row.canva_design_id || null,
            carousel_slide_count: row.carousel_slide_count || 0,
            approval_rate: row.approval_rate || null,
            brand_config: row.brand_config || null
        };
    }

    window.CreativeHubService = CreativeHubService;
})();
