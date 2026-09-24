const path = require('path');
// Load the frontend environment (root .env holds the Firebase config that the
// browser needs; it is served to the client via /api/config/firebase below).
// Real platform env vars (e.g. Vercel) already live in process.env, so dotenv
// must NOT override them - the default non-overriding behaviour is what we want.
require('dotenv').config({ path: path.join(__dirname, '../.env') });
// Then load the backend environment (server/.env with DATABASE_URL etc.).
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// === Security headers ===
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// === CORS (frontend is served from same origin; restrict for safety) ===
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// === Simple in-memory rate limiter (protects the registration endpoint from spam) ===
const rateLimit = require('./rate-limit');
const registerLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 10 });

// === Serve static frontend files from the parent directory with caching ===
// Block sensitive files (backend source, env, lockfiles, dotfiles) from being
// served as static assets.
const BLOCKED_STATIC = [/^\/server($|\/)/, /\.env(\..*)?$/, /^\/\./, /node_modules/];
app.use((req, res, next) => {
    if (BLOCKED_STATIC.some(pattern => pattern.test(req.path))) {
        return res.status(404).json({ error: 'Not found.' });
    }
    next();
});

app.use(express.static(path.join(__dirname, '../'), {
    extensions: ['html'],
    maxAge: process.env.NODE_ENV === 'production' ? '12h' : 0
}));

// === Health check (for deployment uptime monitors) ===
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// === Public config endpoint ===
// Browsers cannot read .env files, so the Firebase config stored in the root
// .env (or in Vercel environment variables) is exposed to the frontend here.
app.get('/api/config/firebase', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    });
});

app.post('/api/register', registerLimiter, async (req, res) => {
    try {
        const { firstName, lastName, phone, techSkill, email } = req.body;
        
        // Basic validation
        if (!firstName || !lastName || !phone || !techSkill || !email) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        if (!email.toLowerCase().endsWith('@gmail.com')) {
            return res.status(400).json({ error: 'Only Gmail addresses are allowed.' });
        }

        // Check if email already exists
        const existingUser = await prisma.registration.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (existingUser) {
            return res.status(400).json({ error: 'This Gmail address is already registered.' });
        }

        // Save to DB
        const newRegistration = await prisma.registration.create({
            data: {
                firstName,
                lastName,
                phone,
                techSkill,
                email: email.toLowerCase()
            }
        });

        // Look up the WhatsApp group for the chosen learning track
        const track = await prisma.learningTrack.findUnique({
            where: { name: techSkill }
        });

        res.status(201).json({ message: 'Registration successful!', data: newRegistration, whatsappLink: track ? track.whatsappLink : null });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ error: 'Internal server error during registration.' });
    }
});

app.get('/api/registrations', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];

        if (!userEmail) {
            return res.status(401).json({ error: 'Unauthorized: Missing email authentication header.' });
        }

        const emailLower = userEmail.toLowerCase();
        let isAuthorized = false;
        let isManager = null;

        if (adminEmails.includes(emailLower)) {
            isAuthorized = true;
        } else {
            isManager = await prisma.communityManager.findUnique({ where: { email: emailLower } });
            if (isManager) isAuthorized = true;
        }

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to access this page.' });
        }

        // Managers only see registrations from the track/community they manage
        const where = isManager ? { techSkill: isManager.trackName } : {};

        // Pagination (bounded queries as data grows)
        const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        const [registrations, total] = await Promise.all([
            prisma.registration.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            prisma.registration.count({ where })
        ]);

        res.status(200).json({ data: registrations, total, limit, offset });
    } catch (error) {
        console.error('Fetch Registrations Error:', error);
        res.status(500).json({ error: 'Internal server error while fetching registrations.' });
    }
});

// === ROLE & MANAGER APIS ===

// Helper to check if email is main admin
function isMainAdmin(email) {
    if(!email) return false;
    const adminEmails = process.env.ADMIN_EMAILS ? process.env.ADMIN_EMAILS.split(',') : [];
    return adminEmails.includes(email.toLowerCase());
}

