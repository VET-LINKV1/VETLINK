# Add to backend/src/index.js

const medicalRecordRoutes = require('./routes/medicalRecordRoutes');
app.use('/api/medical-records', medicalRecordRoutes);

# Add to frontend/src/App.jsx

import VetMedicalRecordsPage from './pages/vet/VetMedicalRecordsPage';
import ClientPetsPage        from './pages/client/ClientPetsPage';  // replaces existing

// Staff Dashboard — add /medical-records route:
<Route path="/medical-records" element={
  <ProtectedRoute allowedRoles={['veterinarian']}>
    <DashboardLayout><VetMedicalRecordsPage /></DashboardLayout>
  </ProtectedRoute>
} />

// Client pets route already exists — just replace the import with phase 3 version:
<Route path="/client/pets" element={
  <ProtectedRoute allowedRoles={['client']}>
    <ClientLayout><ClientPetsPage /></ClientLayout>
  </ProtectedRoute>
} />

# Add to Sidebar.jsx (vet nav items):
{ icon: FileText, label: 'Medical Records', to: '/medical-records' }
