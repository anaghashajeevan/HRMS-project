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


// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { Toaster } from 'react-hot-toast';
// import { AuthProvider } from './context/AuthContext';
// import ProtectedRoute from './components/ProtectedRoute';
// import Login from './pages/Login';
// import ForgotPassword from './pages/ForgotPassword';
// import Dashboard from './pages/Dashboard';
// import Unauthorized from './pages/Unauthorized';
// import EmployeeList from './pages/employees/EmployeeList';
// import EmployeeDetailPage from './pages/employees/EmployeeDetail';
// import EmployeeForm from './pages/employees/EmployeeForm';
// import RolesPage from './pages/settings/Roles';
// import DepartmentsPage from './pages/settings/Departments';
// import PositionsPage from './pages/settings/Positions';
// import EmployeeCodeSettingsPage from './pages/settings/EmployeeCode';
// import ProfilePage from './pages/Profile';
// import ApprovalWorkflowSettingsPage from './pages/settings/ApprovalWorkflowSettingsPage';
// import 'react-quill-new/dist/quill.snow.css';

// export default function App() {
//   return (
//     <BrowserRouter>
//       <AuthProvider>
//         <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px' } }} />

//         <Routes>
//           {/* Public */}
//           <Route path="/login" element={<Login />} />
//           <Route path="/forgot-password" element={<ForgotPassword />} />
//           <Route path="/unauthorized" element={<Unauthorized />} />

//           {/* Everyone (authenticated) */}
//           <Route
//             path="/dashboard"
//             element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
//           />

//           {/* Employees — HR, Manager, System Admin */}
//           <Route
//             path="/employees"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
//                 <EmployeeList />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/employees/new"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
//                 <EmployeeForm />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/employees/:id"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
//                 <EmployeeDetailPage />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/employees/:id/edit"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
//                 <EmployeeForm />
//               </ProtectedRoute>
//             }
//           />

//           {/* Settings — Roles: SYSTEM_ADMIN only */}
//           <Route
//             path="/settings/roles"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
//                 <RolesPage />
//               </ProtectedRoute>
//             }
//           />

//           {/* Settings — Employee Code: SYSTEM_ADMIN only */}
//           <Route
//             path="/settings/employee-code"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
//                 <EmployeeCodeSettingsPage />
//               </ProtectedRoute>
//             }
//           />

//           {/* Settings — Departments/Positions: SYSTEM_ADMIN + HR_ADMIN */}
//           <Route
//             path="/settings/departments"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
//                 <DepartmentsPage />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//             path="/settings/positions"
//             element={
//               <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
//                 <PositionsPage />
//               </ProtectedRoute>
//             }
//           />
//           <Route
//   path="/profile"
//   element={
//     <ProtectedRoute>
//       <ProfilePage />
//     </ProtectedRoute>
//   }
// />
// <Route
//   path="/settings/approval-workflows"
//   element={<ApprovalWorkflowSettingsPage />}
// />
//           <Route path="/" element={<Navigate to="/dashboard" replace />} />
//           <Route path="*" element={<Navigate to="/dashboard" replace />} />
//         </Routes>
//       </AuthProvider>
//     </BrowserRouter>
//   );
// }

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

// ⬇️ NEW imports for workflow feature
import ApprovalWorkflowSettingsPage from './pages/settings/ApprovalWorkflowSettingsPage';
import LetterTemplatesPage from './pages/settings/LetterTemplatesPage';
import LetterTemplateEditorPage from './pages/settings/LetterTemplateEditorPage';

