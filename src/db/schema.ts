import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users table linked to Firebase Auth UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('State Relief Officer, Grade I'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Official Preemption Allocation Runs (Permanent Decision Ledger)
export const allocationRuns = pgTable('allocation_runs', {
  id: serial('id').primaryKey(),
  runId: text('run_id').notNull().unique(),
  title: text('title').notNull(),
  officerName: text('officer_name').notNull(),
  officerRole: text('officer_role').default('State Disaster Management Authority'),
  geography: text('geography').notNull().default('Madhya Pradesh (Bundelkhand & Nimar focus)'),
  totalBudgetCr: integer('total_budget_cr').notNull(),
  objective: text('objective').notNull(),
  parameters: text('parameters').notNull(), // JSON string
  metrics: text('metrics').notNull(), // JSON string
  districtBreakdown: text('district_breakdown').notNull(), // JSON string
  status: text('status').notNull().default('Committed & Dispatched'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 3. System & Administrative Audit Trail Events
export const auditEvents = pgTable('audit_events', {
  id: serial('id').primaryKey(),
  eventId: text('event_id').notNull().unique(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  target: text('target').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Farmer PMFBY Crop Distress Claims
export const farmerClaims = pgTable('farmer_claims', {
  id: serial('id').primaryKey(),
  claimId: text('claim_id').notNull().unique(),
  farmerName: text('farmer_name').notNull(),
  district: text('district').notNull(),
  taluka: text('taluka').notNull(),
  claimedLoss: integer('claimed_loss').notNull(),
  spectralLossIndex: integer('spectral_loss_index').notNull(),
  status: text('status').notNull().default('Needs Review'),
  confidence: integer('confidence').notNull().default(85),
  plotSizeHectares: integer('plot_size_hectares').notNull().default(2),
  cropType: text('crop_type').notNull().default('Soybean'),
  submissionDate: text('submission_date').notNull(),
  authorizedBy: text('authorized_by'),
  authorizedAt: timestamp('authorized_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
