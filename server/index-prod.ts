import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";
import { type Server } from "node:http";
import runApp from "./app";

export async function setupProductionServer(app: Express, server: Server) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");
  
  // Serve static files from dist/public
  app.use((req, res, next) => {
    const filePath = path.join(distPath, req.path);
    
    // If file exists, serve it
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    
    // Otherwise, serve index.html for SPA routing (excluding API routes)
    if (!req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    
    next();
  });
}

(async () => {
  await runApp(setupProductionServer);
})();
