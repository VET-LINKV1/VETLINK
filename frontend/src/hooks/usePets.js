import { useState, useEffect, useCallback } from 'react';
import { clientService } from '../services/clientService';

export function usePets() {
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await clientService.getPets();
      setPets(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addPet = useCallback(async (petData) => {
    const newPet = await clientService.addPet(petData);
    setPets(prev => [newPet, ...prev]);
    return newPet;
  }, []);

  const updatePet = useCallback(async (id, petData) => {
    const updated = await clientService.updatePet(id, petData);
    setPets(prev => prev.map(p => p.id === id ? updated : p));
    return updated;
  }, []);

  useEffect(() => { fetchPets(); }, [fetchPets]);

  return { pets, loading, error, fetchPets, addPet, updatePet };
}
