import express from "express";
import cors from "cors";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import process from "process";
import { Buffer } from "buffer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DJANGO_BRIDGE = path.join(__dirname, "django_db", "db_bridge.py");
const PYTHON_COMMAND = process.env.PYTHON || "python";
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY || "xnd_development_vIofQWl2i6B0e8U8U2G7K9Qp"; // Replace with your actual Xendit key
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5174";
const adminSessions = new Map();
const orderClients = new Set();

async function createXenditInvoice(items, orderId, studentId) {
  if (!XENDIT_SECRET_KEY) {
    throw new Error("Missing XENDIT_SECRET_KEY environment variable");
  }

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) * (item.quantity || 1)), 0);

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(XENDIT_SECRET_KEY + ":").toString("base64")}`,
    },
    body: JSON.stringify({
      external_id: `order-${orderId}`,
      amount: totalAmount,
      description: `Payment for Order #${orderId} - student ${studentId}`,
      customer: {
        given_names: studentId,
      },
      success_redirect_url: FRONTEND_URL,
      failure_redirect_url: FRONTEND_URL,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.category
      })),
      payment_methods: ["GCASH", "PAYMAYA"]
    }),
  };

  const response = await fetch("https://api.xendit.co/v2/invoices", options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Xendit invoice creation failed");
  }

  return data.invoice_url;
}

function runDbBridge(args, payload = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_COMMAND, [DJANGO_BRIDGE, ...args], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Django bridge exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout || "{}"));
      } catch (error) {
        reject(new Error(`Invalid Django bridge response: ${stdout || error.message}`));
      }
    });

    if (payload) {
      child.stdin.write(JSON.stringify(payload));
    }
    child.stdin.end();
  });
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getAdminFromRequest(req) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7);
  return adminSessions.get(token) || null;
}

function sanitizeProfile(profile) {
  if (!profile) {
    return profile;
  }

  const safeProfile = { ...profile };
  delete safeProfile.password;
  return safeProfile;
}

function normalizeReferenceNumber(value) {
  return String(value || "").replace(/\D+/g, "");
}

function validateReferenceNumber(reference) {
  if (!reference) {
    return "Reference number is required for e-wallet payments";
  }
  if (!/^\d+$/.test(reference)) {
    return "Reference number must contain numbers only";
  }
  if (reference.length < 8 || reference.length > 20) {
    return "Reference number must be 8 to 20 digits";
  }
  return "";
}

function sendSse(client, event, data) {
  try {
    client.res.write(`event: ${event}\n`);
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch {
    orderClients.delete(client);
  }
}

function broadcastOrderEvent(event, order) {
  if (!order) {
    return;
  }

  for (const client of orderClients) {
    const canReceive = client.isAdmin || String(client.studentId) === String(order.studentId);
    if (canReceive) {
      sendSse(client, event, { order });
    }
  }
}

function setupOrderStream(req, res, clientDetails) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("retry: 3000\n\n");

  const client = { ...clientDetails, res };
  orderClients.add(client);
  sendSse(client, "connected", { success: true });

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    orderClients.delete(client);
  });
}

async function getSessionStudentId(req) {
  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }
  const token = authorization.slice(7);
  const result = await runDbBridge(["session", "get", "--token", token]);
  return result.session?.studentId || null;
}

app.get("/api/menu", async (req, res) => {
  try {
    const result = await runDbBridge(["menu", "list", "--available-only"]);
    res.json(result.menu || []);
  } catch (error) {
    console.error("Failed to load menu", error);
    res.status(500).json({ success: false, error: "Failed to load menu" });
  }
});

app.get("/api/menu/:key", async (req, res) => {
  try {
    const result = await runDbBridge(["menu", "get", "--key", req.params.key]);
    if (!result.success) {
      return res.status(404).json(result);
    }
    if (!result.item?.isAvailable) {
      return res.status(404).json({ success: false, error: "Menu item not found" });
    }
    res.json(result.item);
  } catch (error) {
    console.error("Failed to load menu item", error);
    res.status(500).json({ success: false, error: "Failed to load menu item" });
  }
});

app.post("/api/cart", (req, res) => {
  const items = req.body.items || [];
  const total = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  res.json({ success: true, total, items });
});

