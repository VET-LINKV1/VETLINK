// Vercel serverless function entry point.
// Wraps the existing Express app as a Node function.
// bodyParser:false is REQUIRED so multer (memory storage) can parse
// multipart uploads on its own — the app handles JSON/urlencoded itself.
const app = require('../backend/src/app');

module.exports = app;
module.exports.config = { api: { bodyParser: false } };
