# 🚀 Hunter Agent Leads - Quick Start Guide

## ⚡ 2-Minute Setup

### Step 1: Create Supabase Table (1 minute)
1. Open: https://supabase.com/dashboard/project/dwpkokavxjvtrltntjtn/sql
2. Copy content from: `/root/SUPABASE_SETUP_LEADS.sql`
3. Paste and click "Run"

### Step 2: Migrate Data (1 minute)
```bash
cd /tmp && node migrate_leads.js
```

You should see:
```
✅ [1/43] Migrated: First lead title...
✅ [2/43] Migrated: Second lead title...
...
📊 Migration Complete:
   ✅ Successfully migrated: 43
   ❌ Errors: 0
   📦 Total: 43
```

### Step 3: Access Dashboard
Open: http://76.13.190.196:3000/leads

---

## 📍 Quick Access

- **Dashboard:** http://76.13.190.196:3000
- **Leads Page:** http://76.13.190.196:3000/leads
- **Supabase Dashboard:** https://supabase.com/dashboard/project/dwpkokavxjvtrltntjtn

---

## 🔧 Quick Commands

### Check Service Status
```bash
systemctl status jadisatu-os
```

### View Logs
```bash
journalctl -u jadisatu-os -f
```

### Test Hunter Agent
```bash
cd /root/hunter-agent/backend && python3 database.py
```

### Test API
```bash
curl http://localhost:3000/api/leads?stats=true
```

---

## 📊 What You'll See

After setup, the Leads page will show:

- **Total Collected:** 43 leads
- **Categories:** Budget Gap, Time Gap, Skill Gap, etc.
- **Pain Scores:** 0-100 scoring system
- **Opportunity Levels:** Very High, High, Medium, Low
- **Search & Filters:** By category and keywords
- **Expandable Details:** Full analysis for each lead

---

## ⚠️ Troubleshooting

### Table Already Exists Error
If you see "relation already exists", that's OK! Just run the migration:
```bash
cd /tmp && node migrate_leads.js
```

### No Leads Showing
1. Check migration completed: `cd /tmp && node migrate_leads.js`
2. Verify API: `curl http://localhost:3000/api/leads`
3. Check service logs: `journalctl -u jadisatu-os -f`

### Hunter Agent Not Writing
1. Test connection: `cd /root/hunter-agent/backend && python3 database.py`
2. Check Python dependencies: `pip3 list | grep supabase`
3. Verify credentials in `database.py`

---

## 📁 Important Files

- `/root/SUPABASE_SETUP_LEADS.sql` - Table creation SQL
- `/tmp/migrate_leads.js` - Migration script
- `/root/HUNTER_AGENT_MIGRATION_SUMMARY.md` - Full documentation
- `/root/hunter-agent/backend/database.py` - Updated backend
- `/root/jadisatu-os/src/app/leads/page.tsx` - Leads page

---

## ✅ Success Checklist

- [ ] Created table in Supabase
- [ ] Ran migration script
- [ ] Accessed dashboard at /leads
- [ ] Saw 43 leads with stats
- [ ] Tested search and filters
- [ ] Expanded a lead to see details

---

**Status:** ✅ All code deployed, ready for final setup!  
**Time Required:** ~2 minutes  
**Risk:** None (SQLite backup remains intact)

For complete details, see: `/root/HUNTER_AGENT_MIGRATION_SUMMARY.md`
