# El Niño Preemption Engine (EPE) — Master Implementation & Build-Day Plan

A defensible, transparent, AI-assisted drought preemption and resource allocation platform for district authorities, comparing proactive intervention against historical reactive relief baselines.

---

## 1. Overview & Core Concept

### What It Does
The El Niño Preemption Engine (EPE) helps state and district disaster management authorities anticipate agricultural drought conditions 15 to 60 days ahead. Instead of reacting after crops fail and reservoirs run dry, EPE:
1. Ingests rainfall departures, soil moisture anomalies (SPI, VCI), and reservoir storage levels.
2. Identifies talukas and districts reaching critical stress thresholds.
3. Allocates limited emergency relief resources (water tanker trips, cattle fodder kits, contingency seeds, and direct relief vouchers) using a transparent, multi-objective optimization rule.
4. Explains every allocation decision, identifies unmet demand and binding bottlenecks (fleet capacity, budget caps), and logs decisions to an auditable ledger.
5. Directly benchmarks the preemption strategy against a **status-quo baseline** (traditional population-share allocation) using identical inputs to demonstrate tangible loss reduction and equity improvements.

---

## 2. Completed Backend Engineering & Infrastructure (Status: COMPLETED)

### Database: Cloud SQL (PostgreSQL Developer Edition)
- **Instance**: `ai-studio-43d08e74` in region `asia-southeast1` (connected via local Cloud SQL Auth Proxy).
- **ORM**: Drizzle ORM with TypeScript schema definitions in `src/db/schema.ts`.
- **Database Tables Provisioned & Verified**:
  - `users`: Synchronized officer profiles linked to Firebase Auth UID, email, and role.
  - `allocation_runs`: Persistent decision ledger storing run IDs, budget, multi-objective parameters, demand satisfaction metrics, district breakdown, and binding constraints.
  - `audit_events`: Immutable audit trail recording timestamps, actors, actions, targets, and administrative descriptions.
  - `farmer_claims`: Privacy-preserving PMFBY distress records with crop types, claimed loss, spectral loss index, and DBT authorization statuses (no farmer PII collected).

### Authentication: Firebase Auth & Google OAuth
- **OAuth Setup**: Configured with scopes `openid`, `email`, and `profile` in `firebase-applet-config.json`.
- **Backend Token Middleware**: `src/middleware/auth.ts` with `requireAuth` and `optionalAuth` verifying Firebase ID tokens via `firebase-admin`.
- **Officer Profile Synchronization**: `POST /api/auth/sync` upserts authenticated officers directly to PostgreSQL `users` table and writes an audit event.

### Verified Backend Endpoints
- `GET /api/runs`: Returns all committed allocation plans from Cloud SQL (`source: "cloud_sql_postgres"`).
- `POST /api/runs`: Commits new optimization plans into PostgreSQL with transactional audit event logging.
- `DELETE /api/runs/:id`: Removes plans from ledger with database synchronization.
- `GET /api/audit-log`: Returns complete chronological administrative history from PostgreSQL.
- `POST /api/audit-log`: Records manual or system actions into the persistent audit trail.
- `GET /api/claims`: Retrieves PMFBY distress claims from PostgreSQL.
- `PATCH /api/claims/:id`: Updates verification status and logs officer authorization.
- `POST /api/auth/sync`: Syncs Google/Firebase authenticated officer identities.

---

## 3. Provenance & Algorithmic Integrity

- **Geography**: Madhya Pradesh (focusing on Bundelkhand, Chambal, Malwa, and Nimar: Tikamgarh, Chhatarpur, Barwani, Sheopur, Shivpuri, Khargone, Dewas, Dhar).
- **Core Engine**: Unified dual-stage solver comparing EPE against the status-quo baseline with identical district demands.
- **Uncertainty Disclosures**: Explicit 15–60 day horizons with P10–P90 confidence envelope badges.
- **Farmer Privacy**: Privacy-preserving synthetic identifiers; zero farmer PII collected.
