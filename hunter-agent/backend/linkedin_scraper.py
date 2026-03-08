"""
LinkedIn Scraper using Apify API
Scrapes LinkedIn posts for business pain points
"""

import requests
from typing import List, Dict
from datetime import datetime
import time
class LinkedInScraper:
    def __init__(self, api_token: str):
        self.api_token = api_token
        self.base_url = "https://api.apify.com/v2"
        
        # High-value pain point keywords
        self.pain_keywords = [
            "frustrated with",
            "I wish there was",
            "still manually",
            "no good tool",
            "too expensive",
            "can't afford",
            "need a better way",
            "waste time",
            "tired of",
            "struggling with",
            "looking for a tool",
            "is there a tool",
            "any tool that",
            "cheaper alternative",
            "affordable solution"
        ]
    
    def scrape_posts(self, search_queries: List[str] = None) -> List[Dict]:
        """
        Scrape LinkedIn posts using Apify
        
        Args:
            search_queries: List of search terms to look for
        """
        if search_queries is None:
            # Default searches focused on business pain points
            search_queries = [
                "frustrated with business tools",
                "I wish there was a tool for",
                "still manually doing",
                "no good tool for",
                "too expensive software",
                "need affordable solution",
                "struggling with workflow"
            ]
        
        all_posts = []
        
        print(f"🔍 Starting LinkedIn scrape with {len(search_queries)} queries...")
        
        for query in search_queries:
            try:
                # Apify actor run endpoint
                # Using apimaestro/linkedin-posts-search-scraper-no-cookies
                
                actor_input = {
                    "searchKeyword": query,
                    "maxItems": 50,
                    "sortBy": "date_posted"
                }
                
                # Start actor run
                run_url = f"{self.base_url}/acts/apimaestro~linkedin-posts-search-scraper-no-cookies/runs"
                headers = {"Authorization": f"Bearer {self.api_token}"}
                
                response = requests.post(
                    run_url,
                    json=actor_input,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 201:
                    run_id = response.json()["data"]["id"]
                    print(f"✅ Started Apify run for query: {query}. ID: {run_id}")
                    
                    # Poll for completion
                    while True:
                        status_url = f"{self.base_url}/actor-runs/{run_id}"
                        status_response = requests.get(status_url, headers=headers)
                        if status_response.status_code != 200:
                            print(f"⚠️ Error checking status: {status_response.status_code}")
                            time.sleep(5)
                            continue
                            
                        status_data = status_response.json()["data"]
                        status = status_data["status"]
                        
                        if status == "SUCCEEDED":
                            break
                        elif status in ["FAILED", "ABORTED", "TIMED-OUT"]:
                            print(f"❌ Run failed/stopped with status: {status}")
                            break
                            
                        print(f"⏳ Run status: {status}. Waiting 5s...")
                        time.sleep(5)
                    
                    if status != "SUCCEEDED":
                        continue

                    # Get results (you may need to poll for completion)
                    # This is simplified - in production, poll until status is SUCCEEDED
                    results_url = f"{self.base_url}/actor-runs/{run_id}/dataset/items"
                    results = requests.get(results_url, headers=headers).json()
                    
                    # Process results
                    for item in results:

                        post_data = {
                            "id": item.get("id", ""),
                            "source": "LinkedIn",
                            "platform": "LinkedIn",
                            "title": item.get("text", "")[:200],  # First 200 chars as title
                            "body": item.get("text", ""),
                            "url": item.get("url", ""),
                            "upvotes": item.get("likes", 0),
                            "comments": item.get("comments", 0),
                            "author": item.get("author", {}).get("name", "Unknown"),
                            "scraped_at": datetime.now().isoformat()
                        }
                        
                        # Check for pain keywords
                        text = post_data["body"].lower()
                        matching_keywords = [kw for kw in self.pain_keywords if kw in text]
                        
                        if matching_keywords:
                            post_data["matching_keywords"] = matching_keywords
                            all_posts.append(post_data)
                
                else:
                    print(f"❌ Error starting Apify run: {response.status_code}")
                    
            except Exception as e:
                print(f"❌ Exception scraping LinkedIn: {str(e)}")
        
        print(f"✅ Total LinkedIn posts collected: {len(all_posts)}")
        return all_posts

if __name__ == "__main__":
    # Test with your Apify token
    scraper = LinkedInScraper(api_token=os.environ.get("APIFY_TOKEN", ""))
    posts = scraper.scrape_posts()
    
    if posts:
        print("\n📊 Sample post:")
        sample = posts[0]
        print(f"Title: {sample['title']}")
        print(f"Keywords: {sample['matching_keywords']}")
