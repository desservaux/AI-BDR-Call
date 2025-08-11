const BusinessHoursService = require('./services/business-hours');
(async () => {
  const svc = new BusinessHoursService();
  await svc.initialize();
  const bh = { timezone: 'America/New_York', business_hours_start: '09:00:00', business_hours_end: '17:00:00', exclude_weekends: true };
  const within = svc.isWithinBusinessHours(new Date('2023-03-10T20:30:00Z'), bh);
  const next = svc.calculateNextBusinessHoursTime(new Date('2023-03-10T23:00:00Z'), bh);
  const add = svc.addHoursRespectingBusinessHours(new Date('2023-03-10T20:30:00Z'), 2, bh);
  console.log(JSON.stringify({ within, next: next && next.toISOString(), add: add && add.toISOString() }, null, 2));
})().catch(e => { console.error('ERR', e); process.exit(1); });
