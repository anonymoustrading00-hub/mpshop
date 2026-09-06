/**
 * Hook para manejar tokens CSRF en el cliente
 */

import { useState, useEffect } from "react";

let csrfToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Obtiene el token CSRF del servidor
 */
async function fetchCSRFToken(): Promise<string> {
  const now = Date.now();
  
  // Si tenemos un token válido, usarlo
  if (csrfToken && tokenExpiry > now) {
    return csrfToken;
  }
  
  try {
    const response = await fetch("/api/csrf-token", {
      credentials: "include"
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch CSRF token");
    }
    
    const data = await response.json();
    csrfToken = data.csrfToken;
    tokenExpiry = now + (data.expiresIn * 1000) - 60000; // Renovar 1 min antes
    
    return csrfToken;
  } catch (error) {
    console.error("[CSRF] Error fetching token:", error);
    return "";
  }
}

/**
 * Hook para obtener el token CSRF actual
 */
export function useCSRF() {
  const [token, setToken] = useState<string | null>(csrfToken);
  
  useEffect(() => {
    fetchCSRFToken().then(setToken);
    
    // Renovar token cada 30 minutos
    const interval = setInterval(() => {
      fetchCSRFToken().then(setToken);
    }, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return token;
}

/**
 * Obtiene el token CSRF para usar en requests
 * (Versión síncrona para usar en interceptors)
 */
export function getCSRFToken(): string | null {
  return csrfToken;
}

/**
 * Configura el token CSRF manualmente (útil para testing)
 */
export function setCSRFToken(token: string) {
  csrfToken = token;
  tokenExpiry = Date.now() + 3600000; // 1 hora
}

/**
 * Limpia el token CSRF (útil en logout)
 */
export function clearCSRFToken() {
  csrfToken = null;
  tokenExpiry = 0;
}
