/**
 * CSRF Protection Middleware
 * Protege contra ataques Cross-Site Request Forgery
 */

import { randomBytes, createHmac } from "crypto";
import type { Request, Response, NextFunction } from "express";

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET || "default-csrf-secret-change-me";
const CSRF_TOKEN_LENGTH = 32;

interface CSRFSession {
  csrfSecret?: string;
}

/**
 * Genera un token CSRF único para la sesión actual
 */
export function generateCSRFToken(sessionId: string): string {
  const secret = randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
  const hash = createHmac("sha256", CSRF_SECRET)
    .update(sessionId + secret)
    .digest("hex");
  
  // Token = secret:hash
  return `${secret}:${hash}`;
}

/**
 * Verifica que un token CSRF sea válido
 */
export function verifyCSRFToken(token: string, sessionId: string): boolean {
  if (!token || !sessionId) return false;
  
  const [secret, hash] = token.split(":");
  if (!secret || !hash) return false;
  
  const expectedHash = createHmac("sha256", CSRF_SECRET)
    .update(sessionId + secret)
    .digest("hex");
  
  // Comparación constant-time para prevenir timing attacks
  return timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

/**
 * Comparación constant-time
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Middleware de Express para generar token CSRF
 * Lo agrega a res.locals para que esté disponible en el contexto
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction) {
  // Obtener sessionId de la cookie (app_session_id es la cookie de sesión real)
  const sessionId = req.cookies?.app_session_id || req.cookies?.sessionId || req.headers["x-session-id"] || "anonymous";
  
  // Generar token CSRF
  const csrfToken = generateCSRFToken(sessionId);
  
  // Agregar al contexto de respuesta
  res.locals.csrfToken = csrfToken;
  
  // También lo enviamos en un header para SPAs
  res.setHeader("X-CSRF-Token", csrfToken);
  
  next();
}

/**
 * Middleware para validar tokens CSRF en mutaciones
 * Solo se aplica a métodos POST, PUT, PATCH, DELETE
 */
export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  // Solo validar en métodos que modifican datos
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }
  
  // Permitir endpoints públicos sin CSRF
  if (req.path.includes("/auth.login") || req.path.includes("/auth.register")) {
    return next();
  }
  
  // Obtener token del header o body
  const token = 
    req.headers["x-csrf-token"] || 
    req.headers["csrf-token"] ||
    req.body?._csrf ||
    req.query._csrf;
  
  // Obtener sessionId (app_session_id es la cookie real de sesión)
  const sessionId = req.cookies?.app_session_id || req.cookies?.sessionId || req.headers["x-session-id"];
  
  if (!sessionId) {
    return res.status(401).json({
      error: {
        message: "No hay sesión activa",
        code: "NO_SESSION"
      }
    });
  }
  
  if (!token) {
    return res.status(403).json({
      error: {
        message: "Token CSRF no proporcionado",
        code: "CSRF_TOKEN_MISSING"
      }
    });
  }
  
  if (!verifyCSRFToken(token as string, sessionId)) {
    return res.status(403).json({
      error: {
        message: "Token CSRF inválido",
        code: "CSRF_TOKEN_INVALID"
      }
    });
  }
  
  next();
}

/**
 * Endpoint para obtener token CSRF
 * GET /api/csrf-token
 */
export function getCSRFTokenEndpoint(req: Request, res: Response) {
  const sessionId = req.cookies?.app_session_id || req.cookies?.sessionId || req.headers["x-session-id"] || "anonymous";
  const csrfToken = generateCSRFToken(sessionId);
  
  res.json({
    csrfToken,
    expiresIn: 3600 // 1 hora
  });
}
