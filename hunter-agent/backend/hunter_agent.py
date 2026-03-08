"""
Hunter Agent - Main Orchestrator
Coordinates scraping, analysis, and storage
"""

import time
from datetime import datetime
import os
from dotenv import load_dotenv
load_dotenv()
from reddit_scraper import RedditScraper
from linkedin_scraper import LinkedInScraper
from gemini_analyzer import GeminiAnalyzer
from database import Database

class HunterAgent:
    def __init__(self, gemini_api_key: str, apify_token: str = None):
        self.reddit_scraper = RedditScraper()
        self.linkedin_scraper = LinkedInScraper(apify_token) if apify_token else None
        self.gemini_analyzer = GeminiAnalyzer(gemini_api_key)
        self.database = Database()
    
    def run_full_cycle(self):
        """
        Run a complete scrape → analyze → store cycle
        """
        print("\n" + "="*60)
        print(f"🚀 HUNTER AGENT - Starting Full Cycle")
        print(f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60 + "\n")
        
        # Step 1: Scrape Reddit
        print("📡 STEP 1: Scraping Reddit...")
        reddit_posts = self.reddit_scraper.scrape_all()
        print(f"✅ Reddit: {len(reddit_posts)} posts collected\n")
        
        # Step 2: Scrape LinkedIn (if configured)
        linkedin_posts = []
        if self.linkedin_scraper:
            print("📡 STEP 2: Scraping LinkedIn...")
            linkedin_posts = self.linkedin_scraper.scrape_posts()
            print(f"✅ LinkedIn: {len(linkedin_posts)} posts collected\n")
        else:
            print("⏭️  STEP 2: LinkedIn scraper not configured, skipping\n")
        
        # Combine all posts
        all_posts = reddit_posts + linkedin_posts
        print(f"📊 Total posts to analyze: {len(all_posts)}\n")
        
        if not all_posts:
            print("⚠️  No posts found. Exiting.")
            return
        
        # Step 3: Analyze with Gemini
        print("🤖 STEP 3: Analyzing with Gemini AI...")
        analyzed_posts = self.gemini_analyzer.analyze_batch(all_posts, max_posts=50)
        print(f"✅ Analysis complete: {len(analyzed_posts)} posts analyzed\n")
        
        # Step 4: Store in database
        print("💾 STEP 4: Storing in database...")
        stored_count = self.database.insert_batch(analyzed_posts)
        print(f"✅ Stored: {stored_count} posts\n")
        
        # Step 5: Show summary
        print("📊 STEP 5: Summary")
        stats = self.database.get_stats()
        print(f"   Total in DB: {stats['total_collected']}")
        print(f"   Added today: {stats['today_new']}")
        print(f"   High opportunity: {stats['high_opportunity']}")
        print(f"   Avg pain score: {stats['avg_pain_score']}")
        
        # Show top 5 pain points
        print("\n🔥 TOP 5 PAIN POINTS:")
        top_posts = self.database.get_all(limit=5)
        for i, post in enumerate(top_posts, 1):
            print(f"   {i}. [{post['pain_score']}] {post['title'][:60]}...")
            print(f"      Category: {post['category']} | Opportunity: {post['opportunity_level']}")
        
        print("\n" + "="*60)
        print("✅ HUNTER AGENT - Cycle Complete")
        print("="*60 + "\n")

if __name__ == "__main__":
    # Configuration
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    APIFY_TOKEN = os.environ.get("APIFY_TOKEN", "")
    
    # Create and run agent
    agent = HunterAgent(
        gemini_api_key=GEMINI_API_KEY,
        apify_token=APIFY_TOKEN
    )
    
    agent.run_full_cycle()
