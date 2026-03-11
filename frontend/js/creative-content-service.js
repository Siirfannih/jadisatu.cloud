/**
 * CreativeContentService — Supabase-backed content pipeline helper.
 * Disalin dari JadisatuPipeline/backend-fixes/creative-content-service.js (ES5-compatible).
 */
class CreativeContentService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
        this.TABLE = 'contents';
        this.STATUSES = ['idea', 'scripting', 'script', 'ready', 'published'];
    }

    async getItems(userId, opts) {
        try {
            console.log('[CreativeContentService.getItems] userId=', userId, 'opts=', opts);
            var query = this.client
                .from(this.TABLE)
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            var platformFilter = (opts && opts.platform) ? String(opts.platform).toLowerCase() : null;
            if (platformFilter && platformFilter !== 'all') {
                query = query.eq('platform', platformFilter);
            }

            var res = await query;
            console.log('[CreativeContentService.getItems] response error=', res.error, 'data.length=', (res.data && res.data.length) || 0);
            if (res.error) throw res.error;
            return (res.data || []).map(this._mapFromDb);
        } catch (e) {
            console.error('CreativeContent getItems failed (RLS or network?):', e);
            return [];
        }
    }

    async getItem(userId, id) {
        try {
            var res = await this.client
                .from(this.TABLE)
                .select('*')
                .eq('user_id', userId)
                .eq('id', id)
                .maybeSingle();

            if (res.error) throw res.error;
            return res.data ? this._mapFromDb(res.data) : null;
        } catch (e) {
            console.error('CreativeContent getItem failed:', e);
            return null;
        }
    }

    async addIdea(userId, title, platforms) {
        try {
            var platformStr = Array.isArray(platforms) ? (platforms[0] || 'instagram') : (platforms || 'instagram');
            var row = {
                user_id: userId,
                title: String(title || '').trim() || 'Tanpa judul',
                hook_text: '',
                value_text: '',
                cta_text: '',
                script: '',
                caption: '',
                status: 'idea',
                platform: String(platformStr).toLowerCase(),
                published_url: null,
                publish_date: null
            };

            var res = await this.client
                .from(this.TABLE)
                .insert(row)
                .select()
                .single();

            if (res.error) throw res.error;
            console.log('✅ Creative idea saved to Supabase');
            return this._mapFromDb(res.data);
        } catch (e) {
            console.error('CreativeContent addIdea failed:', e);
            throw e;
        }
    }

    async updateItem(userId, id, updates) {
        try {
            var allowed = {};

            if (updates.title !== undefined)
                allowed.title = String(updates.title).trim() || undefined;
            if (updates.hook_text !== undefined)
                allowed.hook_text = updates.hook_text;
            if (updates.value_text !== undefined)
                allowed.value_text = updates.value_text;
            if (updates.cta_text !== undefined)
                allowed.cta_text = updates.cta_text;
            if (updates.full_script !== undefined)
                allowed.script = updates.full_script;
            if (updates.script !== undefined)
                allowed.script = updates.script;
            if (updates.status !== undefined && this.STATUSES.indexOf(updates.status) !== -1)
                allowed.status = updates.status;
            if (updates.platform !== undefined) {
                var p = updates.platform;
                allowed.platform = Array.isArray(p) ? (p[0] || 'instagram') : String(p).toLowerCase();
            }
            if (updates.published_url !== undefined)
                allowed.published_url = updates.published_url;
            if (updates.scheduled_date !== undefined)
                allowed.publish_date = updates.scheduled_date ? String(updates.scheduled_date).split('T')[0] : null;
            if (updates.publish_date !== undefined)
                allowed.publish_date = updates.publish_date ? String(updates.publish_date).split('T')[0] : null;
            if (updates.canva_design_id !== undefined) allowed.canva_design_id = updates.canva_design_id;
            if (updates.canva_template_url !== undefined) allowed.canva_template_url = updates.canva_template_url;
            if (updates.carousel_slide_count !== undefined) allowed.carousel_slide_count = updates.carousel_slide_count;
            if (updates.approval_rate !== undefined) allowed.approval_rate = updates.approval_rate;
            if (updates.export_timestamp !== undefined) allowed.export_timestamp = updates.export_timestamp;

            Object.keys(allowed).forEach(function (k) {
                if (allowed[k] === undefined) delete allowed[k];
            });

            if (Object.keys(allowed).length === 0) return null;

            var res = await this.client
                .from(this.TABLE)
                .update(allowed)
                .eq('user_id', userId)
                .eq('id', id)
                .select()
                .single();

            if (res.error) throw res.error;
            console.log('✅ Creative item updated in Supabase');
            return this._mapFromDb(res.data);
        } catch (e) {
            console.error('CreativeContent updateItem failed:', e);
            throw e;
        }
    }

    async advanceStatus(userId, id) {
        try {
            var item = await this.getItem(userId, id);
            if (!item) return null;

            var currentIdx = this.STATUSES.indexOf(item.status || 'idea');
            if (currentIdx === -1 || currentIdx >= this.STATUSES.length - 1) return item;

            var nextStatus = this.STATUSES[currentIdx + 1];
            return await this.updateItem(userId, id, { status: nextStatus });
        } catch (e) {
            console.error('CreativeContent advanceStatus failed:', e);
            throw e;
        }
    }

    async deleteItem(userId, id) {
        try {
            var res = await this.client
                .from(this.TABLE)
                .delete()
                .eq('user_id', userId)
                .eq('id', id);

            if (res.error) throw res.error;
            console.log('✅ Creative item deleted from Supabase');
            return true;
        } catch (e) {
            console.error('CreativeContent deleteItem failed:', e);
            throw e;
        }
    }

    async getCounts(userId, platformFilter) {
        try {
            var items = await this.getItems(userId, platformFilter ? { platform: platformFilter } : {});
            var counts = { idea: 0, scripting: 0, ready: 0, published: 0, total: items.length };
            items.forEach(function (item) {
                var s = (item.status || 'idea').toLowerCase();
                if (counts.hasOwnProperty(s)) counts[s]++;
            });
            return counts;
        } catch (e) {
            console.error('CreativeContent getCounts failed:', e);
            return { idea: 0, scripting: 0, ready: 0, published: 0, total: 0 };
        }
    }

    /** Map contents table row to Dark mode expected format */
    _mapFromDb(row) {
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
            canva_template_url: row.canva_template_url || null,
            canva_design_id: row.canva_design_id || null,
            carousel_slide_count: row.carousel_slide_count || 0,
            approval_rate: row.approval_rate || null,
            export_timestamp: row.export_timestamp || null,
        };
    }

    async getNextAction(userId, platformFilter) {
        try {
            var query = this.client
                .from(this.TABLE)
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'ready')
                .order('created_at', { ascending: true })
                .limit(1);

            if (platformFilter && platformFilter !== 'all') {
                query = query.eq('platform', platformFilter);
            }

            var res = await query.maybeSingle();
            if (res.error) throw res.error;
            return res.data ? this._mapFromDb(res.data) : null;
        } catch (e) {
            console.error('CreativeContent getNextAction failed:', e);
            return null;
        }
    }
}

