import { getSupabaseServerClient } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('retraining_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      logs: data || [],
    });
  } catch (error) {
    console.error('Error fetching retraining logs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
