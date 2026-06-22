import os
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

# Load the backend's .env file to share the same database configuration
# ai-service is parallel to backend, so backend .env is at ../backend/.env
backend_env_path = Path(__file__).resolve().parent.parent.parent / 'backend' / '.env'
if backend_env_path.exists():
    load_dotenv(dotenv_path=backend_env_path)
    print(f"[DB] Loaded database environment configuration from: {backend_env_path}")
else:
    print("[DB] Warning: Backend .env file not found, looking in current environment variables.")

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    """
    Establish and return a connection to the PostgreSQL database
    """
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set. Please set it in backend/.env")
    
    # psycopg2 can parse postgresql:// urls directly!
    # If the URL contains parameters like ?schema=public, psycopg2 can handle the base URL.
    url = DATABASE_URL
    if "?" in url:
        # Strip query params like schema=public as psycopg2 parses standard connection URIs
        url = url.split("?")[0]
        
    try:
        conn = psycopg2.connect(url)
        return conn
    except Exception as e:
        print(f"[DB] Error connecting to PostgreSQL database: {e}")
        raise e
