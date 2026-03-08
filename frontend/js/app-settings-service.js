/**
 * App settings (Canva template, brand config) — localStorage key jadisatu_app_settings.
 * Dipakai oleh Carousel Generator & Settings page.
 */
(function () {
    var KEY = 'jadisatu_app_settings';
    var DEFAULTS = {
        canva_template_url: '',
        brand_config: {
            primary_color: '#8b5cf6',
            secondary_color: '#6366f1',
            font_heading: 'Inter',
            canvas_size: '1080x1080'
        }
    };

    function load() {
        try {
            var raw = localStorage.getItem(KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
            var data = JSON.parse(raw);
            var bc = DEFAULTS.brand_config;
            if (data.brand_config && typeof data.brand_config === 'object') {
                bc = {};
                for (var k in DEFAULTS.brand_config) bc[k] = DEFAULTS.brand_config[k];
                for (var k in data.brand_config) bc[k] = data.brand_config[k];
            }
            return {
                canva_template_url: data.canva_template_url != null ? data.canva_template_url : DEFAULTS.canva_template_url,
                brand_config: bc
            };
        } catch (e) {
            return JSON.parse(JSON.stringify(DEFAULTS));
        }
    }

    function save(data) {
        try {
            var current = load();
            if (data.canva_template_url !== undefined) current.canva_template_url = data.canva_template_url;
            if (data.brand_config && typeof data.brand_config === 'object') {
                for (var k in data.brand_config) current.brand_config[k] = data.brand_config[k];
            }
            localStorage.setItem(KEY, JSON.stringify(current));
            return true;
        } catch (e) {
            return false;
        }
    }

    window.AppSettingsService = {
        load: load,
        save: save,
        KEY: KEY
    };
})();
