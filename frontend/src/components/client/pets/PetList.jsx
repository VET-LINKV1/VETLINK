import { PawPrint, Plus } from 'lucide-react';
import PetCard from './PetCard';

function PetList({ pets, onAdd, onEdit, onView }) {
  if (pets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <PawPrint className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="font-display text-slate-600 text-lg font-600 mb-2">No pets registered yet</h3>
        <p className="text-slate-400 font-body text-sm mb-6">
          Add your first pet to start managing their health
        </p>
        <button onClick={onAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-body font-600 text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all">
          <Plus className="w-4 h-4" /> Add Your First Pet
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {pets.map(pet => (
        <PetCard key={pet.id} pet={pet} onEdit={onEdit} onView={onView} />
      ))}
    </div>
  );
}

export default PetList;
