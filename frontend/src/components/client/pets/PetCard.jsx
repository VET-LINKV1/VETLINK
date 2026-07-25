import { PawPrint, Edit2, Eye } from 'lucide-react';

const SPECIES_EMOJI = {
  Dog: '🐕', Cat: '🐈', Bird: '🐦', Rabbit: '🐇',
  Hamster: '🐹', Fish: '🐠', Reptile: '🦎', Other: '🐾',
};

const GENDER_COLORS = {
  male:    'bg-blue-50 text-blue-600 border-blue-200',
  female:  'bg-pink-50 text-pink-600 border-pink-200',
  unknown: 'bg-slate-100 text-slate-500 border-slate-200',
};

function PetCard({ pet, onEdit, onView }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-hover transition-all duration-200 p-5 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl">
          {SPECIES_EMOJI[pet.species] || '🐾'}
        </div>
        <span className={`text-xs font-body font-600 px-2.5 py-1 rounded-lg border capitalize ${GENDER_COLORS[pet.gender] || GENDER_COLORS.unknown}`}>
          {pet.gender}
        </span>
      </div>

      {/* Info */}
      <h3 className="font-display text-slate-800 text-lg font-700 mb-0.5">{pet.name}</h3>
      <p className="text-slate-500 font-body text-sm mb-3">
        {pet.species}{pet.breed ? ` · ${pet.breed}` : ''}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {pet.age != null && (
          <span className="text-xs font-body px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            {pet.age} yr{pet.age !== 1 ? 's' : ''}
          </span>
        )}
        {pet.weight_kg && (
          <span className="text-xs font-body px-2.5 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">
            {pet.weight_kg} kg
          </span>
        )}
      </div>

      {/* Notes preview */}
      {pet.notes && (
        <p className="text-xs font-body text-slate-400 mb-4 line-clamp-2 bg-slate-50 rounded-lg px-3 py-2">
          {pet.notes}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-slate-100">
        <button onClick={() => onView(pet)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-body font-600 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors">
          <Eye className="w-3.5 h-3.5" /> View Profile
        </button>
        <button onClick={() => onEdit(pet)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-body font-600 text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
          <Edit2 className="w-3.5 h-3.5" /> Edit
        </button>
      </div>
    </div>
  );
}

export default PetCard;
