
const { getCleanData } = require('./src/lib/analytics/engine');
const { DEALS_COLUMN_MAP } = require('./src/lib/analytics/column-map');

async function test() {
  const data = await getCleanData(true);
  const deals = data.deals.records;
  
  const stageCol = DEALS_COLUMN_MAP.stage;
  
  const stageCounts = {};
  deals.forEach(d => {
    const s = d[stageCol];
    stageCounts[s] = (stageCounts[s] || 0) + 1;
  });
  
  console.log(stageCounts);
}

test();
