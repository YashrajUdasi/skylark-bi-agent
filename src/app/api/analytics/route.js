/**
 * Analytics API Route
 * 
 * GET /api/analytics
 * 
 * Returns the full dashboard summary with KPIs, pipeline, sectors,
 * and quality metrics for the frontend dashboard.
 */

import { getDashboardSummary } from '@/lib/analytics/engine';

export async function GET() {
  try {
    const summary = await getDashboardSummary();
    return Response.json(summary);
  } catch (err) {
    console.error('[Analytics API] Error:', err);
    return Response.json(
      {
        error: true,
        message: err.message || 'Failed to fetch analytics',
        code: err.code || 'ANALYTICS_ERROR',
      },
      { status: 500 }
    );
  }
}
