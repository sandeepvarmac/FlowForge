import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { SCHEMA } from './schema'

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'flowforge.db')

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Create or open database
let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    console.log('🗄️  Initializing SQLite database at:', DB_PATH)
    db = new Database(DB_PATH)

    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL')

    // Initialize schema
    db.exec(SCHEMA)

    console.log('✅ Database initialized successfully')
  }

  return db
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
    console.log('🔒 Database connection closed')
  }
}

// Auto-initialize database
getDatabase()
