import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///data.db")
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
AUDIO_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audio")
_cors_env = os.getenv("CORS_ORIGINS", "")
if _cors_env:
    CORS_ORIGINS = _cors_env.split(",")
else:
    CORS_ORIGINS = ["*"]
