# Backend Best Practices

Best practices for building secure, maintainable Node.js/Express API servers. This guide covers CORS, caching, security headers, error handling, logging, and API design patterns.

---

## Table of Contents
1. [CORS Configuration](#cors-configuration)
2. [Caching Strategies](#caching-strategies)
3. [Security Headers](#security-headers)
4. [Error Handling](#error-handling)
5. [Logging & Monitoring](#logging--monitoring)
6. [API Design](#api-design)
7. [Environment Configuration](#environment-configuration)
8. [Testing](#testing)

---

## CORS Configuration

### Overview
Cross-Origin Resource Sharing (CORS) controls which origins can access your API. Misconfigured CORS can expose security vulnerabilities or break legitimate clients.

**Reference:** [CORS Best Practices (Medium)](https://medium.com/@xinquanyip/cors-best-practices-securing-cross-origin-requests-the-right-way-0e58b4b19b33)

### Best Practices

#### 1. Use Specific Origins (Production)
**❌ Avoid in production:**
```ts
app.use(cors({ origin: "*" }));
```

**✅ Prefer allowlist:**
```ts
const allowedOrigins = [
  "https://yourdomain.com",
  "https://app.yourdomain.com",
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : [])
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // Only if you need cookies/auth headers
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
```

#### 2. Handle Preflight Requests
Modern browsers send `OPTIONS` preflight requests before complex requests (POST/PUT with JSON, custom headers, etc.).

```ts
// Global preflight handling (cors middleware does this automatically)
app.options("*", cors());

// Per-route if needed:
app.options("/api/protected", cors(), (req, res) => {
  res.status(204).end();
});
```

#### 3. Public Read-Only Endpoints
For truly public read-only data (like `/portfolio.json`), `Access-Control-Allow-Origin: *` is acceptable:

```ts
app.get("/public/data.json", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.json({ /* public data */ });
});
```

**Never use `credentials: true` with `origin: "*"`** — browsers will reject it.

#### 4. Credentials & Cookies
If your API uses cookies or `Authorization` headers:

```ts
app.use(cors({
  origin: "https://yourdomain.com",
  credentials: true
}));
```

Client must send:
```ts
fetch("https://api.yourdomain.com/data", {
  credentials: "include"
});
```

#### 5. Avoid Duplicate CORS Headers
If you set CORS headers in both your app (Express) and reverse proxy (NGINX), you'll get duplicate headers that browsers reject.

**Choose one:**
- Handle CORS in Express (recommended for flexibility)
- **OR** handle it in NGINX (simpler for static configs)

---

## Caching Strategies

### HTTP Caching Headers

#### Public Static Data
```ts
app.get("/public/data.json", (req, res) => {
  res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
  res.json({ /* data */ });
});
```
- `public` → cacheable by browsers + CDNs
- `max-age=300` → fresh for 5 minutes
- `stale-while-revalidate=86400` → serve stale for 24h while revalidating in background

#### Private User Data
```ts
app.get("/user/profile", authenticate, (req, res) => {
  res.set("Cache-Control", "private, max-age=60");
  res.json({ /* user-specific data */ });
});
```
- `private` → only browser caches it (not CDNs)

#### No Caching (Health Checks, Real-Time Data)
```ts
app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ status: "ok" });
});
```

### Conditional Requests (ETags)
Support `If-None-Match` for bandwidth savings:

```ts
app.get("/data.json", (req, res) => {
  const data = { /* ... */ };
  const dataStr = JSON.stringify(data);
  const hash = require("crypto").createHash("sha1").update(dataStr).digest("hex");
  const etag = `W/"${hash.slice(0, 12)}"`;

  if (req.headers["if-none-match"] === etag) {
    return res.status(304).end(); // Not Modified
  }

  res.set("ETag", etag);
  res.set("Cache-Control", "public, max-age=300");
  res.json(data);
});
```

---

## Security Headers

Use [helmet](https://helmetjs.github.io/) for common security headers:

```bash
npm install helmet
```

```ts
import helmet from "helmet";

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Manual Headers (if not using helmet)
```ts
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("X-XSS-Protection", "1; mode=block");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
```

---

## Error Handling

### Centralized Error Handler
```ts
// Custom error class
class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// Global error handler (after all routes)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
  }

  // Unexpected errors
  console.error("Unexpected error:", err);
  res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack })
  });
});

// Unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // In production, consider graceful shutdown
});
```

### Usage in Routes
```ts
app.get("/users/:id", async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    res.json(user);
  } catch (error) {
    next(error); // Pass to global error handler
  }
});
```

### Async Route Wrapper
```ts
const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get("/users/:id", asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) throw new ApiError(404, "User not found");
  res.json(user);
}));
```

---

## Logging & Monitoring

### Structured Logging
Use [pino](https://getpino.io/) or [winston](https://github.com/winstonjs/winston):

```bash
npm install pino pino-http
```

```ts
import pino from "pino";
import pinoHttp from "pino-http";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development"
    ? { target: "pino-pretty" }
    : undefined
});

