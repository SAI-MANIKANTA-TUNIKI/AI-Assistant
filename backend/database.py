# backend/database.py
import os
import httpx
import sqlite3
import bcrypt  # <--- CHANGED: Using bcrypt directly
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any

load_dotenv()

# ─────────────────────────────────────────────────────
# CLOUDFLARE D1 (For Chat Conversations)
# ─────────────────────────────────────────────────────
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_D1_DATABASE_ID = os.getenv("CLOUDFLARE_D1_DATABASE_ID")
CLOUDFLARE_D1_API_TOKEN = os.getenv("CLOUDFLARE_D1_API_TOKEN")

D1_API_URL = (
    f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}"
    f"/d1/database/{CLOUDFLARE_D1_DATABASE_ID}/query"
)

HEADERS = {
    "Authorization": f"Bearer {CLOUDFLARE_D1_API_TOKEN}",
    "Content-Type": "application/json",
}

async def execute_sql(sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    if not all([CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_D1_API_TOKEN]):
        print("⚠️ D1 credentials missing — SQL execution skipped.")
        return []

    payload: Dict[str, Any] = {"sql": sql}
    if params:
        payload["params"] = params

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            r = await client.post(D1_API_URL, headers=HEADERS, json=payload)
            r.raise_for_status()
            data = r.json()
            if not data.get("success"):
                print(f"❌ D1 Query Error: {data.get('errors')}")
                return []
            return data.get("result", [{}])[0].get("results", [])
        except Exception as e:
            print(f"❌ D1 Connection Error [{type(e).__name__}]: {e}")
            return []

CREATE_CONVERSATIONS_TABLE = """
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

CREATE_MESSAGES_TABLE = """
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
);
"""

async def init_d1_db():
    await execute_sql(CREATE_CONVERSATIONS_TABLE)
    await execute_sql(CREATE_MESSAGES_TABLE)
    print("✅ D1 tables initialized.")

async def create_conversation(title: str) -> Dict[str, Any]:
    result = await execute_sql(
        "INSERT INTO conversations (title) VALUES (?) RETURNING id, title, created_at;",
        [title],
    )
    return result[0] if result else {}

async def get_conversation(conv_id: int) -> Optional[Dict[str, Any]]:
    result = await execute_sql(
        "SELECT id, title, created_at FROM conversations WHERE id = ?;",
        [conv_id],
    )
    return result[0] if result else None

async def get_all_conversations() -> List[Dict[str, Any]]:
    return await execute_sql("SELECT id, title, created_at FROM conversations ORDER BY created_at DESC;")

async def delete_conversation(conv_id: int) -> bool:
    await execute_sql("DELETE FROM messages WHERE conversation_id = ?;", [conv_id])
    await execute_sql("DELETE FROM conversations WHERE id = ?;", [conv_id])
    return True

async def rename_conversation(conv_id: int, new_title: str) -> Optional[Dict[str, Any]]:
    result = await execute_sql(
        "UPDATE conversations SET title = ? WHERE id = ? RETURNING id, title, created_at;",
        [new_title, conv_id],
    )
    return result[0] if result else None

async def add_message(conv_id: int, role: str, content: str):
    await execute_sql(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?);",
        [conv_id, role, content],
    )

async def get_messages(conv_id: int) -> List[Dict[str, Any]]:
    return await execute_sql(
        "SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC;",
        [conv_id],
    )

# ─────────────────────────────────────────────────────
# SQLITE (For Authentication & Users)
# ─────────────────────────────────────────────────────
DB_NAME = "chatbot.db"

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_sqlite_db():
    with get_db() as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL
            )
        ''')
                # NEW: Devices table for ESP32 pairing
        conn.execute('''
            CREATE TABLE IF NOT EXISTS devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                device_name TEXT NOT NULL,
                device_token TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_email) REFERENCES users (email) ON DELETE CASCADE
            )
        ''')
        conn.commit()
    print("✅ SQLite users table initialized.")

# ─────────────────────────────────────────────────────
# PASSWORD HASHING HELPERS
# ─────────────────────────────────────────────────────
def get_password_hash(password: str) -> str:
    """Hashes a password using bcrypt. Truncates to 72 bytes as required by bcrypt."""
    pwd_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a password against its hash."""
    pwd_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(pwd_bytes, hashed_bytes)

