import { db } from "../db";
import { eq, and, or, desc, sql, inArray, count, gte, lte, lt, ilike, isNotNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export { db, eq, and, or, desc, sql, inArray, count, gte, lte, lt, ilike, isNotNull };
export type { SQL };

export type SQLCondition = SQL<unknown> | undefined;
