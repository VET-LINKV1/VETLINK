/**
 * test-sms.js — quick live check of the SMS provider chain.
 * Loads backend/.env, then sends a test notification via smsService.
 * Run: node test-sms.js <phone-number>
 * e.g. node test-sms.js +63917XXXXXXX
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const smsService = require('./src/services/smsService');

const phone = process.argv[2];
if (!phone) {
  console.error('Usage: node test-sms.js <phone-number>   e.g. +639661305515');
  process.exit(1);
}

(async () => {
  console.log('Active provider:', smsService.provider());
  console.log('isLive:', smsService.isLive());
  console.log(`Sending test SMS to ${phone} ...`);
  const result = await smsService.sendNotification(
    phone,
    'VETLINK test message — if you received this, SMS is working.'
  );
  console.log('Result:', result);
  if (result.delivered) {
    console.log('SUCCESS ✅ SMS delivered via', result.provider);
  } else {
    console.log('FAILED ❌ provider:', result.provider, result.error || '');
  }
  process.exit(result.delivered ? 0 : 1);
})();