app.post("/api/order", async (req, res) => {
  const studentId = await getSessionStudentId(req);
  if (!studentId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const items = req.body.items || [];
  const paymentMethod = req.body.paymentMethod || "";
  let paymentInfo = req.body.paymentInfo || "";

  if (!items.length) {
    return res.status(400).json({ success: false, error: "No items in order" });
  }

  if (!["gcash", "maya", "cash"].includes(paymentMethod)) {
    return res.status(400).json({ success: false, error: "Invalid payment method" });
  }

  if (paymentMethod === "gcash" || paymentMethod === "maya") {
    paymentInfo = normalizeReferenceNumber(paymentInfo);
    const referenceError = validateReferenceNumber(paymentInfo);
    if (referenceError) {
      return res.status(400).json({ success: false, error: referenceError });
    }
  } else {
    paymentInfo = "";
  }

  try {
    const result = await runDbBridge(["order", "create"], { items, paymentMethod, paymentInfo, studentId });
    if (!result.success) {
      return res.status(400).json(result);
    }
    broadcastOrderEvent("order-created", result);

    // If e-wallet, create Xendit invoice session
    if (paymentMethod === "gcash" || paymentMethod === "maya") {
      try {
        const checkoutUrl = await createXenditInvoice(items, result.orderId, studentId);
        return res.json({ ...result, checkoutUrl });
      } catch (pmError) {
        console.error("Xendit Error:", pmError);
        return res.json({ ...result, error: "Order placed but payment link failed. Please contact staff." });
      }
    }

    res.json(result);
  } catch (error) {
    console.error("Failed to save order", error);
    res.status(500).json({ success: false, error: "Failed to save order" });
  }
});

app.get("/api/orders", async (req, res) => {
  const studentId = await getSessionStudentId(req);
  if (!studentId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const result = await runDbBridge(["order", "list-user", "--student-id", studentId]);
    res.json(result);
  } catch (error) {
    console.error("Failed to fetch order history", error);
    res.status(500).json({ success: false, error: "Failed to load order history" });
  }
});

app.get("/api/orders/stream", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const result = await runDbBridge(["session", "get", "--token", token]);
    const studentId = result.session?.studentId;
    if (!studentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    setupOrderStream(req, res, { studentId, isAdmin: false });
  } catch (error) {
    console.error("Failed to open student order stream", error);
    res.status(500).json({ success: false, error: "Failed to open order stream" });
  }
});

app.get("/api/order/:id", async (req, res) => {
  try {
    const result = await runDbBridge(["order", "get", "--order-id", req.params.id]);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error("Failed to fetch order", error);
    res.status(500).json({ success: false, error: "Failed to fetch order" });
  }
});

function requireAdmin(req, res) {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return null;
  }

  return admin;
}

app.get("/api/admin/menu", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["menu", "list"]);
    res.json(result);
  } catch (error) {
    console.error("Failed to load admin menu", error);
    res.status(500).json({ success: false, error: "Failed to load menu" });
  }
});

app.post("/api/admin/menu", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["menu", "create"], req.body || {});
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (error) {
    console.error("Failed to create menu item", error);
    res.status(500).json({ success: false, error: "Failed to create menu item" });
  }
});

app.patch("/api/admin/menu/:key", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["menu", "update", "--key", req.params.key], req.body || {});
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error) {
    console.error("Failed to update menu item", error);
    res.status(500).json({ success: false, error: "Failed to update menu item" });
  }
});

app.delete("/api/admin/menu/:key", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["menu", "delete", "--key", req.params.key]);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: "Menu item not found" });
    }
    res.json(result);
  } catch (error) {
    console.error("Failed to delete menu item", error);
    res.status(500).json({ success: false, error: "Failed to delete menu item" });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["order", "list"]);
    res.json(result);
  } catch (error) {
    console.error("Failed to list admin orders", error);
    res.status(500).json({ success: false, error: "Failed to load orders" });
  }
});

app.get("/api/admin/orders/stream", (req, res) => {
  const token = String(req.query.token || "");
  const admin = adminSessions.get(token);
  if (!admin) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  setupOrderStream(req, res, { isAdmin: true });
});

app.patch("/api/admin/orders/:id", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["order", "update", "--order-id", req.params.id], req.body || {});
    if (!result.success) {
      return res.status(404).json(result);
    }
    broadcastOrderEvent("order-updated", result.order);
    res.json(result);
  } catch (error) {
    console.error("Failed to update admin order", error);
    res.status(500).json({ success: false, error: "Failed to update order" });
  }
});

app.get("/api/admin/reports", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }

  try {
    const result = await runDbBridge(["report", "summary"]);
    res.json(result);
  } catch (error) {
    console.error("Failed to load admin reports", error);
    res.status(500).json({ success: false, error: "Failed to load reports" });
  }
});

app.get("/__routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((m) => {
    if (m.route && m.route.path) {
      routes.push({ path: m.route.path, methods: Object.keys(m.route.methods) });
    }
  });
  res.json(routes);
});

app.get("/api/status", (req, res) => {
  res.json({ status: "ok", backend: "Express API" });
});

