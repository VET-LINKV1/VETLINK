/**
 * predictiveController.js
 * HTTP layer for "Predictive Analytics".
 * Admin-only — role gating is enforced upstream in the route.
 */
const predictiveService = require('../services/predictiveService');
const logger = require('../utils/logger');

function readFilters(req) {
  return {
    horizon: req.query.horizon || null,
    band:    req.query.band    || null,
    query:   req.query,
  };
}

const predictiveController = {
  async churn(req, res) {
    try {
      const data = await predictiveService.predictChurn(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('predictive.churn', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async inventory(req, res) {
    try {
      const data = await predictiveService.forecastInventoryDemand(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('predictive.inventory', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async appointments(req, res) {
    try {
      const data = await predictiveService.forecastAppointments(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('predictive.appointments', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async treatmentRisk(req, res) {
    try {
      const data = await predictiveService.predictTreatmentRisk(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('predictive.treatmentRisk', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async summary(req, res) {
    try {
      const data = await predictiveService.getPredictiveSummary(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('predictive.summary', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = predictiveController;
