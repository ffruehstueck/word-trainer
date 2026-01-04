import { NextRequest, NextResponse } from 'next/server';
import { getWordsForFile } from '@/lib/data';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const file = searchParams.get('file');

  if (!file) {
    return NextResponse.json({ error: 'File parameter is required' }, { status: 400 });
  }

  try {
    const words = await getWordsForFile(file);
    return NextResponse.json(words);
  } catch (error) {
    console.error('Error loading words:', error);
    return NextResponse.json({ error: 'Failed to load words' }, { status: 500 });
  }
}