app.post("/api/login", async (req, res) => {
  const { studentId, password } = req.body || {};
  const normalizedStudentId = typeof studentId === "string" ? studentId.trim() : "";
  const normalizedPassword = typeof password === "string" ? password.trim() : "";

  if (!normalizedStudentId) {
    return res.status(400).json({ success: false, error: "Student ID is required" });
  }

  if (!normalizedPassword) {
    return res.status(400).json({ success: false, error: "Password is required" });
  }

  try {
    const result = await runDbBridge([
      "user",
      "verify",
      "--student-id",
      normalizedStudentId,
      "--password",
      normalizedPassword,
    ]);

    if (!result.success || !result.valid || result.isAdmin) {
      return res.status(401).json({ success: false, error: "Invalid student ID or password" });
    }

    const token = generateToken();
    await runDbBridge(["session", "create", "--token", token, "--student-id", result.profile.studentId]);

    res.json({ success: true, token, profile: sanitizeProfile(result.profile) });
  } catch (error) {
    console.error("Student login failed", error);
    res.status(500).json({ success: false, error: "Internal server error during login" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = typeof username === "string" ? username.trim() : "";
  const normalizedPassword = typeof password === "string" ? password.trim() : "";

  if (!normalizedUsername) {
    return res.status(400).json({ success: false, error: "Admin username is required" });
  }

  if (!normalizedPassword) {
    return res.status(400).json({ success: false, error: "Admin password is required" });
  }

  try {
    const result = await runDbBridge(["user", "verify", "--student-id", `admin_${normalizedUsername}`, "--password", normalizedPassword]);

    if (!result.success || !result.valid || !result.isAdmin) {
      return res.status(401).json({ success: false, error: "Invalid admin username or password" });
    }

    const token = generateToken();
    adminSessions.set(token, {
      username: normalizedUsername,
      name: result.profile.name || "Admin User"
    });

    res.json({ success: true, token, profile: adminSessions.get(token) });
  } catch (error) {
    console.error("Admin login failed", error);
    res.status(500).json({ success: false, error: "Internal server error during login" });
  }
});

app.get("/api/admin/me", (req, res) => {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  res.json({ success: true, profile: admin });
});

app.post("/api/admin/me", async (req, res) => {
  const admin = getAdminFromRequest(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const nextName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!nextName) {
    return res.status(400).json({ success: false, error: "Name is required" });
  }
  if (nextName.length > 255) {
    return res.status(400).json({ success: false, error: "Name is too long" });
  }

  try {
    const studentId = `admin_${admin.username}`;
    const existingResult = await runDbBridge(["user", "get", "--student-id", studentId]);
    const existingProfile = existingResult.profile || {
      studentId,
      password: "",
      phone: "",
      isAdmin: true,
    };
    const result = await runDbBridge(["user", "upsert"], {
      ...existingProfile,
      studentId,
      name: nextName,
      imageUrl: req.body?.imageUrl || existingProfile.imageUrl || "",
      phone: existingProfile.phone || "",
      password: existingProfile.password || "",
    });

    if (!result.success || !result.profile) {
      return res.status(500).json({ success: false, error: "Failed to save admin profile" });
    }

    admin.name = nextName;
    admin.imageUrl = result.profile.imageUrl;
    res.json({
      success: true,
      profile: {
        username: admin.username,
        name: nextName,
        imageUrl: admin.imageUrl,
      },
    });
  } catch (error) {
    console.error("Failed to save admin profile", error);
    res.status(500).json({ success: false, error: "Failed to save admin profile" });
  }
});

app.post("/api/admin/logout", (req, res) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) {
    adminSessions.delete(authorization.slice(7));
  }

  res.json({ success: true });
});

app.get("/api/user", async (req, res) => {
  const studentId = await getSessionStudentId(req);
  if (!studentId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const result = await runDbBridge(["user", "get", "--student-id", studentId]);
  const profile = result.profile || { studentId, name: "User", phone: "" };
  res.json(sanitizeProfile(profile));
});

app.post("/api/user", async (req, res) => {
  const studentId = await getSessionStudentId(req);
  if (!studentId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const profile = req.body || {};
  const nextName = typeof profile.name === "string" ? profile.name.trim() : "";
  if (!nextName) {
    return res.status(400).json({ success: false, error: "Name is required" });
  }
  if (nextName.length > 255) {
    return res.status(400).json({ success: false, error: "Name is too long" });
  }

  const existingResult = await runDbBridge(["user", "get", "--student-id", studentId]);
  const existingProfile = existingResult.profile || { studentId, password: "" };
  const nextProfile = {
    ...existingProfile,
    name: nextName,
    imageUrl: profile.imageUrl || existingProfile.imageUrl || "",
    phone: existingProfile.phone || "",
    studentId,
    password: existingProfile.password || "",
  };

  try {
    const result = await runDbBridge(["user", "upsert"], nextProfile);
    res.json({ success: true, profile: sanitizeProfile(result.profile) });
  } catch (e) {
    console.error("Failed to save user profile", e);
    res.status(500).json({ success: false, error: "Failed to save profile" });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, "0.0.0.0", async () => {
  console.log(`Backend API running on http://0.0.0.0:${port}`);
  try {
    console.log("Initializing database via bridge...");
    await runDbBridge(["init"]);
    console.log("Database bridge ready.");
  } catch (error) {
    console.error("Failed to initialize database bridge:", error);
  }
});
