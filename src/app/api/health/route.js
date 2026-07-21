/**
 * Health Check API Route
 * 
 * GET /api/health
 * 
 * Returns the health status of all integrations.
 */

import { healthCheck } from '@/lib/monday/auth';

export async function GET() {
  try {
    const health = await healthCheck();
    return Response.json(health, {
      status: health.healthy ? 200 : 503,
    });
  } catch (err) {
    return Response.json(
      { healthy: false, error: err.message },
      { status: 503 }
    );
  }
}
