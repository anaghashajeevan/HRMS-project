// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from './assets/vite.svg'
// import heroImg from './assets/hero.png'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <section id="center">
//         <div className="hero">
//           <img src={heroImg} className="base" width="170" height="179" alt="" />
//           <img src={reactLogo} className="framework" alt="React logo" />
//           <img src={viteLogo} className="vite" alt="Vite logo" />
//         </div>
//         <div>
//           <h1>Get started</h1>
//           <p>
//             Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
//           </p>
//         </div>
//         <button
//           type="button"
//           className="counter"
//           onClick={() => setCount((count) => count + 1)}
//         >
//           Count is {count}
//         </button>
//       </section>

//       <div className="ticks"></div>

//       <section id="next-steps">
//         <div id="docs">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#documentation-icon"></use>
//           </svg>
//           <h2>Documentation</h2>
//           <p>Your questions, answered</p>
//           <ul>
//             <li>
//               <a href="https://vite.dev/" target="_blank">
//                 <img className="logo" src={viteLogo} alt="" />
//                 Explore Vite
//               </a>
//             </li>
//             <li>
//               <a href="https://react.dev/" target="_blank">
//                 <img className="button-icon" src={reactLogo} alt="" />
//                 Learn more
//               </a>
//             </li>
//           </ul>
//         </div>
//         <div id="social">
//           <svg className="icon" role="presentation" aria-hidden="true">
//             <use href="/icons.svg#social-icon"></use>
//           </svg>
//           <h2>Connect with us</h2>
//           <p>Join the Vite community</p>
//           <ul>
//             <li>
//               <a href="https://github.com/vitejs/vite" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#github-icon"></use>
//                 </svg>
//                 GitHub
//               </a>
//             </li>
//             <li>
//               <a href="https://chat.vite.dev/" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#discord-icon"></use>
//                 </svg>
//                 Discord
//               </a>
//             </li>
//             <li>
//               <a href="https://x.com/vite_js" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#x-icon"></use>
//                 </svg>
//                 X.com
//               </a>
//             </li>
//             <li>
//               <a href="https://bsky.app/profile/vite.dev" target="_blank">
//                 <svg
//                   className="button-icon"
//                   role="presentation"
//                   aria-hidden="true"
//                 >
//                   <use href="/icons.svg#bluesky-icon"></use>
//                 </svg>
//                 Bluesky
//               </a>
//             </li>
//           </ul>
//         </div>
//       </section>

//       <div className="ticks"></div>
//       <section id="spacer"></section>
//     </>
//   )
// }

// export default App


import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Unauthorized from './pages/Unauthorized';
import EmployeeList from './pages/employees/EmployeeList';
import EmployeeDetailPage from './pages/employees/EmployeeDetail';
import EmployeeForm from './pages/employees/EmployeeForm';
import RolesPage from './pages/settings/Roles';
import DepartmentsPage from './pages/settings/Departments';
import PositionsPage from './pages/settings/Positions';
import EmployeeCodeSettingsPage from './pages/settings/EmployeeCode';
import ProfilePage from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px' } }} />

        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Everyone (authenticated) */}
          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />

          {/* Employees — HR, Manager, System Admin */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
                <EmployeeList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/new"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <EmployeeForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
                <EmployeeDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id/edit"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <EmployeeForm />
              </ProtectedRoute>
            }
          />

          {/* Settings — Roles: SYSTEM_ADMIN only */}
          <Route
            path="/settings/roles"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
                <RolesPage />
              </ProtectedRoute>
            }
          />

          {/* Settings — Employee Code: SYSTEM_ADMIN only */}
          <Route
            path="/settings/employee-code"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
                <EmployeeCodeSettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Settings — Departments/Positions: SYSTEM_ADMIN + HR_ADMIN */}
          <Route
            path="/settings/departments"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <DepartmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/positions"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <PositionsPage />
              </ProtectedRoute>
            }
          />
          <Route
  path="/profile"
  element={
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  }
/>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}