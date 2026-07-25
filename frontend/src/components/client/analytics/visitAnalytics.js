/**
 * visitAnalytics.js
 * Core logic for analyzing pet visit frequency and health consistency.
 */

/**
 * Classify visit frequency for a single pet.
 *
 * Rules:
 *  - 0 visits         → "No Visits Yet"
 *  - 1 visit          → "New Patient"
 *  - Average gap <= 35 days  → "Regular Check-up Maintained"
 *  - Average gap <= 90 days  → "Occasional Visits"
 *  - Average gap > 90 days   → "Irregular Visits"
 */
export function classifyVisitFrequency(appointments) {
  const completed = appointments
    .filter(a => a.status === 'completed' && a.appointment_at)
    .map(a => new Date(a.appointment_at))
    .sort((a, b) => a - b); // oldest first

  const totalVisits = completed.length;

  if (totalVisits === 0) return { classification: 'no_visits',  label: 'No Visits Yet',                 color: 'slate' };
  if (totalVisits === 1) return { classification: 'new_patient', label: 'New Patient',                   color: 'blue' };

  // Calculate average gap in days between consecutive visits
  let totalGapDays = 0;
  for (let i = 1; i < completed.length; i++) {
    const diffMs   = completed[i] - completed[i - 1];
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    totalGapDays  += diffDays;
  }
  const avgGap = totalGapDays / (completed.length - 1);

  if (avgGap <= 35)  return { classification: 'regular',    label: 'Regular Check-up Maintained', color: 'green' };
  if (avgGap <= 90)  return { classification: 'occasional', label: 'Occasional Visits',            color: 'amber' };
  return               { classification: 'irregular',  label: 'Irregular Visits',             color: 'red' };
}

/**
 * Build analytics summary for a single pet.
 */
export function buildPetAnalytics(pet, appointments) {
  const petAppointments = appointments.filter(a => a.pet_id === pet.id);
  const completed = petAppointments.filter(a => a.status === 'completed');

  // Last visit date
  const sortedCompleted = completed
    .filter(a => a.appointment_at)
    .sort((a, b) => new Date(b.appointment_at) - new Date(a.appointment_at));
  const lastVisit = sortedCompleted[0]?.appointment_at || null;

  // Days since last visit
  const daysSinceLast = lastVisit
    ? Math.floor((Date.now() - new Date(lastVisit)) / (1000 * 60 * 60 * 24))
    : null;

  // Frequency classification
  const frequency = classifyVisitFrequency(petAppointments);

  // Visits per month (for chart)
  const visitsByMonth = buildVisitsByMonth(completed);

  return {
    pet,
    totalVisits: completed.length,
    lastVisit,
    daysSinceLast,
    frequency,
    visitsByMonth,
    upcomingCount: petAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length,
  };
}

/**
 * Group completed visits by month for chart rendering.
 * Returns last 6 months.
 */
export function buildVisitsByMonth(completed) {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year:  d.getFullYear(),
      month: d.getMonth(),
      count: 0,
    });
  }

  completed.forEach(appt => {
    if (!appt.appointment_at) return;
    const d = new Date(appt.appointment_at);
    const slot = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
    if (slot) slot.count++;
  });

  return months;
}

/**
 * Build analytics for ALL pets owned by the client.
 */
export function buildAllPetsAnalytics(pets, appointments) {
  return pets.map(pet => buildPetAnalytics(pet, appointments));
}
