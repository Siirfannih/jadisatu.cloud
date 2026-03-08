"""
Gemini AI Analyzer
Analyzes pain points and scores them for business opportunity
"""

import google.generativeai as genai
from typing import Dict, List
import json

class GeminiAnalyzer:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def analyze_pain_point(self, post: Dict) -> Dict:
        """
        Analyze a single pain point using Gemini AI
        
        Returns enriched post with:
        - pain_score (1-100)
        - category
        - opportunity_level
        - jadisatu_solution
        - target_market
        """
        
        prompt = f"""
Analyze this business pain point and provide a structured assessment:

**Post Title**: {post['title']}
**Post Body**: {post['body']}
**Source**: {post['source']}
**Engagement**: {post['upvotes']} upvotes, {post['comments']} comments

Evaluate this pain point and respond in JSON format with:

1. **pain_score** (1-100): How severe is this pain? Consider:
   - Frequency of the problem
   - Cost/time impact
   - Number of people affected
   - Urgency to solve

2. **category**: Classify into ONE of these:
   - "Budget Gap" (can't afford existing solutions)
   - "Agency Trust Gap" (bad experiences with agencies/freelancers)
   - "Marketing Gap" (social media, content, SEO struggles)
   - "Content Gap" (video, design, copywriting needs)
   - "Design Gap" (branding, UI/UX, visual identity)
   - "SaaS Tool Gap" (missing or expensive software tools)
   - "Workflow Gap" (manual processes, inefficiency)
   - "Other"

3. **opportunity_level**: Rate as "Very High", "High", or "Medium" based on:
   - Market size
   - Willingness to pay
   - Jadisatu's ability to solve it

4. **jadisatu_solution**: Brief description (1-2 sentences) of how Jadisatu could solve this with:
   - Web development
   - Social media management
   - Content creation (video/design)
   - SEO/branding
   - AI automation tools

5. **target_market**: Who experiences this pain? (e.g., "Small businesses", "SaaS founders", "E-commerce stores")

6. **estimated_value**: Rough estimate of what people would pay monthly for a solution (in USD)

7. **urgency**: "High", "Medium", or "Low" - how urgent is this problem?

8. **keywords_extracted**: List of 3-5 key pain point keywords from the post

Respond ONLY with valid JSON. No markdown, no explanations.
"""
        
        try:
            response = self.model.generate_content(prompt)
            
            # Extract JSON from markdown code blocks if present
            response_text = response.text.strip()
            if response_text.startswith('```json'):
                response_text = response_text.replace('```json', '').replace('```', '').strip()
            elif response_text.startswith('```'):
                response_text = response_text.replace('```', '').strip()
            
            # Parse JSON response
            analysis = json.loads(response_text)
            
            # Merge analysis with original post
            enriched_post = {**post, **analysis}
            
            print(f"✅ Analyzed: {post['title'][:50]}... (Score: {analysis['pain_score']})")
            return enriched_post
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error for post {post.get('id', 'unknown')}: {str(e)}")
            print(f"Raw response: {response.text[:200]}")
            
            # Return post with default values
            return {
                **post,
                "pain_score": 50,
                "category": "Other",
                "opportunity_level": "Medium",
                "jadisatu_solution": "Needs manual review",
                "target_market": "Unknown",
                "estimated_value": 0,
                "urgency": "Medium",
                "keywords_extracted": []
            }
            
        except Exception as e:
            print(f"❌ Error analyzing post: {str(e)}")
            return {
                **post,
                "pain_score": 0,
                "category": "Error",
                "opportunity_level": "Medium",
                "jadisatu_solution": "Analysis failed",
                "target_market": "Unknown",
                "estimated_value": 0,
                "urgency": "Medium",
                "keywords_extracted": []
            }
    
    def analyze_batch(self, posts: List[Dict], max_posts: int = 50) -> List[Dict]:
        """
        Analyze multiple posts in batch
        
        Args:
            posts: List of posts to analyze
            max_posts: Maximum number to analyze (to avoid API limits)
        """
        print(f"🤖 Starting Gemini analysis for {min(len(posts), max_posts)} posts...")
        
        analyzed = []
        
        for i, post in enumerate(posts[:max_posts]):
            print(f"Analyzing {i+1}/{min(len(posts), max_posts)}...")
            result = self.analyze_pain_point(post)
            analyzed.append(result)
        
        print(f"✅ Analysis complete: {len(analyzed)} posts analyzed")
        
        # Sort by pain score
        analyzed.sort(key=lambda x: x.get('pain_score', 0), reverse=True)
        
        return analyzed

if __name__ == "__main__":
    # Test
    analyzer = GeminiAnalyzer(api_key=os.environ.get("GEMINI_API_KEY", ""))
    
    test_post = {
        "id": "test1",
        "source": "Reddit",
        "subreddit": "r/entrepreneur",
        "title": "I can't afford a $5000 website for my coffee shop",
        "body": "Every agency I contact wants $3000-5000 for a simple website. I just need a menu and contact page. This is killing small businesses.",
        "upvotes": 450,
        "comments": 67
    }
    
    result = analyzer.analyze_pain_point(test_post)
    print("\n📊 Analysis Result:")
    print(json.dumps(result, indent=2))
