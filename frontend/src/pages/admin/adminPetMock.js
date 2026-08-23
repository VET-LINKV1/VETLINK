/**
 * adminPetMock.js — realistic mock data for the Admin Pet Records page.
 * Used as a fallback when the backend /api/admin/pets endpoints are not
 * yet connected, so the UI is fully demonstrable standalone.
 */

const OWNERS = [
  { id: 'o1', name: 'Maria Reyes',     phone_number: '+63 917 123 4567', email: 'maria.reyes@email.com' },
  { id: 'o2', name: 'Jonathan Cruz',   phone_number: '+63 920 555 0188', email: 'jon.cruz@email.com' },
  { id: 'o3', name: 'Angela Mendoza',  phone_number: '+63 912 888 2233', email: 'angela.m@email.com' },
  { id: 'o4', name: 'Paolo Rivera',    phone_number: '+63 998 441 7766', email: 'paolo.rivera@email.com' },
  { id: 'o5', name: 'Sofia Santos',    phone_number: '+63 905 221 9988', email: 'sofia.santos@email.com' },
  { id: 'o6', name: 'Diego Torres',    phone_number: '+63 939 770 1122', email: 'diego.torres@email.com' },
];

const VETS = ['Dr. Elena Cruz', 'Dr. Raphael Tan', 'Dr. Sofia Lim', 'Dr. Marco Bautista'];

const SPECIES = ['Dog', 'Cat', 'Bird', 'Rabbit'];
const BREEDS = {
  Dog:  ['Golden Retriever', 'Labrador', 'Shih Tzu', 'Bulldog', 'Beagle', 'Poodle'],
  Cat:  ['Persian', 'Siamese', 'Maine Coon', 'Bengal', 'Domestic Shorthair'],
  Bird: ['African Grey', 'Cockatiel', 'Lovebird'],
  Rabbit: ['Holland Lop', 'Netherland Dwarf', 'Lionhead'],
};
const STATUSES = [
  { vax: 'up_to_date',    active: true },
  { vax: 'expiring_soon', active: true },
  { vax: 'overdue',       active: true },
  { vax: 'up_to_date',    active: false },
  { vax: 'expiring_soon', active: false },
];

const NAMES = [
  'Bella', 'Max', 'Luna', 'Rocky', 'Coco', 'Thor', 'Panda', 'Shadow', 'Boomer',
  'Mochi', 'Kiki', 'Oreo', 'Simba', 'Nala', 'Buddy', 'Daisy', 'Charlie', 'Milo',
  'Lola', 'Ziggy', 'Pepper', 'Gizmo', 'Willow', 'Cooper', 'Ruby', 'Rex',
];

function pick(arr, i) { return arr[i % arr.length]; }

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// Deterministic pseudo-random based on index.
function rand(i, mod) { return (i * 9301 + 49297) % mod; }

export function buildMockPets(count = 48) {
  const pets = [];
  for (let i = 0; i < count; i++) {
    const species = pick(SPECIES, i);
    const breed = pick(BREEDS[species], i * 3);
    const st = pick(STATUSES, i);
    const owner = pick(OWNERS, i);
    const age = 1 + rand(i, 14);
    const weight = ( (species === 'Dog' ? 18 : species === 'Cat' ? 4 : 1) + rand(i, 8) ).toFixed(1);
    const regDays = rand(i, 540);
    const lastVisitDays = st.active ? rand(i, 200) : rand(i, 600) + 400;
    const id = `PHV-${String(1000 + i)}`;

    pets.push({
      id: `pet-${i}`,
      displayId: id,
      owner_id: owner.id,
      name: NAMES[i % NAMES.length],
      species,
      breed,
      age,
      gender: i % 2 === 0 ? 'male' : 'female',
      weight_kg: Number(weight),
      color: pick(['Golden', 'Black', 'White', 'Brindle', 'Calico', 'Grey', 'Brown'], i),
      microchip_no: `9${String(100000000 + i * 137).slice(0, 9)}`,
      created_at: daysAgo(regDays),
      updated_at: daysAgo(Math.min(regDays, lastVisitDays)),
      ownerName: owner.name,
      ownerContact: owner.phone_number,
      assignedVet: pick(VETS, i),
      lastVisit: daysAgo(lastVisitDays),
      vaccinationStatus: st.vax,
    });
  }
  return pets;
}

export function buildMockStats(pets = buildMockPets()) {
  const total = pets.length;
  const active = pets.filter(p => p.lastVisit && new Date(p.lastVisit) > new Date(Date.now() - 540 * 864e5)).length;
  const dogs = pets.filter(p => p.species === 'Dog').length;
  const cats = pets.filter(p => p.species === 'Cat').length;
  const due = pets.filter(p => p.vaccinationStatus === 'expiring_soon' || p.vaccinationStatus === 'overdue').length;
  const attn = pets.filter(p => p.vaccinationStatus === 'overdue').length;
  return { total, active, dogs, cats, vaccinationsDue: due, requiresAttention: attn };
}

export const MOCK_OWNERS = OWNERS;

export default { buildMockPets, buildMockStats, MOCK_OWNERS };
