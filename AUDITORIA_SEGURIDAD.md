# 🔐 AUDITORÍA DE SEGURIDAD - MP SHOP
## Sistema de Control de Pedidos e Inventario

**Fecha:** 7 de Septiembre de 2026  
**Versión del Sistema:** 1.5.0  
**Auditor:** Sistema Automatizado Kiro AI  
**Nivel de Riesgo General:** ⚠️ **MEDIO-ALTO**

---

## 📋 RESUMEN EJECUTIVO

Se ha realizado una auditoría exhaustiva del sistema MP Shop identificando **15 vulnerabilidades** (5 críticas iniciales, 1 ya resuelta). El sistema presenta riesgos de seguridad que están siendo atendidos sistemáticamente.

### Hallazgos Principales:
- ✅ **Fortalezas:** Uso de bcrypt, preparación con Drizzle ORM, HTTPS en producción, **CSRF implementado**
- ❌ **Crítico:** Contraseñas hardcodeadas, sesiones sin rotación
- ⚠️ **Alto:** SQL dinámico sin sanitización, falta rate limiting, falta 2FA
- 📋 **Medio:** Logs sensibles, permisos granulares limitados

### ✅ **Vulnerabilidad CSRF - RESUELTA**
La protección CSRF ha sido implementada completamente con tokens HMAC SHA-256, validación automática y renovación periódica.

---

## 🚨 VULNERABILIDADES CRÍTICAS (Prioridad 1)

### 1. **Contraseñas Maestras Hardcodeadas** 🔴 CRÍTICO
**Archivo:** `server/auth.ts` línea 119-125
**Descripción:** Múltiples contraseñas hardcodeadas en el código fuente

```typescript
const isMasterAdmin =
  username === "admin" &&
  (password === "MPShop2026Admin!" ||
    password === (process.env.ADMIN_PASSWORD || "MPShop2026Admin!") ||
    password === "admin123" ||
    password === "usuario");
```

**Riesgo:**
- Cualquier persona con acceso al código puede autenticarse como administrador
- Las contraseñas están expuestas en el repositorio Git
- Bypass completo del sistema de autenticación

**Impacto:** CRÍTICO - Acceso total al sistema  
**Probabilidad:** ALTA - Código público en GitHub

**Recomendación:**
```typescript
// ELIMINAR completamente este bloque
// Solo usar autenticación con hash de bcrypt desde la base de datos
```

---

### 2. **Ausencia de Protección CSRF** ✅ RESUELTO (era 🔴 CRÍTICO)
**Descripción:** ~~No se implementan tokens CSRF en formularios y mutaciones~~

**✅ IMPLEMENTADO:**
- Middleware de generación de tokens CSRF en el servidor
- Validación automática en todas las mutaciones (POST, PUT, PATCH, DELETE)
- Tokens con HMAC SHA-256 para seguridad
- Renovación automática cada 30 minutos en el cliente
- Endpoint `/api/csrf-token` para obtener tokens
- Headers `X-CSRF-Token` en todas las requests del cliente

**Archivos:**
- `server/_core/csrf.ts` - Lógica de generación y validación
- `server/_core/index.ts` - Integración en Express
- `client/src/main.tsx` - Inclusión automática en tRPC
- `client/src/hooks/useCSRF.ts` - Hook para React components

**Protección:**
- ✅ Generación criptográficamente segura con `crypto.randomBytes`
- ✅ HMAC SHA-256 para signing
- ✅ Comparación constant-time contra timing attacks
- ✅ Expiración y renovación automática
- ✅ Validación en servidor antes de procesar mutaciones

~~**Riesgo:**
- Atacante puede ejecutar acciones en nombre del usuario autenticado
- Posible creación/modificación/eliminación de datos sin consentimiento
- Transferencias fraudulentas, cambio de permisos~~

**Impacto:** ~~CRÍTICO~~ → **MITIGADO**  
**Probabilidad:** ~~MEDIA~~ → **BAJA**

---

### 3. **Sesiones Sin Expiración por Inactividad** 🔴 CRÍTICO
**Archivo:** `server/auth.ts`
**Descripción:** Sesiones válidas por 30 días sin validar actividad

```typescript
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 días
```

**Riesgo:**
- Sesión robada válida durante 30 días
- No hay renovación ni invalidación por inactividad
- Permite acceso prolongado no autorizado

**Recomendación:**
```typescript
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 horas
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutos sin actividad

// Implementar:
- Renovación de sesión cada 15 minutos
- Timeout por inactividad
- Logout automático
```

---

### 4. **SQL Dinámico Sin Sanitización** 🟠 ALTO
**Archivos:** Múltiples (`server/_core/index.ts`, `server/routers/settings.ts`, etc.)
**Descripción:** Uso de template literals en queries SQL

```typescript
await connection.query(`TRUNCATE TABLE \`${table}\``);
await connection.query(`SELECT * FROM \`${table}\``);
await connection.query(`DELETE FROM \`${t}\``);
```

**Riesgo:**
- Inyección SQL si variables no son controladas
- Bypass de autenticación
- Acceso/modificación/eliminación de datos

**Recomendación:**
```typescript
// Usar whitelist de tablas permitidas
const ALLOWED_TABLES = ['users', 'sales', 'purchases', ...];

