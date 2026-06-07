/* Jest setup — runs before any module import (jest `setupFiles`).
   Provides dummy env so config/env.ts validation passes without a real .env,
   so unit tests don't trigger process.exit(1). */
process.env.NODE_ENV = 'development';
process.env.MONGODB_URI = 'mongodb://localhost:27017/takshashila-test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_characters_long';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long';
process.env.COOKIE_SECRET = 'test_cookie_secret_at_least_32_characters_long';
process.env.AGORA_APP_ID = 'test_agora_app_id';
process.env.AGORA_APP_CERTIFICATE = 'test_agora_certificate';
