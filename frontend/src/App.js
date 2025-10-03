// src/App.js
import React from "react";
import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import "antd/dist/reset.css";

import LoginPage from "./components/Login/LoginPage";
import DashboardPage from "./components/dashboard/DashboardPage";
import ApprovalsPage from "./components/approvals/ApprovalsPage";
import SharedPage from "./components/shared/SharedPage";
import DelegatesPage from "./components/delegates/DelegatesPage";
import ProtectedLayout from "./components/layout/ProtectedLayout";
import MainBackgroundLayout from "./components/layout/MainBackgroundLayout";

import AdminLayout from "./components/admin/layout/AdminLayout";
import AdminDashboard from "./components/admin/AdminDashboard";
import WorkflowList from "./components/admin/workflow/WorkflowList";
import WorkflowImport from "./components/admin/workflow/WorkflowImport";
import WorkflowSteps from "./components/admin/workflow/WorkflowSteps";
import WorkflowForm from "./components/admin/workflow/WorkflowForm";
import InitiateForm from "./components/forms/InitiateForm";
import ApprovalDetailsPage from "./components/approvals/ApprovalDetailsPage";
import UserManagement from "./components/admin/UserManagement";
import UserActivityReport from "./components/admin/reports/UserActivityReport";


// NEW: policy-driven resubmit page
import ResubmitPage from "./components/initiate/ResubmitPage";

function App() {
  const { role } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* ===== Admin ===== */}
        <Route
          path="/admin"
          element={
            <ProtectedLayout requiredRole="Admin">
              <AdminLayout />
            </ProtectedLayout>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="reports/user-activity" element={<UserActivityReport />} />
```
          <Route path="workflows" element={<WorkflowList />} />
          <Route path="workflows/new" element={<WorkflowForm />} />
          <Route path="workflows/:id/edit" element={<WorkflowForm />} />
          <Route path="workflows/import" element={<WorkflowImport />} />
          <Route path="workflows/:id/steps" element={<WorkflowSteps />} />
          
        </Route>

        {/* ===== Authenticated, non-admin area (global two-tone background) ===== */}
        <Route
          element={
            <ProtectedLayout>
              <MainBackgroundLayout topBandHeight="60vh" maxWidth={false} />
            </ProtectedLayout>
          }
        >
          {/* Home / Dashboard */}
          <Route
            path="/"
            element={role === "Admin" ? <Navigate to="/admin" replace /> : <DashboardPage />}
          />

          {/* Approvals */}
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/approvals/assigned" element={<Navigate to="/approvals?tab=assigned" replace />} />
          <Route path="/approvals/initiated" element={<Navigate to="/approvals?tab=initiated" replace />} />
          <Route path="/approvals/approved" element={<Navigate to="/approvals?tab=approved" replace />} />
          <Route path="/approvals/sentback" element={<Navigate to="/approvals?tab=sentback" replace />} />
          <Route path="/approvals/rejected" element={<Navigate to="/approvals?tab=rejected" replace />} />

          {/* Delegations & Shared inbox */}
          <Route path="/delegations" element={<DelegatesPage />} />
          <Route path="/shared" element={<SharedPage />} />

          {/* Initiate / Resubmit / Details */}
          <Route path="/initiate" element={<InitiateForm />} />
          {/* Use policy-driven ResubmitPage for edit and explicit resubmit */}
          <Route path="/approvals/:id/edit" element={<ResubmitPage />} />
          <Route path="/approvals/:id/resubmit" element={<ResubmitPage />} />
          {/* Route for resubmit from initiated/sentback tabs */}
          <Route path="/resubmit/:id" element={<ResubmitPage />} />

          <Route path="/fundrequest/:id" element={<ApprovalDetailsPage mode="fund" />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
