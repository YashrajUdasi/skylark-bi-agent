import { generateLeadershipReport } from '@/lib/report/generator';
import { generatePDFStream } from '@/lib/report/pdf-export';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const focusAreas = searchParams.get('focus') || null;

    // Generate the report data
    const reportData = await generateLeadershipReport(focusAreas);
    
    // Generate the PDF stream
    const pdfStream = await generatePDFStream(reportData);
    
    // Return the PDF response
    return new Response(pdfStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Leadership_Update_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[PDF Export API] Error:', err);
    return Response.json(
      { error: true, message: 'Failed to generate PDF report' },
      { status: 500 }
    );
  }
}
