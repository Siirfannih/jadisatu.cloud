"""
Supabase Database Manager
Stores and retrieves pain points/leads
"""

from supabase import create_client, Client
from typing import List, Dict, Optional
from datetime import datetime
import json
import os
from dotenv import load_dotenv
load_dotenv()

class Database:
    def __init__(self):
        # Supabase credentials
        self.supabase_url = os.environ.get("SUPABASE_URL", "https://your-project.supabase.co")
        self.supabase_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        
        # Initialize Supabase client
        self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
        
        print("✅ Supabase database connected")
    
    def init_db(self):
        """Check database connection"""
        try:
            # Test connection by counting records
            response = self.supabase.table('leads').select('id', count='exact').limit(0).execute()
            print(f"✅ Database connected - {response.count} leads in database")
        except Exception as e:
            print(f"⚠️  Database check: {str(e)}")
            print("Make sure to run the SQL setup script in Supabase Dashboard")
    
    def insert_pain_point(self, post: Dict) -> bool:
        """Insert a single pain point/lead"""
        try:
            # Prepare data
            data = {
                'id': post.get('id'),
                'source': post.get('source'),
                'platform': post.get('platform', post.get('source')),
                'subreddit': post.get('subreddit', ''),
                'title': post.get('title'),
                'body': post.get('body', ''),
                'url': post.get('url', ''),
                'upvotes': post.get('upvotes', 0),
                'comments': post.get('comments', 0),
                'author': post.get('author', ''),
                'created_at': post.get('created_at', ''),
                'scraped_at': post.get('scraped_at', datetime.now().isoformat()),
                'pain_score': post.get('pain_score', 0),
                'category': post.get('category', ''),
                'opportunity_level': post.get('opportunity_level', ''),
                'jadisatu_solution': post.get('jadisatu_solution', ''),
                'target_market': post.get('target_market', ''),
                'estimated_value': post.get('estimated_value', 0),
                'urgency': post.get('urgency', ''),
                'status': post.get('status', 'new'),
                'matching_keywords': post.get('matching_keywords', []) if isinstance(post.get('matching_keywords', []), list) else [],
                'keywords_extracted': post.get('keywords_extracted', []) if isinstance(post.get('keywords_extracted', []), list) else [],
                'analyzed_at': post.get('analyzed_at', datetime.now().isoformat())
            }
            
            # Upsert (insert or update if exists)
            response = self.supabase.table('leads').upsert(data, on_conflict='id').execute()
            
            print(f"✅ Inserted/Updated: {data['title'][:50]}...")
            return True
            
        except Exception as e:
            print(f"❌ Error inserting post {post.get('id')}: {str(e)}")
            return False
    
    def insert_batch(self, posts: List[Dict]) -> int:
        """Insert multiple pain points"""
        success_count = 0
        
        for post in posts:
            if self.insert_pain_point(post):
                success_count += 1
        
        print(f"✅ Inserted {success_count}/{len(posts)} pain points")
        return success_count
    
    def get_all(self, limit: int = 100, offset: int = 0) -> List[Dict]:
        """Get all pain points, sorted by pain score"""
        try:
            response = self.supabase.table('leads')\                .select('*')\                .order('pain_score', desc=True)\                .order('scraped_at', desc=True)\                .range(offset, offset + limit - 1)\                .execute()
            
            return response.data
            
        except Exception as e:
            print(f"❌ Error fetching leads: {str(e)}")
            return []
    
    def get_by_category(self, category: str, limit: int = 50) -> List[Dict]:
        """Get pain points by category"""
        try:
            response = self.supabase.table('leads')\                .select('*')\                .eq('category', category)\                .order('pain_score', desc=True)\                .limit(limit)\                .execute()
            
            return response.data
            
        except Exception as e:
            print(f"❌ Error fetching by category: {str(e)}")
            return []
    
    def get_stats(self) -> Dict:
        """Get database statistics"""
        try:
            # Total count
            total_response = self.supabase.table('leads').select('id', count='exact').execute()
            total = total_response.count
            
            # Today's count
            today = datetime.now().date().isoformat()
            today_response = self.supabase.table('leads')\                .select('id', count='exact')\                .gte('scraped_at', f"{today}T00:00:00")\                .execute()
            today_new = today_response.count
            
            # High opportunity count
            high_opp_response = self.supabase.table('leads')\                .select('id', count='exact')\                .eq('opportunity_level', 'Very High')\                .execute()
            high_opp = high_opp_response.count
            
            # Average pain score
            all_scores = self.supabase.table('leads')\                .select('pain_score')\                .gt('pain_score', 0)\                .execute()
            
            scores = [item['pain_score'] for item in all_scores.data if item.get('pain_score')]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0
            
            # Category breakdown
            all_categories = self.supabase.table('leads')\                .select('category')\                .neq('category', '')\                .not_.is_('category', 'null')\                .execute()
            
            categories = {}
            for item in all_categories.data:
                cat = item.get('category')
                if cat:
                    categories[cat] = categories.get(cat, 0) + 1
            
            return {
                "total_collected": total,
                "today_new": today_new,
                "high_opportunity": high_opp,
                "avg_pain_score": avg_score,
                "categories": categories,
                "sources_active": 2,  # Reddit + LinkedIn
                "keywords_tracked": 15
            }
            
        except Exception as e:
            print(f"❌ Error getting stats: {str(e)}")
            return {
                "total_collected": 0,
                "today_new": 0,
                "high_opportunity": 0,
                "avg_pain_score": 0,
                "categories": {},
                "sources_active": 2,
                "keywords_tracked": 15
            }
    
    def search(self, query: str, limit: int = 50) -> List[Dict]:
        """Search pain points by keyword"""
        try:
            # Supabase text search
            response = self.supabase.table('leads')\                .select('*')\                .or_(f"title.ilike.%{query}%,body.ilike.%{query}%")\                .order('pain_score', desc=True)\                .limit(limit)\                .execute()
            
            return response.data
            
        except Exception as e:
            print(f"❌ Error searching: {str(e)}")
            return []
    
    def update_status(self, problem_id: str, status: str) -> bool:
        """Update the status of a pain point"""
        try:
            response = self.supabase.table('leads')\                .update({'status': status})\                .eq('id', problem_id)\                .execute()
            
            return len(response.data) > 0
            
        except Exception as e:
            print(f"❌ Error updating status for {problem_id}: {str(e)}")
            return False

if __name__ == "__main__":
    # Test
    db = Database()
    db.init_db()
    
    # Test stats
    stats = db.get_stats()
    print("📊 Stats:", json.dumps(stats, indent=2))
