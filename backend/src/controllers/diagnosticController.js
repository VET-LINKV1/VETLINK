/**
 * diagnosticController.js
 * HTTP layer for "Diagnostic Analytics (Root Cause)".
 * Admin-only — role gating is enforced upstream in the route.
 */
const diagnosticService = require('../services/diagnosticService');
const logger = require('../utils/logger');

function readFilters(req) {
  return {
    startDate: req.query.startDate || null,
    endDate:   req.query.endDate   || null,
    minCohort: req.query.minCohort || null,
  };
}

const diagnosticController = {
  async churn(req, res) {
    try {
      const data = await diagnosticService.getChurnAnalysis(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('diagnostic.churn', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async treatment(req, res) {
    try {
      const data = await diagnosticService.getTreatmentEffectiveness(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('diagnostic.treatment', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async shrinkage(req, res) {
    try {
      const data = await diagnosticService.getInventoryShrinkage(readFilters(req));
      res.json({ success: true, data });
    } catch (err) {
      logger.error('diagnostic.shrinkage', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },

  /**
   * Convenience all-in-one: returns { churn, treatment, shrinkage } for the
   * same window in parallel. Heavier — only used by the landing-page summary.
   */
  async summary(req, res) {
    try {
      const filters = readFilters(req);
      const [churn, treatment, shrinkage] = await Promise.all([
        diagnosticService.getChurnAnalysis(filters),
        diagnosticService.getTreatmentEffectiveness(filters),
        diagnosticService.getInventoryShrinkage(filters),
      ]);
      res.json({
        success: true,
        data: {
          window: churn.window,
          churn,
          treatment,
          shrinkage,
        },
      });
    } catch (err) {
      logger.error('diagnostic.summary', err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = diagnosticController;
