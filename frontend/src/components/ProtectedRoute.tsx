// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../context/AuthContext';
// import { type ReactNode } from 'react';

// interface Props {
//   children: ReactNode;
//   requiredRoles?: string[];
// }

// export default function ProtectedRoute({ children, requiredRoles }: Props) {
//   const { isAuthenticated, isLoading, user } = useAuth();
//   const location = useLocation();

//   if (isLoading) {
//     return (
//       <div className="flex h-screen items-center justify-center bg-gray-50">
//         <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
//       </div>
//     );
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" state={{ from: location }} replace />;
//   }

//   if (requiredRoles && requiredRoles.length > 0) {
//     const hasRole = user?.role_codes.some((r) => requiredRoles.includes(r));
//     if (!hasRole) {
//       return <Navigate to="/dashboard" replace />;
//     }
//   }

//   return <>{children}</>;
// }

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  requiredRoles?: string[];
}

export default function ProtectedRoute({ children, requiredRoles }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRole = user?.role_codes.some((r) => requiredRoles.includes(r));
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}