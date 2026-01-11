import { users } from "@shared/schema";
import type { User, InsertUser } from "@shared/schema";
import { db, eq, and } from "../base";
import type { IUsersStorage } from "../interfaces";

export class UsersStorage implements IUsersStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async listUsers(organisationId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.organisationId, organisationId));
  }

  async updateUserRole(userId: string, newRole: string, requesterId: string): Promise<User | undefined> {
    const requester = await this.getUser(requesterId);
    if (!requester || requester.role !== 'SUPER_ADMIN') {
      throw new Error('Only super admins can change user roles');
    }
    
    const targetUser = await this.getUser(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }
    
    if (targetUser.organisationId !== requester.organisationId) {
      throw new Error('Cannot modify users from other organisations');
    }
    
    if (requesterId === userId && requester.role === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      throw new Error('Super admin cannot demote themselves. Promote another user to super admin first.');
    }
    
    if (newRole === 'SUPER_ADMIN') {
      const existingSuperAdmin = await this.getSuperAdmin(requester.organisationId);
      if (existingSuperAdmin && existingSuperAdmin.id !== userId) {
        await db.update(users)
          .set({ role: 'ADMIN' as any })
          .where(eq(users.id, existingSuperAdmin.id));
      }
    }
    
    const [updated] = await db.update(users)
      .set({ role: newRole as any })
      .where(eq(users.id, userId))
      .returning();
    return updated || undefined;
  }

  async getSuperAdmin(organisationId: string): Promise<User | undefined> {
    const [superAdmin] = await db.select().from(users)
      .where(and(eq(users.organisationId, organisationId), eq(users.role, 'SUPER_ADMIN')));
    return superAdmin || undefined;
  }
}

export const usersStorage = new UsersStorage();