if (!ALLOWED_TABLES.includes(table)) {
  throw new Error('Tabla no permitida');
}

// O usar Drizzle ORM exclusivamente
await db.delete(schema[table]);
```

---

### 5. **Falta Rate Limiting en Endpoints Críticos** 🟠 ALTO
**Descripción:** No hay límite de intentos en login ni otras operaciones

**Riesgo:**
- Ataques de fuerza bruta en login
- DDoS mediante creación masiva de registros
- Abuso de APIs de reportes/exportación

**Recomendación:**
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: 'Demasiados intentos de login'
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100
});
```

---

## ⚠️ VULNERABILIDADES DE ALTO RIESGO (Prioridad 2)

### 6. **Logs con Información Sensible** 🟠 ALTO
**Archivo:** `server/auth.ts`, múltiples routers
**Descripción:** Logs contienen credenciales y datos sensibles

```typescript
console.log(`[Auth] Attempt: username="${username}"`);
console.log(`[Auth] Password hash automatically synchronized`);
```

**Recomendación:**
- Nunca logear contraseñas, tokens, hashes
- Usar niveles de log (debug, info, error)
- Implementar rotación y encriptación de logs

---

### 7. **Ausencia de Autenticación Multifactor (2FA)** 🟠 ALTO
**Descripción:** No hay opción de 2FA para usuarios

**Recomendación:**
```typescript
// Implementar TOTP (Time-based One-Time Password)
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

// Generar secret
const secret = speakeasy.generateSecret({
  name: 'MP Shop'
});

// Verificar token
const verified = speakeasy.totp.verify({
  secret: user.mfaSecret,
  encoding: 'base32',
  token: userToken
});
```

---

### 8. **Permisos No Granulares** 🟠 ALTO
**Descripción:** Sistema de permisos básico por rol, no por recurso/acción

**Riesgo:**
- No se puede limitar acceso a registros específicos
- Un "seller" tiene acceso a todas las ventas
- No hay separación por sucursal en permisos

**Recomendación:**
```typescript
// Implementar RBAC granular
interface Permission {
  resource: 'sale' | 'purchase' | 'unit';
  action: 'read' | 'create' | 'update' | 'delete';
  condition?: (ctx: Context, record: any) => boolean;
}

// Ejemplo:
{
  resource: 'sale',
  action: 'read',
  condition: (ctx, sale) => sale.branchId === ctx.user.branchId
}
```

---

### 9. **Validación de Entrada Insuficiente** 🟡 MEDIO
**Descripción:** Validaciones de Zod básicas, falta sanitización

**Ejemplo de mejora:**
```typescript
// Antes
name: z.string().min(1)

// Después
name: z.string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9\s\-\_áéíóúñÑ]+$/)
  .trim()
  .transform(sanitizeHTML)
```

---

### 10. **Headers de Seguridad Faltantes** 🟡 MEDIO
**Descripción:** Faltan headers HTTP de seguridad

**Recomendación:**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true
}));
```

---

## 📊 VULNERABILIDADES DE RIESGO MEDIO (Prioridad 3)

### 11. **Sesiones en Memoria para Demo** 🟡 MEDIO
**Archivo:** `server/auth.ts`
```typescript
const MOCK_SESSIONS = new Map<string, { userId: number; expiresAt: Date }>();
```
**Riesgo:** En producción, las sesiones se pierden al reiniciar el servidor

---

### 12. **Falta Auditoría Detallada** 🟡 MEDIO
**Descripción:** El módulo de auditoría existe pero no cubre todas las acciones críticas

**Recomendación:**
- Auditar todos los cambios en finanzas, permisos, usuarios
- Incluir IP, User-Agent, timestamps precisos
- Logs inmutables (append-only)

---

### 13. **Configuración de CORS Permisiva** 🟡 MEDIO
**Riesgo:** Puede permitir orígenes no autorizados

**Recomendación:**
```typescript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://mpshop-production.up.railway.app',
  credentials: true,
  optionsSuccessStatus: 200
};
```

---

### 14. **Backup Sin Encriptación** 🟡 MEDIO
**Descripción:** El sistema de backup descarga datos en texto plano

**Recomendación:**
```typescript
import crypto from 'crypto';

