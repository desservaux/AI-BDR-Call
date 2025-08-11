// Mock db client
const originalDbClient = require('./services/db/dbClient');
const mockClientFactory = () => {
  let step = 0;
  return {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        update() { return this; },
        single() {
          if (step === 0) {
            step = 1;
            return Promise.resolve({ data: {
              id: 'entry-1',
              current_attempt: 1,
              sequences: {
                max_attempts: 5,
                retry_delay_hours: 1,
                timezone: 'America/New_York',
                business_hours_start: '09:00:00',
                business_hours_end: '17:00:00',
                exclude_weekends: true,
              },
            } });
          }
          return Promise.resolve({ data: { id: 'entry-1', status: 'active', next_call_time: new Date().toISOString(), current_attempt: 2 } });
        },
      };
    },
  };
};
require.cache[require.resolve('./services/db/dbClient')].exports = mockClientFactory;

const SequenceService = require('./services/sequences/SequenceService');
(async () => {
  const svc = new SequenceService();
  await svc.initialize();
  const updated = await svc.updateAfterCall('entry-1', { successful: false });
  console.log(JSON.stringify({ ok: true, updated }, null, 2));
})().catch(e => { console.error('ERR', e); process.exit(1); });
