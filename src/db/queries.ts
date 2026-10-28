import { db, isCloudSqlAvailable } from './index.ts';
import { allocationRuns, auditEvents, farmerClaims, users } from './schema.ts';
import { desc, eq } from 'drizzle-orm';
import type { AllocationRun, AuditLogItem, FarmerClaim } from '../types/index.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const LEDGER_FILE = path.join(DATA_DIR, 'audit_ledger.json');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_events.json');
const CLAIMS_FILE = path.join(DATA_DIR, 'farmer_claims.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('Error creating data directory:', err);
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    ensureDataDir();
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T) {
  try {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`Error writing to ${filePath}:`, err);
  }
}

/**
 * Fetch all committed allocation runs from Cloud SQL (or persistent ledger fallback)
 */
export async function getAllAllocationRuns(): Promise<AllocationRun[]> {
  if (isCloudSqlAvailable() && db) {
    try {
      const rows = await db.select().from(allocationRuns).orderBy(desc(allocationRuns.createdAt));
      if (rows && rows.length > 0) {
        return rows.map((r: any) => {
          let params = {};
          let metrics = {};
          let districtBreakdown = [];
          try { params = JSON.parse(r.parameters); } catch {}
          try { metrics = JSON.parse(r.metrics); } catch {}
          try { districtBreakdown = JSON.parse(r.districtBreakdown); } catch {}

          const d = r.createdAt ? new Date(r.createdAt) : new Date();
          const formattedDate = d.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST';

          return {
            runId: r.runId,
            title: r.title,
            timestamp: d.toISOString(),
            formattedDate,
            officerName: r.officerName,
            officerRole: r.officerRole || 'State Disaster Management Authority',
            geography: r.geography,
            totalBudgetCr: r.totalBudgetCr,
            objective: r.objective as any,
            parameters: params as any,
            metrics: metrics as any,
            districtBreakdown,
            status: r.status as any,
            notes: r.notes || ''
          };
        });
      }
    } catch (error: any) {
      console.warn('Cloud SQL query for allocation runs unavailable, using ledger store:', error?.message || error);
    }
  }

  // Fallback to persistent JSON ledger
  return readJsonFile<AllocationRun[]>(LEDGER_FILE, []);
}

/**
 * Insert a new allocation run and log an audit event
 */
