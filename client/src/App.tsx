import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AppHeader from "./components/AppHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Home from "@/pages/Home";
import Dashboard from "@/pages/Dashboard";
import Branches from "@/pages/Branches";
import Orders from "@/pages/Orders";
import Units from "@/pages/Units";
import Repairs from "@/pages/Repairs";
import Warranties from "@/pages/Warranties";
import Returns from "@/pages/Returns";
import GenerateCodes from "@/pages/GenerateCodes";
import RegisterUnit from "@/pages/RegisterUnit";
import Catalog from "@/pages/Catalog";
import Tracking from "@/pages/Tracking";
import OrderDetail from "@/pages/OrderDetail";
import CreateOrder from "@/pages/CreateOrder";
import EditOrder from "@/pages/EditOrder";
import DeliveryPersons from "@/pages/DeliveryPersons";
import Suppliers from "@/pages/Suppliers";
import Purchases from "@/pages/Purchases";
import Finance from "@/pages/Finance";
import RepartidorFinance from "@/pages/RepartidorFinance";
import DeliveryLoad from "@/pages/DeliveryLoad";
import Sales from "@/pages/Sales";
import Customers from "@/pages/Customers";
import Reports from "@/pages/Reports";
import Expenses from "@/pages/Expenses";
import Profitability from "@/pages/Profitability";
import DashboardKPIs from "@/pages/DashboardKPIs";
import AnalyticsPage from "@/pages/AnalyticsPage";
import AccountsReceivable from "@/pages/AccountsReceivable";
import AccountsPayable from "@/pages/AccountsPayable";
import UsersManagement from "@/pages/UsersManagement";
import Settings from "@/pages/Settings";
import GlobalCommandMenu from "@/components/GlobalCommandMenu";
import { BranchProvider } from "./contexts/BranchContext";

function ProtectedRoute({
  component: Component,
  adminOnly = false,
  moduleKey,
  children,
  ...rest
}: any) {
  const { user } = useAuth();

  if (!user) return <Login />;

  if ((user as any).status === "inactive") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Cuenta Inactiva</h2>
        <p className="text-muted-foreground mb-4">Tu cuenta ha sido desactivada por el administrador.</p>
        <Link href="/login">
          <Button variant="outline">Iniciar con otra cuenta</Button>
        </Link>
      </div>
    );
  }

  const isAdmin = user.role === "admin";

  let allowedModules: string[] = [];
  try {
    if (typeof (user as any).allowedModules === "string") {
      allowedModules = JSON.parse((user as any).allowedModules);
    } else if (Array.isArray((user as any).allowedModules)) {
      allowedModules = (user as any).allowedModules;
    }
  } catch {
    allowedModules = [];
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-2">
          Acceso Denegado
        </h2>
        <p className="text-muted-foreground mb-4">
          No tienes permisos para acceder a este módulo administrativo.
        </p>
        <Link href="/">
          <Button variant="outline">Volver al Inicio</Button>
        </Link>
      </div>
    );
  }

  if (moduleKey && !isAdmin && allowedModules.length > 0 && !allowedModules.includes(moduleKey)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <h2 className="text-2xl font-bold text-amber-600 mb-2">
          Módulo No Asignado
        </h2>
        <p className="text-muted-foreground mb-4">
          Tu usuario no tiene asignado el módulo "{moduleKey}". Consulta con el administrador.
        </p>
        <Link href="/">
          <Button variant="outline">Volver al Inicio</Button>
        </Link>
      </div>
    );
  }

  if (children) {
    return <>{children}</>;
  }

  return <Component {...rest} />;
}

