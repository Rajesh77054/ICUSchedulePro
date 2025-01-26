import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type User as SelectUser } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

// extend express user object with our schema
declare global {
  namespace Express {
    interface User extends SelectUser { }
  }
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "porygon-supremacy",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    name: 'sessionId',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/'
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!user) {
        return done(new Error('User not found'), null);
      }
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  app.set("trust proxy", 1);

  const sess = session(sessionSettings);
  app.use(sess);
  app.use(passport.initialize());
  app.use(passport.session());

  // Unified auth middleware
  app.use(async (req, res, next) => {
    try {
      // Ensure session exists
      if (!req.session) {
        console.error('No session found');
        return res.status(401).json({ error: 'No session found' });
      }

      // Initialize passport session if needed
      if (!req.session.passport) {
        req.session.passport = { user: undefined };
      }

      // Check if user is authenticated via passport
      try {
        if (req.isAuthenticated() && req.session.passport?.user) {
          const [user] = await db.select().from(users).where(eq(users.id, req.session.passport.user)).limit(1);
          if (user) {
            req.user = user;
          } else {
            await new Promise<void>((resolve) => {
              req.logout((err) => {
                if (err) console.error('Logout error:', err);
                resolve();
              });
            });
            return res.status(401).json({ error: 'Invalid user session' });
          }
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        return res.status(500).json({ error: 'Authentication error' });
      }

      // Public routes that don't require authentication
      const publicPaths = ['/', '/api/login', '/api/register', '/api/user'];
      
      // Development assets and WebSocket connections
      const isDev = process.env.NODE_ENV === 'development';
      const isDevAsset = isDev && (
        req.path.startsWith('/@') || 
        req.path.includes('.vite') || 
        req.path.includes('node_modules') ||
        req.path.startsWith('/src') ||
        req.path.includes('assets') ||
        req.path.endsWith('.js') ||
        req.path.endsWith('.css') ||
        req.path.endsWith('.map')
      );
      const isWebSocket = req.headers.upgrade?.toLowerCase() === 'websocket' ||
                         req.path.includes('/ws');

      if (publicPaths.includes(req.path) || isDevAsset || isWebSocket) {
        return next();
      }

      // Add detailed logging for auth failures
      if (!req.isAuthenticated()) {
        console.log(`Auth failed for ${req.method} ${req.path} from ${req.ip}`);
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please login first at /api/login',
          path: req.path
        });
      }

      if (!publicPaths.includes(req.path) && !req.isAuthenticated()) {
        console.log(`Auth failed for ${req.method} ${req.path} - No session found`);
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please login first at /api/login',
          code: 'NO_SESSION'
        });
      }

      next();
    } catch (err) {
      console.error('Auth middleware error:', err);
      return res.status(500).json({ error: 'Authentication error' });
    }
  });

  // Enable session persistence
  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }
        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Incorrect password." });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
      }

      const { username, password } = result.data;

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      // Hash the password
      const hashedPassword = await crypto.hash(password);

      // Create the new user
      const [newUser] = await db
        .insert(users)
        .values({
          ...result.data,
          password: hashedPassword,
        })
        .returning();

      // Log the user in after registration
      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({
          message: "Registration successful",
          user: { id: newUser.id, username: newUser.username },
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    const result = insertUserSchema.safeParse(req.body);
    if (!result.success) {
      return res
        .status(400)
        .send("Invalid input: " + result.error.issues.map(i => i.message).join(", "));
    }

    const cb = (err: any, user: Express.User, info: IVerifyOptions) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res.status(400).send(info.message ?? "Login failed");
      }

      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }

        return res.json({
          message: "Login successful",
          user: { id: user.id, username: user.username },
        });
      });
    };
    passport.authenticate("local", cb)(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }

      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }

    // Return null for unauthenticated users instead of error
    res.json(null);
  });
}