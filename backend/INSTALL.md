# Section 1 — Required packages

Run in your backend folder:

```bash
npm install bcryptjs twilio
```

# New .env variables to add to backend/.env:

```env
# SMS Provider (use 'console' for dev, 'twilio' for production)
SMS_PROVIDER=console

# Twilio (only needed when SMS_PROVIDER=twilio)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

# Register new routes in backend/src/index.js:

Add this line with the other route imports:
```js
const staffAuthRoutes = require('./routes/staffAuthRoutes');
```

Add this line with the other app.use() calls:
```js
app.use('/api/staff', staffAuthRoutes);
```

# Register new pages in frontend/src/App.jsx:

Add imports:
```js
import StaffRegisterPage  from './pages/staff/StaffRegisterPage';
import StaffVerifyOTPPage from './pages/staff/StaffVerifyOTPPage';
```

Add routes inside <Routes>:
```jsx
<Route path="/staff/register"   element={<StaffRegisterPage />} />
<Route path="/staff/verify-otp" element={<StaffVerifyOTPPage />} />
```
