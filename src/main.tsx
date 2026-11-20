import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { RequireAuth } from './auth'
import { Layout } from './components/Layout'
import { AttemptPage } from './pages/AttemptPage'
import { ForgotPassword, ResetPassword } from './pages/PasswordPages'
import { Dashboard } from './pages/Dashboard'
import { Home } from './pages/Home'
import { Contact, Privacy, RefundPolicy, Terms } from './pages/Legal'
import { Login } from './pages/Login'
import { NotFound } from './pages/NotFound'
import { Register } from './pages/Register'
import { StartExam } from './pages/StartExam'
import { Verify } from './pages/Verify'
import { VerifyEmail } from './pages/VerifyEmail'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminAccess } from './pages/admin/AdminAccess'
import { AdminAttempts } from './pages/admin/AdminAttempts'
import { AdminCertificates } from './pages/admin/AdminCertificates'
import { AdminExams } from './pages/admin/AdminExams'
import { AdminQuestions } from './pages/admin/AdminQuestions'
import { AdminAudit } from './pages/admin/AdminAudit'
import { AdminSales } from './pages/admin/AdminSales'
import { AdminReviews, AdminSessionReview } from './pages/admin/AdminReviews'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/register', element: <Register /> },
      { path: '/login', element: <Login /> },
      { path: '/verify-email', element: <VerifyEmail /> },
      { path: '/forgot-password', element: <ForgotPassword /> },
      { path: '/reset-password', element: <ResetPassword /> },
      { path: '/verify', element: <Verify /> },
      { path: '/verify/:certNo', element: <Verify /> },
      { path: '/terms', element: <Terms /> },
      { path: '/refund-policy', element: <RefundPolicy /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/contact', element: <Contact /> },
      { path: '/dashboard', element: <RequireAuth><Dashboard /></RequireAuth> },
      { path: '/start/:entitlementId', element: <RequireAuth><StartExam /></RequireAuth> },
      {
        path: '/admin',
        element: <RequireAuth admin><AdminLayout /></RequireAuth>,
        children: [
          { index: true, element: <AdminExams /> },
          { path: 'questions', element: <AdminQuestions /> },
          { path: 'access', element: <AdminAccess /> },
          { path: 'attempts', element: <AdminAttempts /> },
          { path: 'reviews', element: <AdminReviews /> },
          { path: 'reviews/:attemptId', element: <AdminSessionReview /> },
          { path: 'certificates', element: <AdminCertificates /> },
          { path: 'sales', element: <AdminSales /> },
          { path: 'audit', element: <AdminAudit /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
  // The exam runs without the site navigation so candidates are not tempted to click away.
  { path: '/attempts/:attemptId', element: <RequireAuth><AttemptPage /></RequireAuth> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
