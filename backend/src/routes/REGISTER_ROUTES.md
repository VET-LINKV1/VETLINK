# Add to backend/src/index.js

## Import:
const vetScheduleRoutes = require('./routes/vetScheduleRoutes');

## Register:
app.use('/api/vet-schedule', vetScheduleRoutes);
