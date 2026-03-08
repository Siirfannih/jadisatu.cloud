# Google OAuth Setup Instructions for JadiSatu Dashboard

## CRITICAL: Supabase Configuration Required

The Google OAuth login is currently failing because the Supabase Site URL is configured for localhost instead of your production domain. This CANNOT be fixed via API and requires manual configuration in the Supabase Dashboard.

### Step 1: Update Supabase Site URL

1. Go to your Supabase Dashboard:
   https://supabase.com/dashboard/project/dwpkokavxjvtrltntjtn/auth/url-configuration

2. Update the following settings:

   **Site URL:**
   - Change from: `http://localhost:3000`
   - Change to: `http://jadisatu.cloud`

   **Redirect URLs (add these if not present):**
   - `http://jadisatu.cloud/**`
   - `http://jadisatu.cloud/auth/callback`

3. Click "Save" to apply changes

### Step 2: Verify Google Cloud Console Settings

1. Go to Google Cloud Console:
   https://console.cloud.google.com/apis/credentials

2. Find your OAuth 2.0 Client ID for JadiSatu

3. Verify the following:

   **Application Type:** Web application

   **Authorized JavaScript origins:**
   - `http://jadisatu.cloud`
   - `https://dwpkokavxjvtrltntjtn.supabase.co`

   **Authorized redirect URIs:**
   - `https://dwpkokavxjvtrltntjtn.supabase.co/auth/v1/callback`

4. Ensure the OAuth consent screen is set to "External" (not "Internal")

### Step 3: Test Google OAuth Login

1. Visit: http://jadisatu.cloud/login

2. Click "Continue with Google"

3. You should be redirected to Google's login page

4. After authentication, you should be redirected back to the dashboard

5. If you see an error, check the browser console (F12) for detailed error messages

## What Was Fixed Automatically

✅ **Logout Button** - Now uses `window.location.href` for reliable redirects
✅ **Error Handling** - Login page now displays OAuth errors from the callback
✅ **Auth Callback Route** - Enhanced with better error handling and logging
✅ **Console Logging** - Added detailed logging for debugging OAuth issues

## Testing the Fixes

### Test Logout:
1. Log in to the dashboard (using email/password if Google OAuth isn't working yet)
2. Click the logout button in the sidebar
3. You should be immediately redirected to `/login`
4. Verify you cannot access `/` without logging in again

### Test Google OAuth (after Supabase configuration):
1. Go to http://jadisatu.cloud/login
2. Click "Continue with Google"
3. Complete Google authentication
4. You should land on the dashboard at `/`
5. Check that your Google profile name appears in the sidebar

## Troubleshooting

If Google OAuth still doesn't work after the configuration:

1. **Check Browser Console** (F12 → Console tab)
   - Look for errors starting with "OAuth error:", "Google OAuth error:", or "Auth callback"

2. **Check Server Logs**
   ```bash
   ssh -p 2222 root@76.13.190.196
   tail -f /tmp/jadisatu-os.log
   ```

3. **Common Issues:**
   - **502 Error**: Usually means Site URL mismatch - verify Supabase settings
   - **400 Error**: Check Google Cloud Console redirect URIs
   - **Access Denied**: User may have declined permissions
   - **Invalid Credentials**: Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in Supabase

## Files Modified

- `/root/jadisatu-os/src/app/page.tsx` - Fixed handleLogout function
- `/root/jadisatu-os/src/app/login/page.tsx` - Added error handling and Suspense wrapper
- `/root/jadisatu-os/src/app/auth/callback/route.ts` - Enhanced error handling

## Deployment Status

✅ Application rebuilt successfully
✅ Application restarted
✅ Running on http://jadisatu.cloud (port 3000)

---

**Next Action Required:** Complete Step 1 (Update Supabase Site URL) to enable Google OAuth
