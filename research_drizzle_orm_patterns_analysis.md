# Drizzle ORM Implementation Patterns Analysis

_Generated: 2025-08-19 | Sources: 12_

## 🎯 Quick Reference

<key-points>
- Drizzle ORM provides type-safe, SQL-like database operations with TypeScript
- Migration system supports both database-first and codebase-first approaches
- Guest user validation can be implemented with proper UUID handling
- Type safety achieved through schema-based TypeScript generation
- Production-ready authentication patterns using adapter systems
</key-points>

## 📋 Overview

<summary>
Analysis of Drizzle ORM implementation patterns extracted from multiple Next.js projects to address RoboRail's current issues with guest user ID validation, database type safety, migration management, and authentication flow. The analysis focuses on practical solutions that can be adapted to fix existing problems in the RoboRail codebase.
</summary>

## 🔧 Implementation Details

<details>

### Database Schema Setup

**Core Schema Pattern (from nextjs_drizzle_better-auth)**:
```typescript
// src/db/schema.ts
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
});

// Guest user support pattern
export const guestUsers = pgTable("guest_users", {
  id: text("id").primaryKey(), // UUID format
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  anonymous: boolean("anonymous").default(true).notNull()
});
```

**Database Connection Pattern**:
```typescript
// src/db/drizzle.ts
import { config } from "dotenv";
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

config({ path: ".env" });

export const db = drizzle(process.env.DATABASE_URL!, { schema });
export type DbType = typeof db;
```

### Migration System Implementation

**Drizzle Configuration**:
```typescript
// drizzle.config.ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

**Migration Commands**:
```bash
# Generate migrations from schema changes
bunx drizzle-kit generate

# Apply migrations to database
bunx drizzle-kit migrate

# Push schema directly to database (development)
bunx drizzle-kit push
```

**Migration File Example**:
```sql
-- drizzle/0001_guest_users.sql
CREATE TABLE "guest_users" (
  "id" text PRIMARY KEY,
  "session_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_active_at" timestamp DEFAULT now() NOT NULL,
  "anonymous" boolean DEFAULT true NOT NULL
);

CREATE UNIQUE INDEX "guest_users_session_id_idx" ON "guest_users" ("session_id");
```

### Type Safety Patterns

**Generated Types Usage**:
```typescript
// Auto-generated from schema
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { user, guestUsers } from './schema';

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;
export type GuestUser = InferSelectModel<typeof guestUsers>;
export type NewGuestUser = InferInsertModel<typeof guestUsers>;
```

**Type-Safe Query Examples**:
```typescript
// Type-safe select with relations
const usersWithPosts = await db.query.user.findMany({
  with: {
    posts: true,
  },
});

// Type-safe insert with validation
const newUser = await db.insert(user).values({
  id: generateId(),
  name: 'John Doe',
  email: 'john@example.com',
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}).returning();
```

### Authentication Implementation

**Better Auth Integration**:
```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle";
import * as schema from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

</details>

## ⚠️ RoboRail Current Issues & Solutions

<warnings>

### Issue 1: Guest User ID Validation Inconsistency

**Current Problem** (from `lib/server/api.ts`):
```typescript
// Inconsistent validation between dev/prod
if (isDevelopment) {
  const isUuidFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
  if (!isUuidFormat) {
    throw new Error("Invalid guest user ID format")
  }
} else {
  // Production queries database but may fail if table doesn't exist
  const { data: userRecord, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("anonymous", true)
    .maybeSingle()
}
```

**Drizzle Solution**:
```typescript
// Unified guest user validation with Drizzle
export async function validateGuestUser(userId: string): Promise<boolean> {
  // Validate UUID format first
  const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
  if (!isValidUuid) return false;

  try {
    // Check if guest user exists in database
    const guestUser = await db.select()
      .from(guestUsers)
      .where(eq(guestUsers.id, userId))
      .limit(1);
    
    return guestUser.length > 0;
  } catch (error) {
    // Handle gracefully - could be table doesn't exist yet
    console.warn('Guest user validation failed:', error);
    return isValidUuid; // Fall back to format validation
  }
}
```

### Issue 2: Database Type Safety Problems

**Current Problem**: Mixed Supabase client types and inconsistent error handling

