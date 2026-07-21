/**
 * Report API Route
 * 
 * GET /api/report
 * 
 * Generates a leadership update report.
 */

import { generateLeadershipReport } from '@/lib/report/generator';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const focusAreas = searchParams.get('focus') || null;

    const report = await generateLeadershipReport(focusAreas);
    return Response.json(report);
  } catch (err) {
    console.error('[Report API] Error:', err);
    return Response.json(
      {
        error: true,
        message: err.message || 'Failed to generate report',
        code: err.code || 'REPORT_ERROR',
      },
      { status: 500 }
    );
  }
}
