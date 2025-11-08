import { NextRequest, NextResponse } from 'next/server';
import { TweetStream } from '@/lib/tweetStream';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get('since');
    const limitParam = searchParams.get('limit');

    const since = sinceParam ? Number(sinceParam) : undefined;
    const limit = limitParam ? Number(limitParam) : 50;

    const sinceSequence =
      since && Number.isFinite(since) ? since : undefined;
    const tweets = TweetStream.getRecent(limit, sinceSequence);

    return NextResponse.json(
      {
        tweets,
        cursor: tweets.length ? tweets[0].sequence : sinceSequence ?? TweetStream.getLatestSequence()
      },
      {
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching tweet stream:', error);
    return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 });
  }
}
