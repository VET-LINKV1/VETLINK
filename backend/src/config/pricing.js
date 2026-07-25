/**
 * pricing.js
 * Single source of truth for service prices. Edit here to change fees.
 * Stored in centavos (PHP × 100) — PayMongo's native unit.
 */
const SERVICE_PRICES = {
  'General Checkup':         50000,   // ₱500
  'Vaccination':             80000,   // ₱800
  'Surgery Consultation':    150000,  // ₱1,500
  'Grooming':                60000,   // ₱600
  'Dental Cleaning':         120000,  // ₱1,200
  'Dermatology':             100000,  // ₱1,000
  'Follow-up Visit':         30000,   // ₱300
  'Emergency':               200000,  // ₱2,000
  'Other':                   50000,   // ₱500
};

/** Service name → centavos (returns null if unknown). */
function getPrice(serviceName) {
  if (!serviceName) return null;
  return Object.prototype.hasOwnProperty.call(SERVICE_PRICES, serviceName)
    ? SERVICE_PRICES[serviceName]
    : null;
}

/** Centavos → display string (e.g. 50000 → "₱500.00"). */
function formatPHP(centavos) {
  if (typeof centavos !== 'number' || isNaN(centavos)) return '—';
  return '₱' + (centavos / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** All services with display label + centavos + display price. */
function listServices() {
  return Object.entries(SERVICE_PRICES).map(([name, centavos]) => ({
    name,
    centavos,
    displayPrice: formatPHP(centavos),
  }));
}

module.exports = { SERVICE_PRICES, getPrice, formatPHP, listServices };
