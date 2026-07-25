# Add to frontend/src/App.jsx

## 1. Add imports at top:
```js
import StaffRegisterPage  from './pages/staff/StaffRegisterPage';
import StaffVerifyOTPPage from './pages/staff/StaffVerifyOTPPage';
```

## 2. Add routes inside <Routes>:
```jsx
{/* Staff Registration (internal) */}
<Route path="/staff/register"   element={<StaffRegisterPage />} />
<Route path="/staff/verify-otp" element={<StaffVerifyOTPPage />} />
```

# Add to backend/src/index.js

## 1. Add import:
```js
const staffAuthRoutes = require('./routes/staffAuthRoutes');
```

## 2. Add route:
```js
app.use('/api/staff', staffAuthRoutes);
```

# Add to backend/.env:
```env
SMS_PROVIDER=console
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

# Install backend dependencies:
```bash
cd backend
npm install bcryptjs twilio
```