app.use(pinoHttp({ logger }));

// Usage in routes
app.get("/data", (req, res) => {
  req.log.info("Fetching data");
  res.json({ data: "..." });
});
```

### Request Logging Best Practices
- Log request method, path, status, duration
- Log user ID (if authenticated)
- Redact sensitive data (passwords, tokens)
- Use correlation IDs for distributed tracing

---

## API Design

### RESTful Conventions
```
GET    /api/users          → List users
GET    /api/users/:id      → Get user
POST   /api/users          → Create user
PUT    /api/users/:id      → Update user (full)
PATCH  /api/users/:id      → Update user (partial)
DELETE /api/users/:id      → Delete user
```

### Versioning
```ts
app.use("/api/v1", v1Router);
app.use("/api/v2", v2Router);
```

### Pagination
```ts
app.get("/api/users", (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;

  const users = getUsersPaginated(offset, limit);
  const total = getTotalUsers();

  res.json({
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});
```

### Response Structure
**Success:**
```json
{
  "data": { /* resource */ },
  "meta": { /* pagination, timestamps, etc. */ }
}
```

**Error:**
```json
{
  "error": "User not found",
  "code": "USER_NOT_FOUND",
  "statusCode": 404
}
```

### Input Validation
Use [zod](https://zod.dev/) or [joi](https://joi.dev/):

```ts
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.number().int().min(13).optional()
});

app.post("/api/users", asyncHandler(async (req, res) => {
  const parsed = createUserSchema.parse(req.body); // throws if invalid
  const user = await createUser(parsed);
  res.status(201).json({ data: user });
}));
```

---

## Environment Configuration

### .env Structure
```bash
# Server
NODE_ENV=development
PORT=4000
HOST=localhost

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Logging
LOG_LEVEL=info
```

### Type-Safe Config
```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),
  PORT: z.string().transform(Number),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().transform(s => s.split(","))
});

export const config = envSchema.parse(process.env);
```

---

## Testing

### Unit Tests (Routes)
Use [vitest](https://vitest.dev/) or [jest](https://jestjs.io/) + [supertest](https://github.com/ladjs/supertest):

```ts
import request from "supertest";
import { app } from "./app";

describe("GET /api/users", () => {
  it("returns 200 and user list", async () => {
    const res = await request(app)
      .get("/api/users")
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });

  it("returns 404 for non-existent user", async () => {
    await request(app)
      .get("/api/users/999")
      .expect(404);
  });
});
```

### Integration Tests
Test full request/response cycle including database:

```ts
beforeAll(async () => {
  await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

it("creates and retrieves a user", async () => {
  const createRes = await request(app)
    .post("/api/users")
    .send({ name: "Alice", email: "alice@example.com" })
    .expect(201);

  const userId = createRes.body.data.id;

  const getRes = await request(app)
    .get(`/api/users/${userId}`)
    .expect(200);

  expect(getRes.body.data.name).toBe("Alice");
});
```

---

## Quick Wins Checklist

- [ ] Use `helmet()` for security headers
- [ ] Configure CORS properly (allowlist in production)
- [ ] Add centralized error handling
- [ ] Use structured logging (pino/winston)
- [ ] Validate input with zod/joi
- [ ] Set appropriate `Cache-Control` headers
- [ ] Support conditional requests (ETags) for cacheable endpoints
- [ ] Use async/await + try/catch (or asyncHandler wrapper)
- [ ] Return consistent JSON response shapes
- [ ] Add health check endpoint (`GET /health`)
- [ ] Use environment variables (never hardcode secrets)
- [ ] Write integration tests for critical paths
- [ ] Document API with OpenAPI/Swagger (optional but helpful)

---

## References
- [CORS Best Practices](https://medium.com/@xinquanyip/cors-best-practices-securing-cross-origin-requests-the-right-way-0e58b4b19b33)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [helmet.js](https://helmetjs.github.io/)
- [HTTP Caching (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching)
- [RESTful API Design](https://restfulapi.net/)
- [Zod Validation](https://zod.dev/)
- [Pino Logger](https://getpino.io/)
