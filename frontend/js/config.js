// Supabase Configuration
const SUPABASE_URL = 'https://dwpkokavxjvtrltntjtn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_T5-XcRCVYuXvukpmPSO2cw_JBcOBwD1';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App configuration
const APP_CONFIG = {
  siteName: 'JadiSatu OS',
  version: '1.0.0',
  defaultDomains: ['work', 'learn', 'business', 'personal'],
  domainColors: {
    work: '#3b82f6',      // Blue
    learn: '#f59e0b',     // Amber
    business: '#10b981',  // Emerald
    personal: '#8b5cf6'   // Violet
  }
};
