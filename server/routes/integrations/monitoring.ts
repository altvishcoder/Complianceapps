import { Router } from "express";
import { storage } from "../../storage";

export const integrationsMonitoringRouter = Router();

integrationsMonitoringRouter.get("/admin/coverage", async (req, res) => {
  try {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    const coverageFile = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    
    try {
      await fs.access(coverageFile);
    } catch {
      return res.status(404).json({ 
        error: "Coverage data not found",
        message: "Run 'npx vitest run --coverage' to generate coverage data"
      });
    }
    
    const coverageData = await fs.readFile(coverageFile, 'utf-8');
    const summary = JSON.parse(coverageData);
    
    const totals = summary.total;
    
    const modules: Record<string, { lines: number; statements: number; functions: number; branches: number; files: number }> = {};
    
    Object.entries(summary).forEach(([filePath, data]: [string, any]) => {
      if (filePath === 'total') return;
      
      let moduleName = 'other';
      if (filePath.includes('/server/')) moduleName = 'server';
      else if (filePath.includes('/client/src/pages/')) moduleName = 'pages';
      else if (filePath.includes('/client/src/components/')) moduleName = 'components';
      else if (filePath.includes('/client/src/')) moduleName = 'client';
      else if (filePath.includes('/shared/schema/')) moduleName = 'schema';
      else if (filePath.includes('/shared/')) moduleName = 'shared';
      
      if (!modules[moduleName]) {
        modules[moduleName] = { lines: 0, statements: 0, functions: 0, branches: 0, files: 0 };
      }
      
      modules[moduleName].lines += data.lines?.pct || 0;
      modules[moduleName].statements += data.statements?.pct || 0;
      modules[moduleName].functions += data.functions?.pct || 0;
      modules[moduleName].branches += data.branches?.pct || 0;
      modules[moduleName].files += 1;
    });
    
    const moduleAverages = Object.entries(modules).map(([name, data]) => ({
      name,
      lines: Math.round((data.lines / data.files) * 10) / 10,
      statements: Math.round((data.statements / data.files) * 10) / 10,
      functions: Math.round((data.functions / data.files) * 10) / 10,
      branches: Math.round((data.branches / data.files) * 10) / 10,
      files: data.files
    })).sort((a, b) => b.lines - a.lines);
    
    res.json({
      totals: {
        lines: { covered: totals.lines.covered, total: totals.lines.total, pct: totals.lines.pct },
        statements: { covered: totals.statements.covered, total: totals.statements.total, pct: totals.statements.pct },
        functions: { covered: totals.functions.covered, total: totals.functions.total, pct: totals.functions.pct },
        branches: { covered: totals.branches.covered, total: totals.branches.total, pct: totals.branches.pct }
      },
      modules: moduleAverages,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error reading coverage data:", error);
    res.status(500).json({ error: "Failed to read coverage data" });
  }
});

integrationsMonitoringRouter.get("/admin/api-logs", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const logs = await storage.listApiLogs(limit, offset);
    const stats = await storage.getApiLogStats();
    res.json({ logs, stats });
  } catch (error) {
    console.error("Error fetching API logs:", error);
    res.status(500).json({ error: "Failed to fetch API logs" });
  }
});

integrationsMonitoringRouter.get("/admin/api-metrics", async (req, res) => {
  try {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const metrics = await storage.listApiMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    console.error("Error fetching API metrics:", error);
    res.status(500).json({ error: "Failed to fetch API metrics" });
  }
});