// 1. Get User Role (For Login Redirects)
app.get('/api/auth/role', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) return res.status(401).json({ error: 'Missing email header' });
        
        if (isMainAdmin(userEmail)) {
            return res.json({ role: 'admin' });
        }

        const isManager = await prisma.communityManager.findUnique({ where: { email: userEmail.toLowerCase() } });
        if (isManager) {
            return res.json({ role: 'manager', track: isManager.trackName });
        }

        return res.json({ role: 'none' });
    } catch (error) {
        console.error('Role Check Error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 2. Add a Community Manager (Admin Only)
app.post('/api/managers', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden: Only the Admin can add managers.' });
        }

        const { email, trackName } = req.body;
        if (!email || !email.toLowerCase().endsWith('@gmail.com')) {
            return res.status(400).json({ error: 'A valid Gmail address is required.' });
        }

        const existing = await prisma.communityManager.findUnique({ where: { email: email.toLowerCase() } });
        if (existing) {
            return res.status(400).json({ error: 'This user is already a community manager.' });
        }

        const newManager = await prisma.communityManager.create({
            data: { email: email.toLowerCase(), trackName: trackName || '' }
        });

        res.status(201).json({ message: 'Manager added successfully', data: newManager });
    } catch (error) {
        console.error('Add Manager Error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 3. Get all Community Managers (Admin Only)
app.get('/api/managers', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const managers = await prisma.communityManager.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ data: managers });
    } catch (error) {
        console.error('Get Managers Error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 4. Update a Community Manager's assigned track (Admin Only)
app.put('/api/managers/:id', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const { trackName } = req.body;
        if (!trackName) {
            return res.status(400).json({ error: 'A learning track must be assigned to the manager.' });
        }

        const updatedManager = await prisma.communityManager.update({
            where: { id: req.params.id },
            data: { trackName }
        });
        res.status(200).json({ message: 'Manager track updated successfully', data: updatedManager });
    } catch (error) {
        console.error('Update Manager Track Error:', error);
        res.status(400).json({ error: 'Failed to update manager track. They might not exist.' });
    }
});

// 5. Remove a Community Manager (Admin Only)
app.delete('/api/managers/:email', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden.' });
        }

        const emailToDelete = req.params.email;
        await prisma.communityManager.delete({
            where: { email: emailToDelete.toLowerCase() }
        });
        res.status(200).json({ message: 'Manager removed successfully.' });
    } catch (error) {
        // Prisma throws an error if the record doesn't exist, we can ignore or format it
        console.error('Delete Manager Error:', error);
        res.status(400).json({ error: 'Failed to delete manager. They might not exist.' });
    }
});

// === LEARNING TRACK & WHATSAPP GROUP APIS ===

// 1. Get all Learning Tracks (Public)
app.get('/api/tracks', async (req, res) => {
    try {
        const tracks = await prisma.learningTrack.findMany({
            orderBy: { createdAt: 'asc' }
        });
        res.status(200).json({ data: tracks });
    } catch (error) {
        console.error('Get Tracks Error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 2. Add a Learning Track (Admin Only)
app.post('/api/tracks', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden: Only the Admin can add learning tracks.' });
        }

        const { name, whatsappLink } = req.body;
        if (!name || !whatsappLink) {
            return res.status(400).json({ error: 'Track name and WhatsApp group link are required.' });
        }

        const existing = await prisma.learningTrack.findUnique({ where: { name } });
        if (existing) {
            return res.status(400).json({ error: 'A learning track with this name already exists.' });
        }

        const newTrack = await prisma.learningTrack.create({
            data: { name, whatsappLink }
        });

        res.status(201).json({ message: 'Learning track added successfully', data: newTrack });
    } catch (error) {
        console.error('Add Track Error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// 3. Update a Learning Track (Admin Only)
app.put('/api/tracks/:id', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden: Only the Admin can edit learning tracks.' });
        }

        const { name, whatsappLink } = req.body;
        if (!name || !whatsappLink) {
            return res.status(400).json({ error: 'Track name and WhatsApp group link are required.' });
        }

        const updatedTrack = await prisma.learningTrack.update({
            where: { id: req.params.id },
            data: { name, whatsappLink }
        });

        res.status(200).json({ message: 'Learning track updated successfully', data: updatedTrack });
    } catch (error) {
        console.error('Update Track Error:', error);
        res.status(400).json({ error: 'Failed to update learning track. It might not exist.' });
    }
});

// 4. Delete a Learning Track (Admin Only)
app.delete('/api/tracks/:id', async (req, res) => {
    try {
        const userEmail = req.headers['x-user-email'];
        if (!isMainAdmin(userEmail)) {
            return res.status(403).json({ error: 'Forbidden: Only the Admin can delete learning tracks.' });
        }

        await prisma.learningTrack.delete({
            where: { id: req.params.id }
        });
        res.status(200).json({ message: 'Learning track removed successfully.' });
    } catch (error) {
        console.error('Delete Track Error:', error);
        res.status(400).json({ error: 'Failed to delete learning track. It might not exist.' });
    }
});

// === 404 for unknown API routes ===
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
});

// === Central error handler ===
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

// === Start / export ===
// On Vercel (serverless) the Express app is exported as the request handler.
// On local / classic Node hosting we bind directly to a port with graceful shutdown.
if (process.env.VERCEL) {
    module.exports = app;
} else {
    const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });

    async function shutdown(signal) {
        console.log(`${signal} received. Shutting down gracefully...`);
        await prisma.$disconnect();
        server.close(() => process.exit(0));
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}
