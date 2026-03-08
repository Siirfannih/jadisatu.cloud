/**
 * Migrasi satu kali: baca jadisatu_creative_items dari localStorage dan upload ke tabel creative_content (Supabase).
 * Jalankan di browser saat user sudah login (Supabase auth). Buka Console di halaman Creative Hub lalu:
 *   migrateCreativeLocalStorageToSupabase(supabaseClient, userId)
 * Atau gunakan dari halaman yang sudah punya supabaseClient + currentUser.
 */
(function () {
    var STORAGE_KEY = 'jadisatu_creative_items';
    var TABLE = 'creative_content';

    function loadFromLocalStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            var list = JSON.parse(raw);
            return Array.isArray(list) ? list : [];
        } catch (e) {
            console.error('migrate: loadFromLocalStorage failed', e);
            return [];
        }
    }

    function mapItem(item, userId) {
        return {
            id: item.id,
            user_id: userId,
            title: item.title || 'Tanpa judul',
            hook_text: item.hook_text || '',
            value_text: item.value_text || '',
            cta_text: item.cta_text || '',
            full_script: item.full_script || '',
            status: (item.status && ['idea', 'scripting', 'ready', 'published'].indexOf(item.status) >= 0) ? item.status : 'idea',
            platform: Array.isArray(item.platform) ? item.platform : (item.platform ? [item.platform] : []),
            published_url: item.published_url || null,
            scheduled_date: item.scheduled_date ? String(item.scheduled_date).split('T')[0] : null,
            canva_template_url: item.canva_template_url || null,
            canva_design_id: item.canva_design_id || null,
            carousel_slide_count: item.carousel_slide_count || null,
            approval_rate: item.approval_rate || null,
            export_timestamp: item.export_timestamp || null,
            brand_config: item.brand_config || {}
        };
    }

    window.migrateCreativeLocalStorageToSupabase = function (supabaseClient, userId) {
        if (!supabaseClient || !userId) {
            console.error('migrate: supabaseClient and userId are required');
            return Promise.reject(new Error('supabaseClient and userId required'));
        }
        var list = loadFromLocalStorage();
        if (list.length === 0) {
            console.log('migrate: no items in localStorage');
            return Promise.resolve({ migrated: 0, skipped: 0, errors: [] });
        }
        var errors = [];
        var migrated = 0;
        var skipped = 0;
        return list.reduce(function (promise, item) {
            return promise.then(function () {
                var row = mapItem(item, userId);
                return supabaseClient.from(TABLE).upsert(row, { onConflict: 'id' })
                    .then(function (res) {
                        if (res.error) {
                            errors.push({ id: item.id, error: res.error.message });
                            skipped++;
                        } else {
                            migrated++;
                        }
                    })
                    .catch(function (e) {
                        errors.push({ id: item.id, error: e && e.message ? e.message : String(e) });
                        skipped++;
                    });
            });
        }, Promise.resolve()).then(function () {
            console.log('migrate: done. migrated=' + migrated + ' skipped=' + skipped, errors.length ? errors : '');
            return { migrated: migrated, skipped: skipped, errors: errors };
        });
    };
})();
