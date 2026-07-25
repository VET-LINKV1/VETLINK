import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { defaultRouteForRole } from '../App';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    console.log('[ProtectedRoute] not authenticated → /login', { from: location.pathname });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const dest = defaultRouteForRole(user.role);
    console.log('[ProtectedRoute] role not allowed', {
      userRole: user.role,
      required: allowedRoles,
      redirectTo: dest,
    });
    return <Navigate to={dest} replace />;
  }

  return children;
}

export default ProtectedRoute;
