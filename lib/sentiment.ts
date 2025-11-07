import { eigenai } from './eigenai-provider';
import { generateText } from 'ai';
import { TRADING_CONFIG } from '@/config/trading';

export interface SentimentResult {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  reasoning: string;
  isPositive: boolean;
  tokens: string[];
}

type TokenSentiment = 'bullish' | 'bearish' | 'neutral';

interface TokenSignal {
  token: string;
  sentiment: TokenSentiment;
  conviction: number;
  reasoning: string;
  evidence?: string;
  mentionType?: 'cashtag' | 'ticker' | 'project' | 'narrative' | 'other';
}

function cleanJsonResponse(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/```json\s*/i, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```\s*/i, '').replace(/```$/, '').trim();
  }
  return cleaned;
}

function extractJsonArray(rawText: string): string | null {
  const cleaned = cleanJsonResponse(rawText);
  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    return cleaned;
  }
  const match = cleaned.match(/\[[\s\S]*]/);
  return match ? match[0] : null;
}

export async function analyzeTweetSentiment(tweetText: string): Promise<SentimentResult> {
  console.log('🔍 [SENTIMENT] Starting sentiment analysis...');
  console.log('🔍 [SENTIMENT] Tweet text:', `"${tweetText}"`);

  try {
    console.log('🔍 [SENTIMENT] Calling Eigen AI API for sentiment analysis...');
    const { text } = await generateText({
      model: eigenai('gemma-3-27b-it-q4'),
      messages: [
        {
          role: 'system',
          content: `You are a cryptocurrency sentiment analysis expert. Analyze tweets for their sentiment regarding cryptocurrencies and trading opportunities.

Rules:
1. Classify sentiment as: "bullish", "bearish", or "neutral"
2. Provide confidence score (0-100)
3. Give brief reasoning (1-2 sentences)
4. Focus on trading implications, not general crypto discussion
5. IMPORTANT: Inside JSON string values, never use raw double quotes. Replace any literal quotes with single quotes or escape them (e.g., \"bullish\").

Response format (JSON):
{
  "sentiment": "bullish|bearish|neutral",
  "confidence": 85,
  "reasoning": "Brief explanation of why this sentiment was chosen"
}`
        },
        {
          role: 'user',
          content: `Analyze this tweet for crypto trading sentiment:\n\n"${tweetText}"`
        }
      ],
      maxTokens: 200,
      temperature: 0.1
    });

    console.log('🔍 [SENTIMENT] Eigen AI response:', text);

    // Clean up the response - remove markdown formatting if present
    const cleanedText = cleanJsonResponse(text);

    console.log('🔍 [SENTIMENT] Cleaned response:', cleanedText);

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(cleanedText);
      console.log('🔍 [SENTIMENT] Parsed analysis:', analysis);
    } catch (parseError) {
      console.error('🔍 [SENTIMENT] Failed to parse JSON response:', parseError);
      console.log('🔍 [SENTIMENT] Raw response was:', text);
      console.log('🔍 [SENTIMENT] Cleaned response was:', cleanedText);
      throw parseError;
    }

    // Extract tokens from the tweet
    const tokens = await extractTokenMentions(tweetText);

    const isPositive = analysis.sentiment === 'bullish' && analysis.confidence >= TRADING_CONFIG.minimumConfidence;
    console.log('🔍 [SENTIMENT] Final result:');
    console.log(`   - Sentiment: ${analysis.sentiment}`);
    console.log(`   - Confidence: ${analysis.confidence}%`);
    console.log(`   - Reasoning: ${analysis.reasoning}`);
    console.log(`   - Minimum confidence threshold: ${TRADING_CONFIG.minimumConfidence}%`);
    console.log(`   - Is positive: ${isPositive}`);
    console.log(`   - Tokens found: ${tokens.join(', ')}`);

    return {
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      isPositive,
      tokens
    };

  } catch (error) {
    console.error('❌ [SENTIMENT] Error in Eigen AI sentiment analysis:', error);

    // Fallback to simple analysis if Eigen AI fails
    console.log('🔍 [SENTIMENT] Using fallback analysis...');
    const tokens = await extractTokenMentions(tweetText);
    console.log('🔍 [SENTIMENT] Fallback result: neutral sentiment, no trading');
    return {
      sentiment: 'neutral',
      confidence: 0,
      reasoning: 'Failed to analyze sentiment',
      isPositive: false,
      tokens
    };
  }
}

/**
 * Extract crypto protocols/projects from text using LLM analysis
 */
async function extractCryptoProjects(tweetText: string): Promise<string[]> {
  console.log('🔍 [PROJECTS] Starting crypto project extraction...');
  console.log('🔍 [PROJECTS] Text to analyze:', `"${tweetText}"`);

  try {
    console.log('🔍 [PROJECTS] Calling Eigen AI to extract crypto projects...');
    const { text } = await generateText({
      model: eigenai('gemma-3-27b-it-q4'),
      messages: [
        {
          role: 'system',
          content: `You are a cryptocurrency and DeFi expert. Extract all cryptocurrency protocols, projects, tokens, and chains mentioned in text.

Rules:
1. Include any crypto-related projects (DeFi, Layer 1s, Layer 2s, tokens, protocols, etc.)
2. Include company names building crypto products (e.g., Coinbase, Circle, etc.)
3. Use the actual project names as mentioned in the text
4. Don't include generic terms like "crypto", "blockchain", "DeFi"
5. Be comprehensive - include lesser-known projects too

Response format (JSON array of strings):
["ProjectName1", "ProjectName2", ...]

Examples:
- "EigenCloud" -> ["EigenCloud"]
- "Bitcoin and Ethereum" -> ["Bitcoin", "Ethereum"]
- "Uniswap V3 on Arbitrum" -> ["Uniswap", "Arbitrum"]
- "AAVE lending protocol" -> ["AAVE"]`
        },
        {
          role: 'user',
          content: `Extract crypto projects from: "${tweetText}"`
        }
      ],
      maxTokens: 300,
      temperature: 0.1
    });

    console.log('🔍 [PROJECTS] Raw Eigen AI response:', text);

    // Clean up the response - remove markdown formatting if present
    const cleanedText = cleanJsonResponse(text);

    console.log('🔍 [PROJECTS] Cleaned response:', cleanedText);

    const projects = JSON.parse(cleanedText) as string[];
    const validProjects = Array.isArray(projects) ? projects : [];

    console.log('🔍 [PROJECTS] Extracted projects:', validProjects);
    console.log('🔍 [PROJECTS] Number of projects found:', validProjects.length);

    return validProjects;

  } catch (error) {
    console.error('❌ [PROJECTS] Error extracting crypto projects:', error);
    console.log('🔍 [PROJECTS] Returning empty array due to error');
    return [];
  }
}

/**
 * Map project names to their trading tickers using LLM
 */
const GENERIC_PROJECT_KEYWORDS = new Set([
  'crypto',
  'cryptocurrency',
  'cryptocurrencies',
  'market',
  'markets',
  'token',
  'tokens',
  'project',
  'projects',
  'defi',
  'blockchain',
  'web3'
]);

async function mapProjectsToTickers(projects: string[]): Promise<string[]> {
  console.log('🔍 [TICKERS] Starting project-to-ticker mapping...');
  console.log('🔍 [TICKERS] Projects to map:', projects);

  const filteredProjects = projects.filter(project => !GENERIC_PROJECT_KEYWORDS.has(project.toLowerCase()));

  if (filteredProjects.length === 0) {
    console.log('🔍 [TICKERS] No specific projects to map, returning empty array');
    return [];
  }

  try {
    console.log('🔍 [TICKERS] Calling Eigen AI to map projects to tickers...');
    const { text } = await generateText({
      model: eigenai('gemma-3-27b-it-q4'),
      messages: [
        {
          role: 'system',
          content: `You are a cryptocurrency expert. Map project names to their primary trading ticker symbols.

Rules:
1. Return only ticker symbols that are actively traded on major exchanges
2. Use the most common/primary ticker (e.g., WETH -> ETH, USDC -> USDC)
3. Skip projects without tradeable tokens
4. Use uppercase ticker symbols
5. For projects with multiple tokens, return the main one

Response format (JSON array of strings):
["ETH", "SOL", "EIGEN"]

Common mappings:
- Ethereum -> ETH
- EigenLayer -> EIGEN
- Uniswap -> UNI
- Chainlink -> LINK
- Solana -> SOL
- etc.

IMPORTANT: Do NOT return BTC or Bitcoin - skip Bitcoin-related projects.`
        },
        {
          role: 'user',
          content: `Map these projects to tickers: ${JSON.stringify(filteredProjects)}`
        }
      ],
      maxTokens: 200,
      temperature: 0.1
    });

    console.log('🔍 [TICKERS] Raw Eigen AI response:', text);

    const jsonSegment = extractJsonArray(text);
    if (!jsonSegment) {
      throw new SyntaxError('No JSON array found in response');
    }

    console.log('🔍 [TICKERS] Cleaned response:', jsonSegment);

    const tickers = JSON.parse(jsonSegment) as string[];
    const validTickers = Array.isArray(tickers) ? tickers.filter(t => t && t.length > 0) : [];

    console.log('🔍 [TICKERS] Final mapped tickers:', validTickers);
    console.log('🔍 [TICKERS] Number of tickers mapped:', validTickers.length);

    return validTickers;

  } catch (error) {
    console.error('❌ [TICKERS] Error mapping projects to tickers:', error);
    console.log('🔍 [TICKERS] Returning empty array due to error');
    return [];
  }
}

async function deriveTokenSignals(tweetText: string, seedTokens: string[]): Promise<TokenSignal[]> {
  console.log('🔍 [SIGNALS] Deriving token-level sentiment signals...');
  console.log('🔍 [SIGNALS] Seed tokens:', seedTokens.length ? seedTokens.join(', ') : 'none');

  const seedHint = seedTokens.length ? seedTokens.map(t => t.toUpperCase()).join(', ') : 'none';

  try {
    const { text } = await generateText({
      model: eigenai('gemma-3-27b-it-q4'),
      temperature: 0.15,
      maxTokens: 450,
      messages: [
        {
          role: 'system',
          content: `You are a meticulous crypto trading analyst. Read the tweet and extract only tokens/projects that the author is explicitly bullish on. Ignore vague hype and generic market commentary.

Requirements:
1. A token/project must be clearly referenced (cashtag, ticker, or full name).
2. Only include the token if the sentiment is bullish with supporting language (e.g., "buy", "going higher", "strong", "accumulating"). If sentiment is mixed or unclear, classify as neutral or omit.
3. Output JSON matching:
{
  "signals": [
    {
      "token": "SOL",
      "sentiment": "bullish|bearish|neutral",
      "conviction": 0-100,
      "reasoning": "short explanation referencing the tweet",
      "evidence": "exact quote or paraphrase from tweet",
      "mentionType": "cashtag|ticker|project|narrative"
    }
  ],
  "notes": "brief summary"
}
4. Use uppercase ticker symbols. If only the project name is given, map it to the most common ticker (e.g., Solana -> SOL).
5. Exclude Bitcoin entirely (return no signal for BTC/Bitcoin).`
        },
        {
          role: 'user',
          content: `Tweet:
"""
${tweetText}
"""
Detected tickers from cashtags or heuristics: ${seedHint}

Return the JSON payload only.`
        }
      ]
    });

    const cleanedText = cleanJsonResponse(text);
    console.log('🔍 [SIGNALS] Raw response:', cleanedText);

    const parsed = JSON.parse(cleanedText) as { signals?: TokenSignal[] };
    const signals = Array.isArray(parsed?.signals) ? parsed.signals : [];

    const normalizedSignals = signals
      .map(signal => {
        const token = (signal.token ?? '').toUpperCase().trim();
        const sentiment = (signal.sentiment ?? '').toLowerCase() as TokenSentiment;
        const conviction = Number(signal.conviction ?? 0);
        return {
          token,
          sentiment: ['bullish', 'bearish', 'neutral'].includes(sentiment) ? sentiment : 'neutral',
          conviction: Number.isFinite(conviction) ? conviction : 0,
          reasoning: signal.reasoning ?? '',
          evidence: signal.evidence ?? '',
          mentionType: signal.mentionType ?? 'other'
        } as TokenSignal;
      })
      .filter(signal => signal.token.length > 0);

    console.log('🔍 [SIGNALS] Normalized signals:', normalizedSignals);
    return normalizedSignals;
  } catch (error) {
    console.error('❌ [SIGNALS] Failed to derive token signals:', error);

    // fallback to seed tokens as neutral references
    return seedTokens.map(token => ({
      token: token.toUpperCase(),
      sentiment: 'neutral',
      conviction: 0,
      reasoning: 'Fallback after signal extraction failure',
      mentionType: 'cashtag'
    }));
  }
}

/**
 * Enhanced token extraction using LLM analysis
 */
export async function extractTokenMentions(tweetText: string): Promise<string[]> {
  console.log('🔍 [TOKENS] ===== STARTING TOKEN EXTRACTION =====');
  console.log('🔍 [TOKENS] Input text:', `"${tweetText}"`);

  try {
    // Step 1: Extract cashtags first (fast, reliable)
    console.log('🔍 [TOKENS] Step 1: Extracting cashtags...');
    const cashtags: string[] = [];
    const cashtagPattern = /\$([A-Z]{2,10})\b/g;
    let match;
    while ((match = cashtagPattern.exec(tweetText)) !== null) {
      cashtags.push(match[1]);
    }
    console.log('🔍 [TOKENS] Cashtags found:', cashtags.length > 0 ? cashtags : 'none');

    // Step 2: Use LLM to extract crypto projects
    console.log('🔍 [TOKENS] Step 2: Analyzing text for crypto projects...');
    const projects = await extractCryptoProjects(tweetText);
    console.log(`🔍 [TOKENS] Projects found: ${projects.length > 0 ? projects.join(', ') : 'none'}`);

    // Step 3: Map projects to tickers
    let tickers: string[] = [];
    if (projects.length > 0) {
      console.log('🔍 [TOKENS] Step 3: Mapping projects to tickers...');
      tickers = await mapProjectsToTickers(projects);
      console.log(`🔍 [TOKENS] Tickers mapped: ${tickers.length > 0 ? tickers.join(', ') : 'none'}`);
    } else {
      console.log('🔍 [TOKENS] Step 3: Skipping ticker mapping (no projects found)');
    }

    // Combine cashtags and LLM-derived tickers
    const allTokens = [...new Set([...cashtags, ...tickers])];
    console.log('🔍 [TOKENS] Final combined tokens:', allTokens.length > 0 ? allTokens : 'none');
    console.log('🔍 [TOKENS] ===== TOKEN EXTRACTION COMPLETE =====');

    return allTokens;

  } catch (error) {
    console.error('❌ [TOKENS] Error in enhanced token extraction:', error);

    // Fallback to simple cashtag extraction
    console.log('🔍 [TOKENS] Using fallback cashtag extraction...');
    const tokens: string[] = [];
    const cashtagPattern = /\$([A-Z]{2,10})\b/g;
    let match;
    while ((match = cashtagPattern.exec(tweetText)) !== null) {
      tokens.push(match[1]);
    }
    console.log('🔍 [TOKENS] Fallback tokens found:', tokens.length > 0 ? tokens : 'none');
    console.log('🔍 [TOKENS] ===== TOKEN EXTRACTION COMPLETE (FALLBACK) =====');
    return tokens;
  }
}

export async function shouldTrade(tweetText: string, tokens: string[]): Promise<{ shouldTrade: boolean; reason: string; tokens: string[]; sentimentData?: SentimentResult }> {
  console.log('🔍 [TRADE_DECISION] ===== STARTING TRADE DECISION =====');
  console.log('🔍 [TRADE_DECISION] Seed tokens:', tokens.length ? tokens : 'none');

  const sentimentResult = await analyzeTweetSentiment(tweetText);
  const tokenSignals = await deriveTokenSignals(tweetText, tokens);

  console.log('🔍 [TRADE_DECISION] Aggregated sentiment:', sentimentResult.sentiment, sentimentResult.confidence);
  console.log('🔍 [TRADE_DECISION] Token signals:', tokenSignals);

  if (!tokenSignals.length) {
    console.log('🔍 [TRADE_DECISION] ❌ No explicit token mentions with sentiment - NO TRADE');
    return {
      shouldTrade: false,
      reason: 'No confident token mentions were found in the tweet',
      tokens: [],
      sentimentData: sentimentResult
    };
  }

  const overallPositive = sentimentResult.isPositive && sentimentResult.sentiment !== 'bearish';

  const bullishSignals = tokenSignals.filter(signal =>
    signal.sentiment === 'bullish' && signal.conviction >= TRADING_CONFIG.minimumConfidence
  );

  if (!bullishSignals.length) {
    const strongest = tokenSignals.reduce<TokenSignal | null>((best, current) => {
      if (!best || current.conviction > best.conviction) return current;
      return best;
    }, null);

    const reason = strongest
      ? `No bullish conviction. Strongest signal was ${strongest.token} (${strongest.sentiment} ${strongest.conviction}): ${strongest.reasoning}`
      : 'No bullish conviction across tokens';

    return {
      shouldTrade: false,
      reason,
      tokens: [],
      sentimentData: sentimentResult
    };
  }

  const tokenOverride = !overallPositive && bullishSignals.length > 0 && sentimentResult.confidence === 0;

  if (!overallPositive && !tokenOverride) {
    console.log('🔍 [TRADE_DECISION] ❌ Overall tweet sentiment not bullish enough - NO TRADE');
    return {
      shouldTrade: false,
      reason: `${sentimentResult.sentiment.toUpperCase()} sentiment (${sentimentResult.confidence}% confidence): ${sentimentResult.reasoning}`,
      tokens: [],
      sentimentData: sentimentResult
    };
  }

  const finalTokens = Array.from(new Set(bullishSignals.map(signal => signal.token)));
  const reasonDetails = bullishSignals
    .map(signal => `${signal.token} (${signal.conviction}%): ${signal.reasoning}`)
    .join(' | ');

  console.log('🔍 [TRADE_DECISION] ✅ Bullish tokens approved:', finalTokens);
  console.log('🔍 [TRADE_DECISION] ===== TRADE DECISION COMPLETE =====');

  return {
    shouldTrade: true,
    reason: `Bullish signals: ${reasonDetails}`,
    tokens: finalTokens,
    sentimentData: sentimentResult
  };
}
