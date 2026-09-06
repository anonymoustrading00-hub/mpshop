import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// Obtener token CSRF del servidor y mantenerlo actualizado
let csrfToken: string | null = null;

async function fetchCSRFToken() {
  try {
    const response = await fetch("/api/csrf-token", { credentials: "include" });
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
    }
  } catch (error) {
    console.error("[CSRF] Failed to fetch token:", error);
  }
}

// Obtener token inicial
fetchCSRFToken();

// Renovar token cada 30 minutos
setInterval(fetchCSRFToken, 30 * 60 * 1000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — evita re-fetch al montar componentes
      refetchOnWindowFocus: false,  // no refrescar al cambiar de pestaña
      retry: 1,                     // solo 1 reintento en caso de error
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/preview/kefir-control")) return;
  
  // Prevent infinite redirect loops if we are already on the login or register page
  if (window.location.pathname === "/login" || window.location.pathname === "/register") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const branchId = localStorage.getItem("x-branch-id");
        const headers = new Headers(init?.headers);
        
        // Agregar branch ID si existe
        if (branchId) {
          headers.set("x-branch-id", branchId);
        }
        
        // Agregar token CSRF para mutaciones
        if (csrfToken) {
          headers.set("X-CSRF-Token", csrfToken);
        }
        
        return globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
