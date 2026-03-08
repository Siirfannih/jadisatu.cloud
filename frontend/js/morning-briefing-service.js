/**
 * MorningBriefingService — Supabase-backed morning briefing helper.
 * Disalin dari JadisatuPipeline/backend-fixes/morning-briefing-service.js (ES5-compatible).
 */
class MorningBriefingService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }

    async hasCompletedToday(userId) {
        try {
            var today = new Date().toISOString().split('T')[0];
            var res = await this.client
                .from('daily_briefing_log')
                .select('id')
                .eq('user_id', userId)
                .eq('briefing_date', today)
                .maybeSingle();
            if (res.error) throw res.error;
            return !!res.data;
        } catch (e) {
            console.warn('Briefing check failed:', e);
            var lsDate = localStorage.getItem('briefingDate');
            return lsDate === new Date().toDateString();
        }
    }

    async saveBriefing(userId, data) {
        try {
            var today = new Date().toISOString().split('T')[0];
            var row = {
                user_id: userId,
                briefing_date: today,
                clarity_level: data.clarity_level || 3,
                priority_task: data.priority_task || null,
                blockers: Array.isArray(data.blockers) ? data.blockers : [],
                ai_summary: data.ai_summary || null
            };

            var res = await this.client
                .from('daily_briefing_log')
                .upsert(row, { onConflict: 'user_id,briefing_date' })
                .select()
                .single();

            if (res.error) throw res.error;

            localStorage.setItem('briefingDate', new Date().toDateString());

            console.log('✅ Morning briefing saved to Supabase');
            return res.data;
        } catch (e) {
            console.error('Morning briefing save failed:', e);
            localStorage.setItem('briefingDate', new Date().toDateString());
            localStorage.setItem('briefingData', JSON.stringify(data));
            throw e;
        }
    }

    async getHistory(userId, days) {
        days = days || 7;
        try {
            var sinceDate = new Date();
            sinceDate.setDate(sinceDate.getDate() - days);
            var since = sinceDate.toISOString().split('T')[0];

            var res = await this.client
                .from('daily_briefing_log')
                .select('*')
                .eq('user_id', userId)
                .gte('briefing_date', since)
                .order('briefing_date', { ascending: false });

            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Briefing history load failed:', e);
            return [];
        }
    }

    async getStreak(userId) {
        try {
            var res = await this.client
                .from('daily_briefing_log')
                .select('briefing_date')
                .eq('user_id', userId)
                .order('briefing_date', { ascending: false })
                .limit(90);

            if (res.error) throw res.error;
            var dates = (res.data || []).map(function (r) { return r.briefing_date; });
            if (dates.length === 0) return 0;

            var streak = 0;
            var checkDate = new Date();
            checkDate.setHours(0, 0, 0, 0);

            for (var i = 0; i < 90; i++) {
                var dateStr = checkDate.toISOString().split('T')[0];
                if (dates.indexOf(dateStr) !== -1) {
                    streak++;
                } else if (i > 0) {
                    break;
                }
                checkDate.setDate(checkDate.getDate() - 1);
            }

            return streak;
        } catch (e) {
            console.warn('Streak calc failed:', e);
            return 0;
        }
    }
}

