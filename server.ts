import '@/backend/loadEnv';
import monitoringRoutes from '@/backend/routes/monitoring';
import { createServer as createViteServer } from 'vite';
import bossRoutes from '@/backend/routes/bosses';
import adminBossRoutes from '@/backend/routes/adminBosses';
import adminSystemRoutes from '@/backend/routes/adminSystem';
import userRoutes from '@/backend/routes/users';
import authRoutes from '@/backend/routes/auth';
import authTelegramRoutes from '@/backend/routes/authTelegram';
import { pathConfig, trustProxy } from '@/backend/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { ALL_PERMISSIONS } from '@/shared/permissions';
import { prisma } from '@/backend/services/prisma';
import { isUserSessionActive } from '@/backend/services/sessionAudit';
import { scheduleLogCleanup } from '@/backend/services/logRetention';
import { scheduleMonitoringCleanup } from '@/backend/services/monitoringCleanup';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const jwtSecret: string = JWT_SECRET;
const { SUPERADMIN_LOGIN } = process.env;

type SocketTokenPayload = jwt.JwtPayload & {
  userId: string;
  login: string;
  sessionId?: string;
};

function isSocketTokenPayload(payload: string | jwt.JwtPayload): payload is SocketTokenPayload {
  return typeof payload !== 'string' && typeof payload.userId === 'string' && typeof payload.login === 'string';
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const httpServer = createServer(app);

  const { basePath, apiBase, socketPath } = pathConfig;
  app.set('trust proxy', trustProxy);

  const io = new Server(httpServer, {
    path: socketPath,
    cors: { origin: '*' },
  });

  app.use(express.json());
  app.use(cookieParser());
  app.set('io', io);
  scheduleLogCleanup();
  scheduleMonitoringCleanup(bossId => {
    io.emit('monitoring_update', { bossId });
  });

  // API routes FIRST
  app.get(`${apiBase}/health`, (_req, res) => {
    res.json({ status: 'ok', message: 'RB Monitor API is running' });
  });

  app.use(`${apiBase}/auth`, authRoutes);
  app.use(`${apiBase}/auth/telegram`, authTelegramRoutes);
  app.use(`${apiBase}/bosses`, bossRoutes);
  app.use(`${apiBase}/admin/bosses`, adminBossRoutes);
  app.use(`${apiBase}/admin`, adminSystemRoutes);
  app.use(`${apiBase}/users`, userRoutes);
  app.use(`${apiBase}/monitoring`, monitoringRoutes);

  // Socket.io logic
  const onlineUsers = new Set<string>();

  // Authenticate socket connections
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Unauthorized: No token provided'));
    }

    try {
      if (typeof token !== 'string') {
        return next(new Error('Unauthorized: Invalid token'));
      }

      const decoded = jwt.verify(token, jwtSecret);
      if (!isSocketTokenPayload(decoded)) {
        return next(new Error('Unauthorized: Invalid token'));
      }

      if (!(await isUserSessionActive(decoded.sessionId, decoded.userId))) {
        return next(new Error('Unauthorized: Invalid token'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: { role: true },
      });

      if (!user) {
        return next(new Error('Unauthorized: User not found'));
      }

      let permissions = JSON.parse(user.role.permissions) as string[];
      let roleName = user.role.name;

      if (user.login === SUPERADMIN_LOGIN) {
        permissions = ALL_PERMISSIONS;
        roleName = 'Superadmin';
      }

      socket.data.userId = user.id;
      socket.data.login = user.login;
      socket.data.name = user.name;
      socket.data.role = roleName;
      socket.data.permissions = permissions;
      socket.data.sessionId = decoded.sessionId;

      next();
    } catch {
      return next(new Error('Unauthorized: Invalid token'));
    }
  });

  io.on('connection', socket => {
    const login: string = socket.data.login;
    const name: string | null = socket.data.name;
    console.log('Client connected:', socket.id, 'as', login);

    // Auto-join on authenticated connect
    if (login) {
      onlineUsers.add(login);
      if (socket.data.sessionId) {
        void socket.join(`session:${socket.data.sessionId}`);
      }
      if (socket.data.userId) {
        void socket.join(`user:${socket.data.userId}`);
      }
      io.emit('user_presence', { login, name, status: 'online' });
    }

    socket.on('disconnect', () => {
      const login: string = socket.data.login;
      const name: string | null = socket.data.name;
      console.log('Client disconnected:', socket.id, login);

      if (login) {
        onlineUsers.delete(login);
        io.emit('user_presence', { login, name, status: 'offline' });
      }
    });
  });

  // Serve user-uploaded boss images (persists across builds)
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  app.use(basePath || '/', express.static(uploadsDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    const indexHtml = path.join(distPath, 'index.html');

    app.use(basePath || '/', express.static(distPath));

    // SPA fallback — serve index.html for all routes under basePath
    if (basePath) {
      app.get(basePath, (_req, res) => res.sendFile(indexHtml));
      app.get(`${basePath}/*`, (_req, res) => res.sendFile(indexHtml));
    } else {
      app.get('*', (_req, res) => res.sendFile(indexHtml));
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    const displayBase = basePath || '/';
    console.log(`Server running on http://localhost:${PORT}${displayBase}`);
  });
}

startServer().catch(error => {
  console.error('Unhandled error in server:', error);
  process.exit(1);
});