**Drizzle Solution**:
```typescript
// Type-safe database operations
export async function getUserMessageCount(userId: string, isAuthenticated: boolean) {
  try {
    if (isAuthenticated) {
      const result = await db.select({
        dailyCount: users.dailyMessageCount,
        dailyProCount: users.dailyProMessageCount,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
      return result[0] || { dailyCount: 0, dailyProCount: 0 };
    } else {
      const result = await db.select({
        dailyCount: guestUsers.dailyMessageCount,
        dailyProCount: guestUsers.dailyProMessageCount,
      })
      .from(guestUsers)
      .where(eq(guestUsers.id, userId))
      .limit(1);
      
      return result[0] || { dailyCount: 0, dailyProCount: 0 };
    }
  } catch (error) {
    throw new DatabaseError('Failed to get message count', { cause: error });
  }
}
```

### Issue 3: Migration Management Complexity

**Current Problem**: Manual SQL migrations in `/supabase/migrations/`

**Drizzle Solution**:
```typescript
// Automated migration generation from schema changes
// 1. Update schema.ts with new columns/tables
// 2. Run: bunx drizzle-kit generate
// 3. Review generated SQL
// 4. Apply: bunx drizzle-kit migrate

// Example schema evolution
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // ... existing columns ...
  
  // New columns added - automatically generates migration
  apiKeyEncrypted: text("api_key_encrypted"),
  preferredModel: text("preferred_model").default("gpt-4"),
  dailyMessageCount: integer("daily_message_count").default(0),
  dailyProMessageCount: integer("daily_pro_message_count").default(0),
});
```

</warnings>

## 🔧 Implementation Recommendations

<details>

### 1. Migrate to Drizzle ORM Gradually

**Step 1**: Set up Drizzle alongside existing Supabase
```typescript
// lib/db/drizzle.ts - New Drizzle setup
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });
```

**Step 2**: Create schema mirroring existing Supabase tables
```typescript
// lib/db/schema.ts - Mirror existing structure
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  anonymous: boolean("anonymous").default(false),
  dailyMessageCount: integer("daily_message_count").default(0),
  dailyProMessageCount: integer("daily_pro_message_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Step 3**: Replace problematic functions one by one
```typescript
// Replace validateUserIdentity with Drizzle version
export async function validateUserIdentityDrizzle(
  userId: string,
  isAuthenticated: boolean
): Promise<typeof db | null> {
  if (isAuthenticated) {
    const user = await db.select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.anonymous, false)))
      .limit(1);
    
    if (user.length === 0) {
      throw new Error("Invalid authenticated user");
    }
  } else {
    const isValid = await validateGuestUser(userId);
    if (!isValid) {
      throw new Error("Invalid guest user ID");
    }
  }
  
  return db;
}
```

### 2. Enhanced Guest User System

```typescript
// lib/guest-users.ts - Improved guest user management
export async function createGuestUser(): Promise<string> {
  const guestId = crypto.randomUUID();
  
  await db.insert(guestUsers).values({
    id: guestId,
    sessionId: crypto.randomUUID(),
    createdAt: new Date(),
    lastActiveAt: new Date(),
    anonymous: true,
  });
  
  return guestId;
}

export async function getOrCreateGuestUser(userId?: string): Promise<string> {
  if (userId) {
    const isValid = await validateGuestUser(userId);
    if (isValid) {
      // Update last active time
      await db.update(guestUsers)
        .set({ lastActiveAt: new Date() })
        .where(eq(guestUsers.id, userId));
      
      return userId;
    }
  }
  
  return createGuestUser();
}
```

### 3. Type-Safe Error Handling

```typescript
// lib/errors.ts - Centralized error handling
export class DatabaseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = options?.cause;
  }
}

export class ValidationError extends Error {
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Usage in business logic
try {
  const result = await db.select()...;
} catch (error) {
  if (error instanceof PostgresError) {
    throw new DatabaseError('Database operation failed', { cause: error });
  }
  throw error;
}
```

</details>

## 🔗 Resources

<references>
- [Drizzle ORM Official Docs](https://orm.drizzle.team/docs) - Complete documentation
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle) - Authentication integration
- [Drizzle Kit Migration Guide](https://orm.drizzle.team/docs/migrations) - Migration management
- [TypeScript Type Inference](https://orm.drizzle.team/docs/goodies#type-inference) - Type safety patterns
- [Production Deployment Guide](https://orm.drizzle.team/docs/connect-neon) - Deployment patterns
</references>

## 🏷️ Metadata

<meta>
research-date: 2025-08-19
confidence: high
version-checked: Drizzle ORM v0.36+, Next.js 15
applicability: RoboRail guest user validation, type safety, migration management
</meta>