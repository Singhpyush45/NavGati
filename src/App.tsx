import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Role } from '@/types';
import { homeFor, useAuth } from '@/context/AuthContext';
import { AppShell } from '@/components/UI/AppShell';
import { Spinner } from '@/components/UI/primitives';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import PatientDashboard from '@/pages/PatientDashboard';
import TherapistDashboard from '@/pages/TherapistDashboard';
import ExerciseLibrary from '@/pages/ExerciseLibrary';
import CameraSetup from '@/pages/CameraSetup';
import LiveExercise from '@/pages/LiveExercise';
import SessionSummary from '@/pages/SessionSummary';
import Progress from '@/pages/Progress';
import PatientDetails from '@/pages/PatientDetails';
import SessionHistory from '@/pages/SessionHistory';
import Settings from '@/pages/Settings';
import Messages from '@/pages/Messages';

/** Route guard: must be signed in, and (optionally) have one of the allowed roles. */
function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><Spinner /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <>{children}</>;
}

const PATIENT: Role[] = ['PATIENT'];
const STAFF: Role[] = ['THERAPIST', 'ADMIN'];

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        {/* Patient */}
        <Route path="/app" element={<RequireAuth roles={PATIENT}><PatientDashboard /></RequireAuth>} />
        <Route path="/progress" element={<RequireAuth roles={PATIENT}><Progress /></RequireAuth>} />
        <Route path="/history" element={<RequireAuth roles={PATIENT}><SessionHistory /></RequireAuth>} />
        <Route path="/setup" element={<RequireAuth roles={PATIENT}><CameraSetup /></RequireAuth>} />
        <Route path="/live" element={<RequireAuth roles={PATIENT}><LiveExercise /></RequireAuth>} />
        <Route path="/messages" element={<RequireAuth roles={PATIENT}><Messages /></RequireAuth>} />
        {/* Therapist / admin */}
        <Route path="/therapist" element={<RequireAuth roles={STAFF}><TherapistDashboard /></RequireAuth>} />
        <Route path="/therapist/patients/:id" element={<RequireAuth roles={STAFF}><PatientDetails /></RequireAuth>} />
        {/* Shared */}
        <Route path="/sessions/:id" element={<SessionSummary />} />
        <Route path="/exercises" element={<ExerciseLibrary />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
