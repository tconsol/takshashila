/* Jest setup runs before any module import (jest `setupFiles`).
   Provides dummy env so config/env.ts validation passes without a real .env,
   so unit tests don't trigger process.exit(1). */
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://localhost:27017/brainbaseedu-test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_characters_long';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long';
process.env.COOKIE_SECRET = 'test_cookie_secret_at_least_32_characters_long';
process.env.AGORA_APP_ID = 'test_agora_app_id';
process.env.AGORA_APP_CERTIFICATE = 'test_agora_certificate';
// Razorpay's constructor throws synchronously if key_id/key_secret are empty
// (unlike Stripe's, which tolerates an empty key until an actual API call is
// made) — any app.ts import (e.g. via supertest) blows up at module-load time
// without these, even though payment.service.ts's own isRealKey() check
// already treats placeholder-looking values as "not configured".
process.env.RAZORPAY_KEY_ID = 'test_razorpay_key_id';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_key_secret';
