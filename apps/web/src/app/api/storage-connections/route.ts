import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { StorageConnection, CreateStorageConnectionRequest } from '@/types/storage-connection'

/**
 * GET /api/storage-connections
 * List all storage connections
 */
export async function GET() {
  try {
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT * FROM storage_connections
      ORDER BY name ASC
    `).all() as any[]

    const connections: StorageConnection[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      config: JSON.parse(row.config),
      lastTestedAt: row.last_tested_at,
      lastTestStatus: row.last_test_status,
      lastTestMessage: row.last_test_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))

    return NextResponse.json({
      success: true,
      connections
    })
  } catch (error) {
    console.error('Error fetching storage connections:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch storage connections' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/storage-connections
 * Create a new storage connection
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateStorageConnectionRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.type || !body.config) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, type, config' },
        { status: 400 }
      )
    }

    // Validate connection type
    const validTypes = ['local', 's3', 'azure-blob', 'sftp', 'gcs']
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid connection type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate ID
    const id = `sc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const now = Date.now()

    const db = getDatabase()

    // Check for duplicate name
    const existing = db.prepare('SELECT id FROM storage_connections WHERE name = ?').get(body.name)
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A storage connection with this name already exists' },
        { status: 409 }
      )
    }

    // Insert new connection
    db.prepare(`
      INSERT INTO storage_connections (
        id, name, description, type, config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name,
      body.description || null,
      body.type,
      JSON.stringify(body.config),
      now,
      now
    )

    // Fetch the created connection
    const row = db.prepare('SELECT * FROM storage_connections WHERE id = ?').get(id) as any

    const connection: StorageConnection = {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      config: JSON.parse(row.config),
      lastTestedAt: row.last_tested_at,
      lastTestStatus: row.last_test_status,
      lastTestMessage: row.last_test_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }

    return NextResponse.json({
      success: true,
      connection
    })
  } catch (error) {
    console.error('Error creating storage connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create storage connection' },
      { status: 500 }
    )
  }
}
