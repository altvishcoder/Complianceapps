import { Router, Response } from "express";
import { requireAuth, type AuthenticatedRequest } from "../session";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { z } from "zod";
import { auth } from "../auth";
import { fromNodeHeaders } from "better-auth/node";

export const assistantRouter = Router();

const ORG_ID = "default-org";

function getOrgId(req: AuthenticatedRequest): string {
  return req.user?.organisationId || ORG_ID;
}

// ===== AI ASSISTANT CHAT ENDPOINT (Streaming) =====
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
});

assistantRouter.post("/assistant/chat", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request format", details: parseResult.error.issues });
    }
    
    const { messages } = parseResult.data;
    
    const { chatWithAssistant } = await import('../services/ai-assistant');
    const result = await chatWithAssistant(messages, user.organisationId || undefined);
    
    if (result.success) {
      res.json({ message: result.message, suggestions: result.suggestions || [] });
    } else {
      res.status(500).json({ error: result.error || "Failed to get response" });
    }
  } catch (error) {
    console.error("AI Assistant error:", error);
    res.status(500).json({ error: "Failed to process chat request" });
  }
});

// ===== AI ASSISTANT ANALYTICS ENDPOINT =====
assistantRouter.get("/assistant/analytics", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const days = parseInt(req.query.days as string) || 7;
    
    const { getChatbotAnalytics } = await import('../services/ai-assistant');
    const analytics = await getChatbotAnalytics(days);
    
    res.json(analytics);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

// ===== KNOWLEDGE DOCUMENT MANAGEMENT (RAG Training) =====
assistantRouter.get("/knowledge", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const category = req.query.category as string | undefined;
    
    const { getKnowledgeDocuments } = await import('../services/ai-assistant');
    const documents = await getKnowledgeDocuments(category);
    
    res.json(documents);
  } catch (error) {
    console.error("Get knowledge error:", error);
    res.status(500).json({ error: "Failed to get knowledge documents" });
  }
});

assistantRouter.get("/knowledge/categories", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { getKnowledgeCategories } = await import('../services/ai-assistant');
    const categories = await getKnowledgeCategories();
    
    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to get categories" });
  }
});

assistantRouter.get("/knowledge/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const { getKnowledgeDocument } = await import('../services/ai-assistant');
    const document = await getKnowledgeDocument(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    res.json(document);
  } catch (error) {
    console.error("Get knowledge document error:", error);
    res.status(500).json({ error: "Failed to get document" });
  }
});

assistantRouter.post("/knowledge", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { title, content, category, sourceType, metadata } = req.body;
    
    if (!title || !content || !category || !sourceType) {
      return res.status(400).json({ error: "Missing required fields: title, content, category, sourceType" });
    }
    
    const { createKnowledgeDocument } = await import('../services/ai-assistant');
    const result = await createKnowledgeDocument({
      title,
      content,
      category,
      sourceType,
      metadata,
    });
    
    if (result.success) {
      res.status(201).json({ id: result.id, message: "Document created successfully" });
    } else {
      res.status(500).json({ error: result.error || "Failed to create document" });
    }
  } catch (error) {
    console.error("Create knowledge error:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
});

assistantRouter.put("/knowledge/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { updateKnowledgeDocument } = await import('../services/ai-assistant');
    const result = await updateKnowledgeDocument(req.params.id, req.body);
    
    if (result.success) {
      res.json({ message: "Document updated successfully" });
    } else {
      res.status(result.error === 'Document not found' ? 404 : 500).json({ error: result.error });
    }
  } catch (error) {
    console.error("Update knowledge error:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
});

assistantRouter.delete("/knowledge/:id", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(401).json({ error: "Invalid user" });
    }
    
    const adminRoles = ['LASHAN_SUPER_USER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
    if (!adminRoles.includes(user.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { deleteKnowledgeDocument } = await import('../services/ai-assistant');
    const result = await deleteKnowledgeDocument(req.params.id);
    
    if (result.success) {
      res.json({ message: "Document deleted successfully" });
    } else {
      res.status(500).json({ error: result.error || "Failed to delete document" });
    }
  } catch (error) {
    console.error("Delete knowledge error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});
