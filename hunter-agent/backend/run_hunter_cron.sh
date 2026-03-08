#!/bin/bash

# Hunter Agent - Cron Job Script
# Runs every 6 hours to scrape and analyze pain points

cd /root/hunter-agent/backend

# Activate virtual environment
source /root/lead-generator-env/bin/activate

# Run the hunter agent
python3 hunter_agent.py >> /var/log/hunter-agent/cron.log 2>&1

echo "✅ Hunter Agent cron job completed at $(date)" >> /var/log/hunter-agent/cron.log
