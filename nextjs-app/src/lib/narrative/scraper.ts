import * as cheerio from 'cheerio'

export interface ScrapedArticle {
  title: string
  url: string
  source: string
  snippet: string
  body: string
  publishedAt: string
}

export interface DiscoveryResult {
  articles: ScrapedArticle[]
  query: string
  discoveredAt: string
}

/**
 * Discover recent articles about a topic via Google News RSS.
 */
export async function discoverArticles(
  topic: string,
  maxArticles: number = 5
): Promise<DiscoveryResult> {
  const encoded = encodeURIComponent(topic)
  const rssUrl = `https://news.google.com/rss/search?q=${encoded}&hl=id&gl=ID&ceid=ID:id`

  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JadiSatu/1.0)',
    },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`)
  }

  const xml = await response.text()
  const $ = cheerio.load(xml, { xml: true })

  const articles: ScrapedArticle[] = []

  $('item').each((i, el) => {
    if (i >= maxArticles) return false

    const title = $(el).find('title').text().trim()
    const link = $(el).find('link').text().trim()
    const pubDate = $(el).find('pubDate').text().trim()
    const description = $(el).find('description').text().trim()
    const source = $(el).find('source').text().trim()

    articles.push({
      title,
      url: link,
      source: source || 'Unknown',
      snippet: stripHtml(description),
      body: '',
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    })
  })

  return {
    articles,
    query: topic,
    discoveredAt: new Date().toISOString(),
  }
}

/**
 * Fetch a URL and extract the main article text using cheerio.
 * Returns empty string on failure (paywall, timeout, SPA, etc).
 */
export async function extractArticleText(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JadiSatu/1.0)',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) return ''

    const html = await response.text()
    const $ = cheerio.load(html)

    // Remove noise
    $(
      'script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comments, .social-share, iframe, noscript'
    ).remove()

    // Try common article selectors
    const selectors = [
      'article',
      '[role="main"]',
      '.article-body',
      '.post-content',
      '.entry-content',
      '.content-body',
      'main',
    ]

    let bodyText = ''

    for (const selector of selectors) {
      const el = $(selector)
      if (el.length) {
        bodyText = el.text().trim()
        break
      }
    }

    // Fallback: collect <p> tags
    if (!bodyText || bodyText.length < 100) {
      bodyText = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t.length > 30)
        .join('\n\n')
    }

    return cleanText(bodyText).slice(0, 3000)
  } catch {
    return ''
  }
}

/**
 * Full research pipeline: discover articles + extract text in parallel.
 */
export async function researchTopic(
  topic: string,
  maxArticles: number = 5
): Promise<DiscoveryResult> {
  const discovery = await discoverArticles(topic, maxArticles)

  const results = await Promise.allSettled(
    discovery.articles.map(async (article) => {
      const body = await extractArticleText(article.url)
      return { ...article, body }
    })
  )

  discovery.articles = results
    .filter(
      (r): r is PromiseFulfilledResult<ScrapedArticle> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value)
    .filter((a) => a.body.length > 50 || a.snippet.length > 20)

  return discovery
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
