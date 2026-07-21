import { Document, Page, Text, View, StyleSheet, renderToStream } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2px solid #6c5ce7',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    color: '#0a0b0f',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#8b8d9e',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#6c5ce7',
    marginBottom: 10,
    fontWeight: 'bold',
  },
  summary: {
    fontSize: 12,
    lineHeight: 1.5,
    color: '#1a1b25',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 4,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  col: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: '#8b8d9e',
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 14,
    color: '#0a0b0f',
    fontWeight: 'bold',
  },
  table: {
    display: "table",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderColor: '#e8e9f0',
  },
  tableRow: {
    margin: "auto",
    flexDirection: "row"
  },
  tableCol: {
    width: "25%",
    borderStyle: "solid",
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderColor: '#e8e9f0',
  },
  tableCellHeader: {
    margin: 5,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#5a5c6e',
  },
  tableCell: {
    margin: 5,
    fontSize: 10,
    color: '#1a1b25',
  },
  riskHigh: { color: '#e17055', fontSize: 12, marginBottom: 4, fontWeight: 'bold' },
  riskMedium: { color: '#fdcb6e', fontSize: 12, marginBottom: 4, fontWeight: 'bold' },
  riskLow: { color: '#00b894', fontSize: 12, marginBottom: 4, fontWeight: 'bold' },
  riskDesc: { fontSize: 10, color: '#5a5c6e', marginBottom: 8 },
});

const ReportDocument = ({ report }) => {
  const pipelineSection = report.sections?.find(s => s.type === 'pipeline');
  const revenueSection = report.sections?.find(s => s.type === 'revenue');
  const operationsSection = report.sections?.find(s => s.type === 'operations');
  const risksSection = report.sections?.find(s => s.type === 'risks');
  const sectorsSection = report.sections?.find(s => s.type === 'sectors');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{report.title || 'Leadership Update'}</Text>
          <Text style={styles.date}>Generated on: {new Date(report.generatedAt).toLocaleString()}</Text>
        </View>

        {report.executiveSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <Text style={styles.summary}>{report.executiveSummary}</Text>
          </View>
        )}

        {pipelineSection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pipeline Health</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Total Deals</Text>
                <Text style={styles.value}>{pipelineSection.data.totalDeals}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Pipeline Value</Text>
                <Text style={styles.value}>{pipelineSection.data.formattedPipelineValue}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Weighted Value</Text>
                <Text style={styles.value}>{pipelineSection.data.formattedWeightedValue}</Text>
              </View>
            </View>
            
            {pipelineSection.data.stageBreakdown?.length > 0 && (
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCellHeader}>Stage</Text></View>
                  <View style={{...styles.tableCol, width: '20%'}}><Text style={styles.tableCellHeader}>Count</Text></View>
                  <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCellHeader}>Value</Text></View>
                </View>
                {pipelineSection.data.stageBreakdown.map((stage, i) => (
                  <View style={styles.tableRow} key={i}>
                    <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCell}>{stage.stage}</Text></View>
                    <View style={{...styles.tableCol, width: '20%'}}><Text style={styles.tableCell}>{stage.count}</Text></View>
                    <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCell}>{stage.formattedValue}</Text></View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {revenueSection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Revenue Performance</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Won Revenue</Text>
                <Text style={styles.value}>{revenueSection.data.formattedWonRevenue}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Win Rate</Text>
                <Text style={styles.value}>{revenueSection.data.winRate}%</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Avg Deal Size</Text>
                <Text style={styles.value}>{revenueSection.data.formattedAvgDealSize}</Text>
              </View>
            </View>
          </View>
        )}

        {operationsSection && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Operational Highlights</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>Total WOs</Text>
                <Text style={styles.value}>{operationsSection.data.totalWorkOrders}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Completed</Text>
                <Text style={styles.value}>{operationsSection.data.completedCount}</Text>
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Completion Rate</Text>
                <Text style={styles.value}>{operationsSection.data.completionRate}%</Text>
              </View>
            </View>
          </View>
        )}
      </Page>
      
      {(sectorsSection || risksSection) && (
        <Page size="A4" style={styles.page}>
          {sectorsSection && sectorsSection.data.topSectors?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Sectors</Text>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCellHeader}>Sector</Text></View>
                  <View style={{...styles.tableCol, width: '20%'}}><Text style={styles.tableCellHeader}>Deals</Text></View>
                  <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCellHeader}>Value</Text></View>
                </View>
                {sectorsSection.data.topSectors.map((sector, i) => (
                  <View style={styles.tableRow} key={i}>
                    <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCell}>{sector.name}</Text></View>
                    <View style={{...styles.tableCol, width: '20%'}}><Text style={styles.tableCell}>{sector.dealCount}</Text></View>
                    <View style={{...styles.tableCol, width: '40%'}}><Text style={styles.tableCell}>{sector.formattedDealValue}</Text></View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {risksSection && risksSection.data.riskItems?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Risks & Attention Items</Text>
              {risksSection.data.riskItems.map((risk, i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                  <Text style={
                    risk.severity === 'high' ? styles.riskHigh :
                    risk.severity === 'medium' ? styles.riskMedium :
                    styles.riskLow
                  }>• {risk.title}</Text>
                  <Text style={styles.riskDesc}>{risk.description}</Text>
                </View>
              ))}
            </View>
          )}
        </Page>
      )}
    </Document>
  );
};

export async function generatePDFStream(reportData) {
  return await renderToStream(<ReportDocument report={reportData} />);
}
