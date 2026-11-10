# Frontend API Gestion
## Creditos
    Desarrollado por:
    Alberto Mario Galvis Echeverria   0222410070
    Anthony García Moreno             0222410049
    Keynner canchila                  6902510034
    Sebastian Salom Pardo             0222410067
    Jeronimo Duque Agudelo            0222410069
    Camilo Issac Acevedo Rueda        0222410036
    Camilo Andres Buelvas Bornacelly  0222410060
    Jairo  Jimenez                    0222410040

Frontend local para consumir la **Analytics Management API**. Esta interfaz está hecha con Vite, React, TypeScript y Tailwind CSS, bajo un diseño estilo **Command Desk** (paneles rectos, cortes diagonales, alto contraste, cero bordes redondeados).

## Requisitos

- Node.js 20.x o superior.
- La API backend en `API GESTION` corriendo en el puerto `3000`.
- El servidor local de autenticación de la API corriendo en el puerto `3001`.

## Instalación

```bash
npm install
```

## Ejecutar en local

Abre **tres terminales separadas** y ejecuta en este orden:

**Terminal 1 — Servidor de autenticación (Auth):**

```bash
cd "C:\Users\Vss\Documents\Google AntiGravity\API GESTION"
npm run auth:local
```

> Levanta el emisor de JWT/JWKS local en el puerto `3001`.

**Terminal 2 — API Backend:**

```bash
cd "C:\Users\Vss\Documents\Google AntiGravity\API GESTION"
npm run dev
```

> Levanta la API en `http://localhost:3000`. Espera a ver `✓ Ready`.

**Terminal 3 — Frontend:**

```bash
cd "C:\Users\Vss\Documents\Google AntiGravity\FRONTEND API GESTION"
npm run dev
```

Abre la URL que muestre Vite (normalmente `http://127.0.0.1:5173/`).

---

## Configuración de Proxy

El frontend usa proxies de Vite (configurados en `vite.config.ts`) para evitar problemas de CORS:

| Ruta         | Destino                       | Propósito                         |
|--------------|-------------------------------|-----------------------------------|
| `/api/*`     | `http://127.0.0.1:3000`       | Todas las peticiones a la API     |
| `/auth/*`    | `http://127.0.0.1:3001`       | Obtención de tokens JWT locales   |

---

## Uso del Dashboard

Al abrir la interfaz, completa los campos de conexión:

| Campo         | Valor recomendado                                  |
|---------------|----------------------------------------------------|
| Client ID     | `local-dashboard`                                  |
| Scopes        | `analytics:read analytics:read:institution`        |
| Program Claim | *(vacío para acceso global)*                       |

### Filtros disponibles

El dashboard actualiza los datos en tiempo real al cambiar cualquier filtro:

- **Periodo** (`termId`): `2024-FALL`, `2025-SPRING`, `2025-FALL`, `2026-SPRING`
- **Programa** (`programId`): `CS`, `BUS`, `NUR`, `EDU` — deja en blanco para ver todos
- **Modalidad** (`modality`): `online`, `hybrid`, `onsite`
- **Dropout mínimo** (`dropoutRate`): porcentaje mínimo de deserción para filtrar cursos

> ⚠️ **Evita probar con el programa `SMALL`** salvo que quieras validar el comportamiento FERPA. Ese programa tiene 8 estudiantes y la API exige mínimo 10 para devolver métricas agregadas — devuelve un `403 cohort-too-small`.

---

## Funcionalidades

### Botón "Operaciones"
Carga simultáneamente las métricas operativas del sistema y los **Audit Logs** (historial de accesos de seguridad). Requiere scopes `analytics:audit:read`. El panel de auditoría se actualiza en la columna central del dashboard.

### Botón "Exportar"
Genera un archivo **CSV real** con las métricas de todos los cursos que coincidan con los filtros activos en ese momento. Columnas exportadas:

```
course_id, course_code, course_title, program_id, term_id, modality,
section_count, enrollment_count, pass_rate, fail_rate, dropout_rate,
withdrawal_rate, gpa_mean, gpa_median, headcount, retention_rate
```

El proceso es asíncrono: el botón muestra un indicador de carga mientras el backend procesa el job, y al completarse aparece el enlace de descarga. Los archivos se guardan en `API GESTION/data/exports/`.

---

## Scripts disponibles

```bash
npm run dev        # Servidor de desarrollo con HMR
npm run build      # Compilación TypeScript + bundle de producción (Vite)
npm run preview    # Servidor local para previsualizar el bundle de producción
```

## Verificación del build

```bash
npm run build
```

Ejecuta el chequeo de tipos TypeScript (`tsc -b`) y genera el bundle optimizado en `dist/`. Un build exitoso garantiza que no hay errores de tipos ni de compilación.

---

## Notas de Arquitectura

- **Tokens JWT:** La interfaz emite tokens locales usando `POST /auth/token` a través del proxy. Los tokens son efímeros y firmados con RS256.
- **Scopes de seguridad:** Cada acción requiere un scope específico:
  - `analytics:read` — Lectura de métricas generales
  - `analytics:read:institution` — Métricas institucionales
  - `analytics:audit:read` — Lectura de logs de auditoría
  - `analytics:export` — Generación de exportaciones CSV
- **Privacidad FERPA:** La API rechaza automáticamente consultas con menos de 10 estudiantes para proteger la privacidad individual.
- **Diseño Command Desk:** La interfaz usa paneles rectos con cortes diagonales, paleta de alto contraste y cero bordes redondeados.
