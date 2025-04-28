import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { closeConnection } from "./db";
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import './config.js';

// Get the directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
// In production, environment variables are set in the hosting platform
// In development, load from .env file
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: resolve(__dirname, '.env') });
  console.log('Loaded environment variables from .env file');
} else {
  console.log('Using environment variables from production environment');
}

// Log environment variables (without exposing secrets)
console.log('Environment variables loaded:', {
  GOOGLE_CLIENT_ID_EXISTS: !!process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET_EXISTS: !!process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  HUGGING_FACE_API_KEY_EXISTS: !!process.env.HUGGING_FACE_API_KEY,
  HUGGING_FACE_API_KEY_LENGTH: process.env.HUGGING_FACE_API_KEY ? process.env.HUGGING_FACE_API_KEY.length : 0,
  HUGGING_FACE_API_KEY_PREFIX: process.env.HUGGING_FACE_API_KEY ? process.env.HUGGING_FACE_API_KEY.substring(0, 7) + '...' : 'not set'
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CORS headers for cross-domain requests
app.use((req, res, next) => {
  // Allow requests from the frontend domain
  const allowedOrigins = [process.env.FRONTEND_URL || 'http://localhost:3000'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  // Allow specific headers and methods
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // In Vercel, we don't need to explicitly listen on a port
  // Vercel will handle that for us
  // But we still need to listen on a port for local development
  if (process.env.VERCEL !== '1') {
    const port = process.env.PORT || 5000;
    server.listen(port, () => {
      log(`serving on port ${port}`);
    });
  } else {
    log('Running on Vercel - no need to listen on a port');
  }

  // Handle cleanup on server shutdown
  const cleanup = async () => {
    log("Shutting down server...");
    await closeConnection();
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
})();
