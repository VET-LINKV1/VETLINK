/**
 * prescriptiveController.js
 * HTTP layer for "Prescriptive Analytics".
 * Admin / vet only — role gating is enforced upstream in the route.
 */
const prescriptiveService = require('../services/prescriptiveService');
const logger = require('../utils/logger');

function readFilters(req) {
  return {
    horizonDays: req.query.horizonDays || req.query.horizon || null,
    petId:       req.query.petId       || null,
    ownerId:     req.query.ownerId     || null,
    species:     req.query.species     || null,
    query:       req.query,
  };
}

const prescriptiveController = {
  async scheduling(req, res) {
    try {
      const data = await prescriptiveService.recommendScheduling();
      res.json({ success: true, data });
    } catch (err) {
      logger.error('prescriptive.scheduling', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async wellness(req, res) {
    try {
      const data = await prescriptiveService.recommendWellness(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('prescriptive.wellness', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async ordering(req, res) {
    try {
      const data = await prescriptiveService.recommendOrdering(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('prescriptive.ordering', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async summary(req, res) {
    try {
      const data = await prescriptiveService.getPrescriptiveSummary(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('prescriptive.summary', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async save(req, res) {
    try {
      const rows = Array.isArray(req.body?.recommendations) ? req.body.recommendations : [];
      const result = await prescriptiveService.saveRecommendations(rows);
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('prescriptive.save', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = prescriptiveController;
