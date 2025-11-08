import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { DatabaseConnection, UpdateConnectionInput } from '@/types/database-connection'

// GET /api/database-connections/[connectionId] - Get single connection
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const db = getDatabase()

    const connection = db.prepare(`
      SELECT
        id, name, description, type,
        host, port, database, username, password,
        ssl_enabled as sslEnabled,
        connection_timeout as connectionTimeout,
        last_tested_at as lastTestedAt,
        last_test_status as lastTestStatus,
        last_test_message as lastTestMessage,
        created_at as createdAt,
        updated_at as updatedAt
      FROM database_connections
      WHERE id = ?
    `).get(params.connectionId) as DatabaseConnection | undefined

    if (!connection) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, connection })
  } catch (error) {
    console.error('Failed to fetch connection:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch connection' },
      { status: 500 }
    )
  }
}

// PUT /api/database-connections/[connectionId] - Update connection
export async function PUT(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const body: UpdateConnectionInput = await request.json()
    const db = getDatabase()

    // Check if connection exists
    const existing = db.prepare('SELECT id FROM database_connections WHERE id = ?').get(params.connectionId)
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    const now = Date.now()
    const updates: string[] = []
    const values: any[] = []

    // Build dynamic update query
    if (body.name !== undefined) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.type !== undefined) {
      updates.push('type = ?')
      values.push(body.type)
    }
    if (body.host !== undefined) {
      updates.push('host = ?')
      values.push(body.host)
    }
    if (body.port !== undefined) {
      updates.push('port = ?')
      values.push(body.port)
    }
    if (body.database !== undefined) {
      updates.push('database = ?')
      values.push(body.database)
    }
    if (body.username !== undefined) {
      updates.push('username = ?')
      values.push(body.username)
    }
    if (body.password !== undefined) {
      updates.push('password = ?')
      values.push(body.password)
    }
    if (body.sslEnabled !== undefined) {
      updates.push('ssl_enabled = ?')
      values.push(body.sslEnabled ? 1 : 0)
    }
    if (body.connectionTimeout !== undefined) {
      updates.push('connection_timeout = ?')
      values.push(body.connectionTimeout)
    }

    updates.push('updated_at = ?')
    values.push(now)

    values.push(params.connectionId)

    const stmt = db.prepare(`
      UPDATE database_connections
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...values)

    // Fetch updated connection
    const connection = db.prepare(`
      SELECT
        id, name, description, type,
        host, port, database, username,
        ssl_enabled as sslEnabled,
        connection_timeout as connectionTimeout,
        last_tested_at as lastTestedAt,
        last_test_status as lastTestStatus,
        last_test_message as lastTestMessage,
        created_at as createdAt,
        updated_at as updatedAt
      FROM database_connections
      WHERE id = ?
    `).get(params.connectionId) as Omit<DatabaseConnection, 'password'>

    return NextResponse.json({ success: true, connection })
  } catch (error: any) {
    console.error('Failed to update connection:', error)

    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { success: false, message: 'A connection with this name already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to update connection' },
      { status: 500 }
    )
  }
}

// DELETE /api/database-connections/[connectionId] - Delete connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const db = getDatabase()

    // Check if connection exists
    const existing = db.prepare('SELECT id, name FROM database_connections WHERE id = ?').get(params.connectionId) as { id: string; name: string } | undefined
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    // TODO: Check if connection is used by any jobs before deleting
    // This would require adding a connection_id column to jobs table

    const stmt = db.prepare('DELETE FROM database_connections WHERE id = ?')
    stmt.run(params.connectionId)

    console.log(`✅ Deleted connection: ${existing.name}`)

    return NextResponse.json({ success: true, message: 'Connection deleted successfully' })
  } catch (error) {
    console.error('Failed to delete connection:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete connection' },
      { status: 500 }
    )
  }
}
