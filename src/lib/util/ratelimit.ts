interface RateLimitRecord {
  timestamps: number[];
}

const ipHits = new Map<string, RateLimitRecord>();
let dailyCounter = { date: new Date().toISOString().slice(0, 10), count: 0 };

export function checkRateLimit(
  key: string,
  limitPerHour = 30,
  dailyCap = 300
): { allowed: boolean; remaining: number; resetMs: number; error?: string } {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const today = new Date().toISOString().slice(0, 10);

  // Daily global cap check
  if (dailyCounter.date !== today) {
    dailyCounter = { date: today, count: 0 };
  }
  if (dailyCounter.count >= dailyCap) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: windowMs,
      error: "Global daily limit reached for hosted demo mode. Please run locally with Ollama.",
    };
  }

  // IP sliding window check
  const record = ipHits.get(key) || { timestamps: [] };
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limitPerHour) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      error: `Rate limit exceeded (${limitPerHour} req/hour). Try again in ${Math.ceil(resetMs / 60000)} minutes or use local mode.`,
    };
  }

  record.timestamps.push(now);
  ipHits.set(key, record);
  dailyCounter.count++;

  const remaining = limitPerHour - record.timestamps.length;
  return {
    allowed: true,
    remaining,
    resetMs: windowMs,
  };
}
