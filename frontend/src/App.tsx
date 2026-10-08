import { Routes, Route } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import BookingFlow from "@/pages/BookingFlow";
import Catalog from "@/pages/Catalog";
import ContractSign from "@/pages/ContractSign";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import PixCheckout from "@/pages/PixCheckout";
import Register from "@/pages/Register";
import AuditLogs from "@/pages/admin/AuditLogs";
import Bookings from "@/pages/admin/Bookings";
import Budgets from "@/pages/admin/Budgets";
import Contracts from "@/pages/admin/Contracts";
import Customers from "@/pages/admin/Customers";
import Dashboard from "@/pages/admin/Dashboard";
import Financial from "@/pages/admin/Financial";
import Inventory from "@/pages/admin/Inventory";
import AdminNotifications from "@/pages/admin/Notifications";
import Payments from "@/pages/admin/Payments";
import Reports from "@/pages/admin/Reports";
import Schedule from "@/pages/admin/Schedule";
import Settings from "@/pages/admin/Settings";
import WhatsAppLogs from "@/pages/admin/WhatsAppLogs";
import Portal from "@/pages/customer/Portal";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      {/* Public storefront + checkout */}
      <Route path="/" element={<Home />} />
      <Route path="/brinquedos" element={<Catalog />} />
      <Route path="/reservar" element={<BookingFlow />} />
      <Route path="/pagamento/:id" element={<PixCheckout />} />
      <Route path="/contrato/:id" element={<ContractSign />} />
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />

      {/* Customer portal — isolated to the signed-in customer's own data */}
      <Route
        path="/cliente"
        element={
          <ProtectedRoute roles={["cliente"]}>
            <Portal />
          </ProtectedRoute>
        }
      />

      {/* Staff area */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/agenda"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Schedule />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reservas"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Bookings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orcamentos"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Budgets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/brinquedos"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Inventory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clientes"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/pagamentos"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Payments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/contratos"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <Contracts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/whatsapp"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <WhatsAppLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notificacoes"
        element={
          <ProtectedRoute roles={["admin", "funcionario"]}>
            <AdminNotifications />
          </ProtectedRoute>
        }
      />

      {/* Admin-only */}
      <Route
        path="/admin/financeiro"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Financial />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/relatorios"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Reports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/auditoria"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AuditLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/configuracoes"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Settings />
          </ProtectedRoute>
        }
      />

      {/* Any unmatched URL falls back to the storefront instead of a blank page. */}
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
