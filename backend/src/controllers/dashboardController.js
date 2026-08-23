const dashboardService = require('../services/dashboardService');

const dashboardController = {
  /**
   * GET /api/dashboard/overview
   * Returns the full dashboard payload in one call: kpis, appointments,
   * actions, trends, revenue, vets, lab, prescriptions, capacity, activity,
   * system. Frontend spreads this into the 12 sections.
   */
  async overview(req, res) {
    try {
      const [kpis, appointments, actions, trends, revenue, vets, lab, prescriptions, capacity, activity, system] =
        await Promise.all([
          dashboardService.getKpis(),
          dashboardService.getAppointments(),
          dashboardService.getActions(),
          dashboardService.getTrends(req.query.period || '7 Days'),
          dashboardService.getRevenue(),
          dashboardService.getVets(),
          dashboardService.getLab(),
          dashboardService.getPrescriptions(),
          dashboardService.getCapacity(),
          dashboardService.getActivity(),
          dashboardService.getSystem(),
        ]);

      res.json({
        success: true,
        data: {
          kpis,
          appointments,
          actions,
          trends,
          revenue,
          vets,
          lab,
          prescriptions,
          capacity,
          activity,
          system,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};

module.exports = dashboardController;
