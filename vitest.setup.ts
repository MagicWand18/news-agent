// Set test environment
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.TELEGRAM_BOT_TOKEN = "test-token";
process.env.ANTHROPIC_API_KEY = "test-key";
process.env.NEXTAUTH_SECRET = "test-secret";