function Router() {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  const showTopHeader = true;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path={"/login"} component={Login} />
        <Route path={"/register"} component={Register} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <>
      {showTopHeader ? <AppHeader /> : null}
      <div className="pb-20 md:pb-0">
        <Switch>
          <Route path={"/"} component={Home} />
          <Route path="/dashboard">
            <ProtectedRoute component={Dashboard} adminOnly={true} />
          </Route>
          <Route path="/units">
            <ProtectedRoute component={Units} />
          </Route>
          <Route path="/repairs">
            <ProtectedRoute component={Repairs} />
          </Route>
          <Route path="/warranties">
            <ProtectedRoute component={Warranties} />
          </Route>
          <Route path="/returns">
            <ProtectedRoute component={Returns} />
          </Route>
          <Route path="/generate-codes">
            <ProtectedRoute component={GenerateCodes} />
          </Route>
          <Route path="/register-unit">
            <ProtectedRoute component={RegisterUnit} />
          </Route>
          <Route path="/catalog">
            <ProtectedRoute component={Catalog} />
          </Route>
          <Route path="/inventory">
            <ProtectedRoute component={Catalog} />
          </Route>
          <Route path="/products">
            <ProtectedRoute component={Catalog} />
          </Route>

          <Route path="/branches">
            <ProtectedRoute component={Branches} adminOnly={true} />
          </Route>
          <Route path="/delivery-persons">
            <ProtectedRoute component={DeliveryPersons} adminOnly={true} />
          </Route>
          <Route path="/suppliers">
            <ProtectedRoute component={Suppliers} adminOnly={true} />
          </Route>
          <Route path="/purchases">
            <ProtectedRoute component={Purchases} adminOnly={true} />
          </Route>
          <Route path="/finance">
            <ProtectedRoute component={Finance} adminOnly={true} />
          </Route>
          <Route path="/sales">
            <ProtectedRoute component={Sales} />
          </Route>
          <Route path="/customers">
            <ProtectedRoute component={Customers} adminOnly={true} />
          </Route>
          <Route path="/reports">
            <ProtectedRoute component={Reports} />
          </Route>
          <Route path="/reportes">
            <ProtectedRoute component={Reports} />
          </Route>
          <Route path="/report">
            <ProtectedRoute component={Reports} />
          </Route>
          <Route path="/expenses">
            <ProtectedRoute component={Expenses} />
          </Route>
          <Route path="/rentabilidad">
            <ProtectedRoute component={Profitability} />
          </Route>
          <Route path="/dashboard-kpis">
            <ProtectedRoute component={DashboardKPIs} />
          </Route>
          <Route path="/kpis">
            <ProtectedRoute component={DashboardKPIs} />
          </Route>
          <Route path="/kpi">
            <ProtectedRoute component={DashboardKPIs} />
          </Route>
          <Route path="/dashboard-kpi">
            <ProtectedRoute component={DashboardKPIs} />
          </Route>
          <Route path="/dashboard/kpis">
            <ProtectedRoute component={DashboardKPIs} />
          </Route>
          <Route path="/analytics">
            <ProtectedRoute component={AnalyticsPage} />
          </Route>
          <Route path="/accounts-receivable">
            <ProtectedRoute component={AccountsReceivable} />
          </Route>
          <Route path="/accounts-payable">
            <ProtectedRoute component={AccountsPayable} />
          </Route>
          <Route path="/users">
            <ProtectedRoute component={UsersManagement} adminOnly={true} moduleKey="users" />
          </Route>
          <Route path="/usuarios">
            <ProtectedRoute component={UsersManagement} adminOnly={true} moduleKey="users" />
          </Route>
          <Route path="/settings">
            <ProtectedRoute component={Settings} adminOnly={true} />
          </Route>
          <Route path="/configuracion">
            <ProtectedRoute component={Settings} adminOnly={true} />
          </Route>
          <Route path={"/orders"} component={Orders} />
          <Route path={"/track/:orderId"} component={Tracking} />
          <Route path={"/order/:orderId"} component={OrderDetail} />
          <Route path={"/create-order"} component={CreateOrder} />
          <Route path={"/edit-order/:id"} component={EditOrder} />
          <Route path="/repartidor/finance" component={RepartidorFinance} />
          <Route path="/delivery-load" component={DeliveryLoad} />

          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <BranchProvider>
          <TooltipProvider>
            <Toaster />
            <GlobalCommandMenu />
            <Router />
          </TooltipProvider>
        </BranchProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