export async function createAllocationRun(payload: Partial<AllocationRun>): Promise<AllocationRun> {
  const runId = payload.runId || `EPE-MP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST';

  const newRecord = {
    runId,
    title: payload.title || `Preemptive Allocation Plan (${payload.geography || 'Madhya Pradesh'})`,
    officerName: payload.officerName || 'Relief Officer',
    officerRole: payload.officerRole || 'State Disaster Management Authority',
    geography: payload.geography || 'Madhya Pradesh (Bundelkhand & Nimar focus)',
    totalBudgetCr: payload.totalBudgetCr || payload.parameters?.totalBudgetCr || 140,
    objective: payload.objective || payload.parameters?.objective || 'critical_needs_first',
    parameters: JSON.stringify(payload.parameters || {}),
    metrics: JSON.stringify(payload.metrics || {}),
    districtBreakdown: JSON.stringify(payload.districtBreakdown || []),
    status: payload.status || 'Committed & Dispatched',
    notes: payload.notes || 'Official allocation committed under State Disaster Management Framework.',
    createdAt: now
  };

  if (isCloudSqlAvailable() && db) {
    try {
      await db.insert(allocationRuns).values(newRecord);

      // Record audit event in SQL
      const eventId = `evt-${Date.now()}`;
      await db.insert(auditEvents).values({
        eventId,
        actor: `${newRecord.officerName} (${newRecord.officerRole})`,
        action: 'ALLOCATION_COMMITTED',
        target: runId,
        details: `Committed ₹${newRecord.totalBudgetCr} Cr allocation across Madhya Pradesh drought districts.`
      });
    } catch (error: any) {
      console.warn('Notice saving allocation run to Cloud SQL:', error?.message || error);
    }
  }

  const createdRun: AllocationRun = {
    runId,
    title: newRecord.title,
    timestamp: now.toISOString(),
    formattedDate,
    officerName: newRecord.officerName,
    officerRole: newRecord.officerRole,
    geography: newRecord.geography,
    totalBudgetCr: newRecord.totalBudgetCr,
    objective: newRecord.objective as any,
    parameters: payload.parameters || ({} as any),
    metrics: payload.metrics || ({} as any),
    districtBreakdown: payload.districtBreakdown || [],
    status: newRecord.status as any,
    notes: newRecord.notes
  };

  // Always update persistent local ledger storage
  const runs = readJsonFile<AllocationRun[]>(LEDGER_FILE, []);
  runs.unshift(createdRun);
  writeJsonFile(LEDGER_FILE, runs);

  // Append audit event
  const events = readJsonFile<AuditLogItem[]>(AUDIT_LOG_FILE, []);
  events.unshift({
    id: `evt-${Date.now()}`,
    timestamp: now.toISOString(),
    actor: `${newRecord.officerName} (${newRecord.officerRole})`,
    action: 'ALLOCATION_COMMITTED',
    target: runId,
    details: `Committed ₹${newRecord.totalBudgetCr} Cr allocation across drought-affected districts.`
  });
  writeJsonFile(AUDIT_LOG_FILE, events.slice(0, 100));

  return createdRun;
}

/**
 * Delete an allocation run by runId
 */
export async function deleteAllocationRunByRunId(runId: string): Promise<boolean> {
  if (isCloudSqlAvailable() && db) {
    try {
      await db.delete(allocationRuns).where(eq(allocationRuns.runId, runId));
    } catch (error: any) {
      console.warn('Notice deleting allocation run from Cloud SQL:', error?.message || error);
    }
  }

  const runs = readJsonFile<AllocationRun[]>(LEDGER_FILE, []);
  const filtered = runs.filter(r => r.runId !== runId);
  writeJsonFile(LEDGER_FILE, filtered);
  return true;
}

/**
 * Fetch chronological audit events from Cloud SQL or local store
 */
export async function getAllAuditEvents(): Promise<AuditLogItem[]> {
  if (isCloudSqlAvailable() && db) {
    try {
      const rows = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt));
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.eventId,
          timestamp: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          actor: r.actor,
          action: r.action,
          target: r.target,
          details: r.details
        }));
      }
    } catch (error: any) {
      console.warn('Notice fetching audit events from Cloud SQL:', error?.message || error);
    }
  }

  return readJsonFile<AuditLogItem[]>(AUDIT_LOG_FILE, []);
}

/**
 * Record an audit event
 */
export async function logAuditEventInDb(actor: string, action: string, target: string, details: string): Promise<AuditLogItem> {
  const eventId = `evt-${Date.now()}`;
  const now = new Date();

  if (isCloudSqlAvailable() && db) {
    try {
      await db.insert(auditEvents).values({
        eventId,
        actor,
        action,
        target,
        details,
        createdAt: now
      });
    } catch (error: any) {
      console.warn('Notice recording audit event to Cloud SQL:', error?.message || error);
    }
  }

  const item: AuditLogItem = {
    id: eventId,
    timestamp: now.toISOString(),
    actor,
    action,
    target,
    details
  };

  const events = readJsonFile<AuditLogItem[]>(AUDIT_LOG_FILE, []);
  events.unshift(item);
  writeJsonFile(AUDIT_LOG_FILE, events.slice(0, 100));

  return item;
}

/**
 * Upsert user profile synchronized with Firebase Auth UID
 */
export async function getOrCreateUser(uid: string, email: string, name?: string) {
  if (isCloudSqlAvailable() && db) {
    try {
      const result = await db.insert(users)
        .values({
          uid,
          email,
          name: name || null,
          role: 'State Relief Officer, Grade I'
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {
            email,
            name: name || null
          }
        })
        .returning();

      return result[0];
    } catch (error: any) {
      console.warn('Notice upserting user in Cloud SQL:', error?.message || error);
    }
  }

  const usersList = readJsonFile<any[]>(USERS_FILE, []);
  const existing = usersList.find(u => u.uid === uid);
  if (existing) {
    if (name) existing.name = name;
    if (email) existing.email = email;
    writeJsonFile(USERS_FILE, usersList);
    return existing;
  }

  const newUser = {
    id: usersList.length + 1,
    uid,
    email,
    name: name || null,
    role: 'State Relief Officer, Grade I',
    createdAt: new Date().toISOString()
  };
  usersList.push(newUser);
  writeJsonFile(USERS_FILE, usersList);
  return newUser;
}

/**
 * Fetch all PMFBY claims from Cloud SQL or storage
 */
export async function getAllClaimsFromDb(): Promise<FarmerClaim[]> {
  if (isCloudSqlAvailable() && db) {
    try {
      const rows = await db.select().from(farmerClaims).orderBy(desc(farmerClaims.createdAt));
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.claimId,
          farmerName: r.farmerName,
          district: r.district,
          taluka: r.taluka,
          claimedLoss: r.claimedLoss,
          spectralLossIndex: r.spectralLossIndex,
          status: r.status as any,
          confidence: r.confidence,
          plotSizeHectares: r.plotSizeHectares,
          cropType: r.cropType,
          submissionDate: r.submissionDate,
          authorizedBy: r.authorizedBy || undefined,
          authorizedAt: r.authorizedAt ? r.authorizedAt.toISOString() : undefined
        }));
      }
    } catch (error: any) {
      console.warn('Notice querying Cloud SQL for claims:', error?.message || error);
    }
  }

  return readJsonFile<FarmerClaim[]>(CLAIMS_FILE, []);
}

/**
 * Update claim review status
 */
export async function updateClaimStatusInDb(claimId: string, status: string, authorizedBy?: string) {
  const now = new Date();

  if (isCloudSqlAvailable() && db) {
    try {
      const updated = await db.update(farmerClaims)
        .set({
          status,
          authorizedBy: authorizedBy || 'Relief Officer',
          authorizedAt: now
        })
        .where(eq(farmerClaims.claimId, claimId))
        .returning();

      if (updated && updated.length > 0) {
        return updated[0];
      }
    } catch (error: any) {
      console.warn('Notice updating claim status in Cloud SQL:', error?.message || error);
    }
  }

  const claims = readJsonFile<FarmerClaim[]>(CLAIMS_FILE, []);
  const targetClaim = claims.find(c => c.id === claimId);
  if (targetClaim) {
    targetClaim.status = status as any;
    targetClaim.authorizedBy = authorizedBy || 'Relief Officer';
    targetClaim.authorizedAt = now.toISOString();
    writeJsonFile(CLAIMS_FILE, claims);
    return targetClaim;
  }

  return {
    id: claimId,
    status,
    authorizedBy: authorizedBy || 'Relief Officer',
    authorizedAt: now.toISOString()
  };
}

/**
 * Seed initial claims if database table or local cache is empty
 */
export async function seedInitialClaimsIfEmpty(initialClaimsList: FarmerClaim[]) {
  // 1. Ensure local claims store is populated
  const currentLocal = readJsonFile<FarmerClaim[]>(CLAIMS_FILE, []);
  if (currentLocal.length === 0 && initialClaimsList.length > 0) {
    writeJsonFile(CLAIMS_FILE, initialClaimsList);
  }

  // 2. If Cloud SQL is configured, sync to postgres table as well
  if (isCloudSqlAvailable() && db) {
    try {
      const existing = await db.select().from(farmerClaims).limit(1);
      if (existing.length === 0 && initialClaimsList.length > 0) {
        for (const c of initialClaimsList) {
          await db.insert(farmerClaims).values({
            claimId: c.id,
            farmerName: c.farmerName,
            district: c.district,
            taluka: c.taluka,
            claimedLoss: Math.round(c.claimedLoss),
            spectralLossIndex: Math.round(c.spectralLossIndex),
            status: c.status,
            confidence: Math.round(c.confidence),
            plotSizeHectares: Math.round(c.plotSizeHectares),
            cropType: c.cropType,
            submissionDate: c.submissionDate
          });
        }
      }
    } catch (error: any) {
      console.warn('Notice checking Cloud SQL claims table:', error?.message || error);
    }
  }
}
