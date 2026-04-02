import { getSupabaseServerClient } from '../../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseServerClient();

    // Get model version
    const { data: version, error: fetchError } = await supabase
      .from('model_versions')
      .select('*')
      .eq('model_version_id', id)
      .single();

    if (fetchError || !version) {
      return NextResponse.json(
        { error: 'Model version not found' },
        { status: 404 }
      );
    }

    // Set all other versions to archived
    await supabase
      .from('model_versions')
      .update({ status: 'archived' })
      .eq('status', 'production');

    // Set this version to production
    const { error: updateError } = await supabase
      .from('model_versions')
      .update({
        status: 'production',
        deployed_at: new Date().toISOString(),
      })
      .eq('model_version_id', id);

    if (updateError) throw updateError;

    // TODO: In production, would copy model artifacts from versioned folder to /python/ folder
    // For now, this just updates the database status

    return NextResponse.json({
      success: true,
      message: `Deployed model version ${version.version_name} to production`,
      version: version.version_name,
    });
  } catch (error) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
