"""
Reddit Scraper - No Auth Required
Scrapes Reddit for business pain points using public JSON API
"""

import requests
import time
from typing import List, Dict
from datetime import datetime

class RedditScraper:
    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0 HunterAgent/1.0"}
        self.subreddits = ["entrepreneur", "SaaS", "smallbusiness", "startups"]
        
        # High-value pain point keywords for SMEs (Web, Automation, Social Media)
        self.pain_keywords = [
            "website is too expensive",
            "agency ripped me off",
            "can't afford agency",
            "no time for social media",
            "social media takes too long",
            "tired of posting manually",
            "waste time posting",
            "how to automate",
            "need to automate",
            "too much manual work",
            "struggling to get leads",
            "marketing is too hard",
            "hiring a developer",
            "costs too much to build",
            "need a cheaper website",
            "frustrated with",
            "still manually",
            "too expensive",
            "can't afford",
            "struggling with",
            "looking for a tool"
        ]
    
    def scrape_subreddit(self, subreddit: str, limit: int = 100) -> List[Dict]:
        """Scrape posts from a single subreddit"""
        url = f"https://www.reddit.com/r/{subreddit}/new.json?limit={limit}"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            
            if response.status_code == 200:
                posts = response.json()["data"]["children"]
                results = []
                
                for post in posts:
                    data = post["data"]
                    
                    # Extract post data
                    post_data = {
                        "id": data["id"],
                        "source": "Reddit",
                        "subreddit": f"r/{subreddit}",
                        "title": data["title"],
                        "body": data.get("selftext", ""),
                        "url": f"https://reddit.com{data['permalink']}",
                        "upvotes": data["score"],
                        "comments": data["num_comments"],
                        "created_at": datetime.fromtimestamp(data["created_utc"]).isoformat(),
                        "author": data["author"],
                        "scraped_at": datetime.now().isoformat()
                    }
                    
                    # Check if post contains pain keywords
                    text = f"{post_data['title']} {post_data['body']}".lower()
                    matching_keywords = [kw for kw in self.pain_keywords if kw in text]
                    
                    if matching_keywords:
                        post_data["matching_keywords"] = matching_keywords
                        results.append(post_data)
                
                print(f"✅ Scraped r/{subreddit}: {len(results)}/{len(posts)} posts with pain keywords")
                return results
            else:
                print(f"❌ Error scraping r/{subreddit}: Status {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ Exception scraping r/{subreddit}: {str(e)}")
            return []
    
    def scrape_all(self) -> List[Dict]:
        """Scrape all configured subreddits"""
        all_posts = []
        
        print(f"🔍 Starting Reddit scrape across {len(self.subreddits)} subreddits...")
        
        for subreddit in self.subreddits:
            posts = self.scrape_subreddit(subreddit)
            all_posts.extend(posts)
            time.sleep(2)  # Rate limiting - CRITICAL
        
        print(f"✅ Total posts collected: {len(all_posts)}")
        return all_posts

if __name__ == "__main__":
    scraper = RedditScraper()
    posts = scraper.scrape_all()
    
    # Print sample
    if posts:
        print("\n📊 Sample post:")
        sample = posts[0]
        print(f"Title: {sample['title']}")
        print(f"Subreddit: {sample['subreddit']}")
        print(f"Upvotes: {sample['upvotes']}")
        print(f"Keywords: {sample['matching_keywords']}")