// Encriptar backup antes de descargar
const algorithm = 'aes-256-gcm';
const key = crypto.scryptSync(process.env.BACKUP_KEY!, 'salt', 32);
const iv = crypto.randomBytes(16);
const cipher = crypto.createCipheriv(algorithm, key, iv);
```

---

### 15. **Falta Validación de Tamaño de Archivos** 🟡 MEDIO
**Descripción:** No hay límite explícito en uploads

**Recomendación:**
```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// En endpoints de upload
if (file.size > 5 * 1024 * 1024) { // 5MB
  throw new Error('Archivo muy grande');
}
```

---

## 🔍 VULNERABILIDADES DE RIESGO BAJO (Prioridad 4)

16. **Falta Content Security Policy (CSP)**
17. **Versionado de API no implementado**
18. **Falta documentación de seguridad**
19. **Timeouts no configurados**
20. **Falta validación de tipos MIME en uploads**
21. **Variables de entorno en .env no todas documentadas**
22. **Falta política de expiración de contraseñas**

---

## ✅ ASPECTOS POSITIVOS DEL SISTEMA

1. ✅ **Bcrypt con salt rounds adecuado** (10 rounds)
2. ✅ **Uso de Drizzle ORM** previene muchos SQL injection
3. ✅ **HTTPS en producción** (Railway)
4. ✅ **Validación con Zod** en inputs
5. ✅ **Separación de roles** (admin, seller, technician, etc.)
6. ✅ **Sistema de sesiones** implementado
7. ✅ **JWT_SECRET configurable** por variable de entorno
8. ✅ **Base de datos separada** de la lógica de negocio
9. ✅ **Módulo de auditoría básico** implementado
10. ✅ **Status de usuarios** (active/inactive)

---

## 📝 PLAN DE REMEDIACIÓN RECOMENDADO

### Fase 1: Crítico (Inmediato - 1 semana)
1. ✅ Eliminar contraseñas hardcodeadas
2. ✅ Implementar rate limiting en login
3. ✅ Reducir tiempo de sesión a 4 horas
4. ✅ Implementar timeout por inactividad
5. ✅ Eliminar logs de información sensible

### Fase 2: Alto (2-3 semanas)
6. ✅ Implementar protección CSRF
7. ✅ Sanitizar queries SQL dinámicas
8. ✅ Agregar headers de seguridad (Helmet)
9. ✅ Implementar 2FA opcional
10. ✅ Mejorar sistema de permisos granulares

### Fase 3: Medio (1-2 meses)
11. ✅ Implementar encriptación de backups
12. ✅ Mejorar módulo de auditoría
13. ✅ Configurar CORS restrictivo
14. ✅ Validaciones de entrada completas
15. ✅ Límites de tamaño de archivos

### Fase 4: Bajo (3-6 meses)
16. ✅ Implementar CSP completo
17. ✅ Documentación de seguridad
18. ✅ Versionado de API
19. ✅ Política de contraseñas
20. ✅ Penetration testing externo

---

## 🛠️ HERRAMIENTAS RECOMENDADAS

### Análisis Estático
- **ESLint Security Plugin** - Detectar vulnerabilidades en código
- **npm audit** - Auditar dependencias
- **Snyk** - Monitoreo continuo de vulnerabilidades

### Testing
- **OWASP ZAP** - Pruebas de penetración automatizadas
- **Burp Suite** - Testing manual de APIs
- **SQLMap** - Testing de SQL injection

### Monitoreo
- **Sentry** - Tracking de errores y excepciones
- **LogRocket** - Session replay y debugging
- **New Relic / Datadog** - APM y monitoreo

---

## 📞 CONTACTO Y SEGUIMIENTO

Para implementar estas recomendaciones o consultas:
- **Prioridad:** Comenzar con vulnerabilidades críticas
- **Revisión:** Auditoría cada 6 meses
- **Testing:** Pruebas de penetración anuales

---

## 📄 ANEXOS

### A. Checklist de Seguridad OWASP Top 10 2021

| # | Vulnerabilidad | Estado | Notas |
|---|---|---|---|
| A01 | Broken Access Control | ⚠️ Parcial | Falta granularidad |
| A02 | Cryptographic Failures | ⚠️ Parcial | Sesiones OK, backups vulnerables |
| A03 | Injection | ⚠️ Parcial | SQL dinámico sin whitelist |
| A04 | Insecure Design | ⚠️ Parcial | Falta 2FA, CSRF |
| A05 | Security Misconfiguration | ❌ Vulnerable | Headers faltantes |
| A06 | Vulnerable Components | ✅ Aceptable | Dependencias actualizadas |
| A07 | Identification Failures | ⚠️ Parcial | Sesiones largas, sin 2FA |
| A08 | Software Integrity Failures | ✅ Aceptable | No aplica directamente |
| A09 | Security Logging Failures | ⚠️ Parcial | Logs sin protección |
| A10 | Server-Side Request Forgery | ✅ Aceptable | No detectado |

### B. Lista de Contraseñas a Cambiar Inmediatamente

```bash
# Estas contraseñas están en el código y deben eliminarse:
- "MPShop2026Admin!"
- "admin123"
- "usuario"

# Cambiar en producción:
- JWT_SECRET (usar generador criptográfico)
- ADMIN_PASSWORD (eliminar fallback)
- DATABASE_URL password component
```

### C. Comandos de Verificación

```bash
# Buscar contraseñas hardcodeadas
grep -r "password.*=" --include="*.ts" --exclude-dir=node_modules

# Buscar SQL dinámico
grep -r "query(\`" --include="*.ts" --exclude-dir=node_modules

# Auditar dependencias
npm audit
pnpm audit

# Verificar secrets en Git
git secrets --scan
```

---

**FIN DEL REPORTE DE AUDITORÍA**

_Este reporte fue generado automáticamente y debe ser revisado por un especialista en seguridad para validación._
