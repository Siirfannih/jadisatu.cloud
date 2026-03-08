# 🚀 Hunter Agent Backend - Deployment Guide

## 📦 **What's Included**

- `reddit_scraper.py` - Scrapes Reddit using public JSON API (no auth needed)
- `linkedin_scraper.py` - Scrapes LinkedIn using Apify API
- `gemini_analyzer.py` - Analyzes pain points with Gemini AI
- `database.py` - SQLite database manager
- `hunter_agent.py` - Main orchestrator
- `api.py` - FastAPI server for dashboard
- `requirements.txt` - Python dependencies
- `run_hunter_cron.sh` - Cron job script

## 🎯 **Features**

### **Pain Keyword Targeting**
The agent searches for these high-value keywords:
- "frustrated with"
- "I wish there was"
- "still manually"
- "no good tool"
- "too expensive"
- "can't afford"
- "need a better way"
- "waste time"
- "tired of"
- "struggling with"
- "looking for a tool"
- "is there a tool"
- "any tool that"
- "cheaper alternative"
- "affordable solution"

### **Gemini AI Analysis**
For each pain point, Gemini provides:
- **Pain Score** (1-100): Severity assessment
- **Category**: Budget Gap, Agency Trust Gap, Marketing Gap, etc.
- **Opportunity Level**: Very High, High, Medium
- **Jadisatu Solution**: How Jadisatu can solve it
- **Target Market**: Who experiences this pain
- **Estimated Value**: What people would pay
- **Urgency**: High, Medium, Low

## 🚀 **Deployment Steps**

### **1. Upload Backend Files to VPS**

```bash
# From your local machine
scp -P 2222 -r /Users/igedeirfankusumaputra/Documents/Lifeworkspace/Agent\ Productivity\ Content/Jadisatu/hunter-backend/* root@76.13.190.196:/root/hunter-agent/backend/
```

### **2. Install Dependencies on VPS**

```bash
# SSH into VPS
ssh -p 2222 root@76.13.190.196

# Navigate to backend directory
cd /root/hunter-agent/backend

# Activate virtual environment
source /root/lead-generator-env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### **3. Test the Agent**

```bash
# Run a test cycle
python3 hunter_agent.py
```

Expected output:
```
🚀 HUNTER AGENT - Starting Full Cycle
📡 STEP 1: Scraping Reddit...
✅ Reddit: 45 posts collected
🤖 STEP 3: Analyzing with Gemini AI...
✅ Analysis complete: 45 posts analyzed
💾 STEP 4: Storing in database...
✅ Stored: 45 posts
📊 STEP 5: Summary
   Total in DB: 45
   High opportunity: 12
🔥 TOP 5 PAIN POINTS:
   1. [95] Need website but can't afford agency prices...
   2. [92] Got scammed by web design agency...
✅ HUNTER AGENT - Cycle Complete
```

### **4. Start FastAPI Server**

```bash
# Start API server
nohup python3 api.py > /var/log/hunter-agent/api.log 2>&1 &

# Check if running
curl http://localhost:8000/api/stats
```

### **5. Set Up Cron Job** (Runs every 6 hours)

```bash
# Make script executable
chmod +x run_hunter_cron.sh

# Edit crontab
crontab -e

# Add this line (runs at 2 AM, 8 AM, 2 PM, 8 PM)
0 2,8,14,20 * * * /root/hunter-agent/backend/run_hunter_cron.sh
```

### **6. Configure PM2 for API Server**

```bash
# Install PM2 globally (if not already)
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'hunter-api',
      script: 'python3',
      args: 'api.py',
      cwd: '/root/hunter-agent/backend',
      interpreter: '/root/lead-generator-env/bin/python3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔌 **API Endpoints**

### **GET /api/stats**
Returns dashboard statistics:
```json
{
  "total_collected": 127,
  "today_new": 45,
  "high_opportunity": 12,
  "avg_pain_score": 78.5,
  "categories": {
    "Budget Gap": 23,
    "Agency Trust Gap": 18,
    "Marketing Gap": 31
  }
}
```

### **GET /api/problems**
Returns pain points with optional filtering:
```
/api/problems?limit=50&offset=0
/api/problems?category=Budget%20Gap
/api/problems?search=website
```

### **GET /api/problems/{id}**
Returns a single pain point

### **POST /api/trigger-scrape**
Manually trigger a scrape cycle

## 🔄 **Update Frontend to Use Real Data**

Update `/root/hunter-agent/frontend/app/page.tsx`:

```typescript
// Replace mock data with API calls
const [problems, setProblems] = useState([]);
const [stats, setStats] = useState({});

useEffect(() => {
  // Fetch stats
  fetch('http://localhost:8000/api/stats')
    .then(res => res.json())
    .then(data => setStats(data));
  
  // Fetch problems
  fetch('http://localhost:8000/api/problems?limit=100')
    .then(res => res.json())
    .then(data => setProblems(data.data));
}, []);
```

## 📊 **Database Schema**

SQLite database at `/root/data/hunter-agent.db`:

```sql
pain_points (
  id TEXT PRIMARY KEY,
  source TEXT,
  title TEXT,
  body TEXT,
  upvotes INTEGER,
  comments INTEGER,
  pain_score INTEGER,
  category TEXT,
  opportunity_level TEXT,
  jadisatu_solution TEXT,
  target_market TEXT,
  estimated_value INTEGER,
  urgency TEXT,
  matching_keywords TEXT,
  keywords_extracted TEXT,
  scraped_at TEXT,
  analyzed_at TEXT
)
```

## 🎯 **Expected Results**

### **Per 6-Hour Cycle**:
- Reddit: 40-60 posts with pain keywords
- LinkedIn: 10-20 posts (if Apify configured)
- Gemini Analysis: 50-80 posts analyzed
- Database: 50-80 new pain points stored

### **Per Day** (4 cycles):
- 200-320 new pain points
- 50-80 "Very High" opportunities
- 100-150 "High" opportunities

### **Per Week**:
- 1,400-2,240 pain points
- 350-560 "Very High" opportunities

## 🔧 **Troubleshooting**

### **Check API Server**
```bash
pm2 status
pm2 logs hunter-api
```

### **Check Cron Jobs**
```bash
tail -f /var/log/hunter-agent/cron.log
```

### **Check Database**
```bash
sqlite3 /root/data/hunter-agent.db "SELECT COUNT(*) FROM pain_points;"
```

### **Manual Test**
```bash
cd /root/hunter-agent/backend
source /root/lead-generator-env/bin/activate
python3 hunter_agent.py
```

## 💰 **Cost**

- Reddit API: **FREE** (public JSON)
- Gemini API: **FREE** (15 RPM limit)
- Apify: **$49/month** (or free tier)
- VPS: **$0** (existing)
- **Total: $0-49/month**

## 🎉 **Success Metrics**

✅ API server running on port 8000  
✅ Cron job executing every 6 hours  
✅ Database growing with pain points  
✅ Dashboard showing real data  
✅ Gemini AI analyzing accurately  

---

**Status**: Ready to deploy!  
**Next**: Upload files and run deployment steps
