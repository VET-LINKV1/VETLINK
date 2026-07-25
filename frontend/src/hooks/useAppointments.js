import { useState, useEffect, useCallback } from 'react';
import { clientService } from '../services/clientService';

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientService.getAppointments();
      setAppointments(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const bookAppointment = useCallback(async (payload) => {
    const appt = await clientService.bookAppointment(payload);
    setAppointments(prev => [appt, ...prev]);
    return appt;
  }, []);

  const cancelAppointment = useCallback(async (id) => {
    await clientService.cancelAppointment(id);
    setAppointments(prev =>
      prev.map(a => a.id === id ? { ...a, status: 'cancelled' } : a)
    );
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  return { appointments, loading, error, fetchAppointments, bookAppointment, cancelAppointment };
}
