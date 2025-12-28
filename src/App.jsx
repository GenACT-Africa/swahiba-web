import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AppLayout from "./layouts/AppLayout.jsx";

// Public pages
import Home from "./pages/Home.jsx";
import Talk from "./pages/Talk.jsx";
import Triage from "./pages/Triage.jsx";
import Result from "./pages/Result.jsx";
import Resources from "./pages/Resources.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import Referrals from "./pages/Referrals.jsx";
import DataUsePolicy from "./pages/DataUsePolicy.jsx";
import EmergencyContacts from "./pages/EmergencyContacts.jsx";
import SafeguardingPolicy from "./pages/SafeGuardingPolicy.jsx";
import AboutUs from "./pages/AboutUs.jsx";

// Auth
import Signup from "./pages/swahiba/Signup.jsx";
import Login from "./pages/swahiba/Login.jsx";

// Swahiba (peer)
import Cases from "./pages/swahiba/Cases.jsx";
import CaseDetails from "./pages/swahiba/CaseDetails.jsx";

// Admin
import AdminPanel from "./pages/admin/AdminPanel.jsx";
import ManageProducts from "./pages/admin/ManageProducts.jsx";
import ManageResources from "./pages/admin/ManageResources.jsx";
import ManageReferrals from "./pages/admin/ManageReferrals.jsx";
import AdminInvites from "./pages/admin/Invites.jsx";

import ProtectedRoute from "./components/protectedRoute.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔐 AUTH (NO TopBar, NO Footer) */}
        <Route path="/swahiba/login" element={<Login />} />
        <Route path="/swahiba/signup" element={<Signup />} />

        {/* 🌍 PUBLIC + APP (TopBar + Footer) */}
        <Route element={<AppLayout />}>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/talk" element={<Talk />} />
          <Route path="/triage" element={<Triage />} />
          <Route path="/result" element={<Result />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/data-use" element={<DataUsePolicy />} />
          <Route path="/emergency-contacts" element={<EmergencyContacts />} />
          <Route path="/safeguarding" element={<SafeguardingPolicy />} />
          <Route path="/about" element={<AboutUs />} />

          {/* 🧑‍⚕️ SWAHIBA PEER (protected) */}
          <Route
            path="/swahiba/cases"
            element={
              <ProtectedRoute>
                <Cases />
              </ProtectedRoute>
            }
          />
          <Route
            path="/swahiba/cases/:id"
            element={
              <ProtectedRoute>
                <CaseDetails />
              </ProtectedRoute>
            }
          />

          {/* 🛠 ADMIN (ADMIN-ONLY) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/products"
            element={
              <ProtectedRoute adminOnly>
                <ManageProducts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/resources"
            element={
              <ProtectedRoute adminOnly>
                <ManageResources />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/referrals"
            element={
              <ProtectedRoute adminOnly>
                <ManageReferrals />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/invites"
            element={
              <ProtectedRoute adminOnly>
                <AdminInvites />
              </ProtectedRoute>
            }
          />

          {/* 🚫 FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}