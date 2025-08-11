const tz = require('date-fns-tz');
console.log('type', typeof tz);
console.log('keys', Object.keys(tz||{}));
console.log('has utcToZonedTime', typeof (tz&&tz.utcToZonedTime));
console.log('export default keys', tz && tz.default ? Object.keys(tz.default) : []);