import 'react-quill-new/dist/quill.snow.css';
import LifecycleRequestNewPage from './pages/lifecycle/LifecycleRequestNewPage';
import LifecycleRequestsPage from './pages/lifecycle/LifecycleRequestsPage';
import MyApprovalsPage from './pages/approvals/MyApprovalsPage';
import LifecycleRequestDetailPage from './pages/lifecycle/LifecycleRequestDetailPage';
import RatingScalePage from './pages/settings/RatingScalePage';
import OrgPrioritiesPage from './pages/settings/OrgPrioritiesPage';
import DepartmentalKRAsPage from './pages/settings/DepartmentalKRAsPage';
import KRALibraryPage from './pages/settings/KRALibraryPage';
import KRADetailPage from './pages/settings/KRADetailPage';
import PerformanceCyclesPage from './pages/settings/PerformanceCyclesPage';
import MyPerformancePage from './pages/performance/MyPerformancePage';
import ScorecardBuilderPage from './pages/performance/ScorecardBuilderPage';
import TeamPerformancePage from './pages/performance/TeamPerformancePage';
import ScorecardReviewPage from './pages/performance/ScorecardReviewPage';
import MyPeerReviewsPage from './pages/performance/MyPeerReviewsPage';
import SelfReviewPage from './pages/performance/SelfReviewPage';
import FinalReviewPage from './pages/performance/FinalReviewPage';
import PerformanceCalibrationPage from './pages/performance/PerformanceCalibrationPage';
import PerformanceReportsPage from './pages/performance/PerformanceReportsPage';
// Reimbursement pages
import ReimbursementSmartUploadPage from './pages/reimbursement/SmartUploadPage';
import ReimbursementUploadStatusPage from './pages/reimbursement/UploadStatusPage';
import ReimbursementMyClaimsPage from './pages/reimbursement/MyClaimsPage';
import ReimbursementDashboardPage from './pages/reimbursement/ReimbursementDashboardPage';
import ReimbursementClaimMonitorPage from './pages/reimbursement/ClaimMonitorPage';
import ReimbursementFinanceReviewPage from './pages/reimbursement/FinanceReviewPage';
import ReimbursementReportsPage from './pages/reimbursement/ReimbursementReportsPage';
import ReimbursementEmailControlPage from './pages/reimbursement/EmailControlPage';
import ReimbursementSettingsPage from './pages/reimbursement/ReimbursementSettingsPage';
import ReimbursementProfilePage from './pages/reimbursement/ReimbursementProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{ duration: 3500, style: { fontSize: '14px' } }}
        />

        <Routes>
          {/* ==================== PUBLIC ROUTES ==================== */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ==================== DASHBOARD (Everyone) ==================== */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* ==================== PROFILE (Everyone) ==================== */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* ==================== EMPLOYEES ==================== */}
          <Route
            path="/employees"
            element={
              <ProtectedRoute
                requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}
              >
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
              <ProtectedRoute
                requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}
              >
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

          {/* ==================== SETTINGS ==================== */}

          {/* Roles — SYSTEM_ADMIN only */}
          <Route
            path="/settings/roles"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
                <RolesPage />
              </ProtectedRoute>
            }
          />

          {/* Employee Code — SYSTEM_ADMIN only */}
          <Route
            path="/settings/employee-code"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
                <EmployeeCodeSettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Departments — SYSTEM_ADMIN + HR_ADMIN */}
          <Route
            path="/settings/departments"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <DepartmentsPage />
              </ProtectedRoute>
            }
          />

          {/* Positions — SYSTEM_ADMIN + HR_ADMIN */}
          <Route
            path="/settings/positions"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <PositionsPage />
              </ProtectedRoute>
            }
          />

          {/* ⬇️ Approval Workflows — SYSTEM_ADMIN + HR_ADMIN */}
          <Route
            path="/settings/approval-workflows"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <ApprovalWorkflowSettingsPage />
              </ProtectedRoute>
            }
          />

          {/* ⬇️ Letter Templates — SYSTEM_ADMIN + HR_ADMIN */}
          <Route
            path="/settings/letter-templates"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <LetterTemplatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/letter-templates/new"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <LetterTemplateEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/letter-templates/:id"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <LetterTemplateEditorPage />
              </ProtectedRoute>
            }
          />
           {/* ==================== LIFECYCLE REQUESTS ==================== */}
          <Route
            path="/lifecycle-requests"
            element={
              <ProtectedRoute
                requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}
              >
                <LifecycleRequestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lifecycle-requests/new"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <LifecycleRequestNewPage />
              </ProtectedRoute>
            }
          />
                    <Route
            path="/lifecycle-requests/:id"
            element={
              <ProtectedRoute
                requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}
              >
                <LifecycleRequestDetailPage />
              </ProtectedRoute>
            }
          />

          {/* ==================== MY APPROVALS ==================== */}
          <Route
            path="/approvals"
            element={
              <ProtectedRoute
                requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}
              >
                <MyApprovalsPage />
              </ProtectedRoute>
            }
          />
                    <Route
            path="/settings/rating-scale"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN','HR_ADMIN']}>
                <RatingScalePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/organizational-priorities"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <OrgPrioritiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/departmental-kras"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <DepartmentalKRAsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/kra-library"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <KRALibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/kra-library/:id"
            element={
              <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
                <KRADetailPage />
              </ProtectedRoute>
            }
          />
                  <Route
          path="/settings/performance-cycles"
          element={
            <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
              <PerformanceCyclesPage />
            </ProtectedRoute>
          }
        />

        {/* My Performance (everyone) */}
        <Route
          path="/my-performance"
          element={
            <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
              <MyPerformancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-performance/build/:scorecardId"
          element={
            <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
              <ScorecardBuilderPage />
            </ProtectedRoute>
          }
        />

        {/* Team Performance (managers + HR) */}
        <Route
          path="/team-performance"
          element={
            <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
              <TeamPerformancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/team-performance/:scorecardId/review"
          element={
            <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
              <ScorecardReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
  path="/peer-reviews"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <MyPeerReviewsPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/my-performance/self-review/:scorecardId"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <SelfReviewPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/team-performance/:scorecardId/final-review"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
      <FinalReviewPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/hr/calibration"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
      <PerformanceCalibrationPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/performance-reports"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER']}>
      <PerformanceReportsPage />
    </ProtectedRoute>
  }
/>


{/* ==================== REIMBURSEMENTS ==================== */}

{/* Employee pages */}
<Route
  path="/reimbursements/smart-upload"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <ReimbursementSmartUploadPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/smart-upload/:uploadId"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <ReimbursementUploadStatusPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/profile"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <ReimbursementProfilePage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/my-claims"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']}>
      <ReimbursementMyClaimsPage />
    </ProtectedRoute>
  }
/>

{/* Admin/Finance pages */}
<Route
  path="/reimbursements/dashboard"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
      <ReimbursementDashboardPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/claims"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
      <ReimbursementClaimMonitorPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/finance-review"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
      <ReimbursementFinanceReviewPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/reports"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
      <ReimbursementReportsPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/email-control"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN', 'HR_ADMIN']}>
      <ReimbursementEmailControlPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/reimbursements/settings"
  element={
    <ProtectedRoute requiredRoles={['SYSTEM_ADMIN']}>
      <ReimbursementSettingsPage />
    </ProtectedRoute>
  }
/>
          {/* ==================== FALLBACKS ==================== */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}