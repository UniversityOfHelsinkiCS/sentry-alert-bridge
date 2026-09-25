// config.ts validates the environment at import time, so the unit tests need a
// complete (but fake) environment in place before any module is loaded.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/sentry_alert_bridge_test'
process.env.ACCESS_TOKEN = 'a'.repeat(64)
process.env.JWT_SECRET = 'b'.repeat(64)
process.env.SENTRY_AUTH_TOKEN = 'sentry-token'
process.env.SENTRY_ORG_SLUG = 'sentry'
process.env.SENTRY_BASE_URL = 'https://toska.it.helsinki.fi'
process.env.POLL_INTERVAL_MINUTES = '5'
process.env.SLACK_APP_TOKEN = 'xapp-test-token'
process.env.LOG_LEVEL = 'silent'
