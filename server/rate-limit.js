// Simple in-memory sliding-window rate limiter.
// Suitable for a single-instance deployment. For multi-instance
// production, replace with a Redis-backed limiter (e.g. express-rate-limit
// + redis), or a rate limiter at the platform/load-balancer level.
function rateLimit({ windowMs = 60000, max = 10 } = {}) {
    const hits = new Map();

    // Periodically purge expired entries to avoid unbounded memory growth
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits.entries()) {
            if (now - entry.start > windowMs) {
                hits.delete(key);
            }
        }
    }, windowMs).unref();

    return function limiter(req, res, next) {
        const key = (req.headers['x-forwarded-for'] || req.ip || 'unknown') + '|' + (req.url || '');
        const now = Date.now();

        let entry = hits.get(key);
        if (!entry || now - entry.start > windowMs) {
            entry = { start: now, count: 0 };
            hits.set(key, entry);
        }

        entry.count += 1;

        if (entry.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - entry.start)) / 1000)));
            return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }

        next();
    };
}

module.exports = rateLimit;