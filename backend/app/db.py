import os
import sqlite3
from typing import Optional
from pathlib import Path

DEFAULT_DB_PATH = os.environ.get(
    "CLOUDOPS_DB_PATH",
    str(Path(__file__).resolve().parent.parent / "cloudops.db")
)

def get_db_path() -> str:
    return os.environ.get("CLOUDOPS_DB_PATH", DEFAULT_DB_PATH)

def get_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    target = db_path or get_db_path()
    conn = sqlite3.connect(target, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path: Optional[str] = None) -> None:
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    full_name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    normalized_email TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    is_verified INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    session_token_hash TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    last_activity TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS auth_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    token_type TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    is_used INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS network_configurations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    region TEXT NOT NULL DEFAULT 'us-east-1',
                    vpc_cidr TEXT NOT NULL,
                    subnets_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS experiments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    network_config_id INTEGER,
                    mode TEXT NOT NULL DEFAULT 'simulation',
                    fault_scenario TEXT,
                    initial_result_json TEXT,
                    remediation_json TEXT,
                    final_result_json TEXT,
                    recovery_status TEXT NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (network_config_id) REFERENCES network_configurations(id) ON DELETE SET NULL
                );
            """)

            # Indices for rapid lookup
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(session_token_hash);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_tokens_token_hash ON auth_tokens(token_hash);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_networks_user ON network_configurations(user_id);")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_experiments_user ON experiments(user_id);")
    finally:
        conn.close()

