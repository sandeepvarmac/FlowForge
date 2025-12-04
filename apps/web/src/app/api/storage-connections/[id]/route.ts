import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { StorageConnection, UpdateStorageConnectionRequest } from '@/types/storage-connection'

/**
 * GET /api/storage-connections/[id]
 * Get a specific storage connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const db = getDatabase()

    const row = db.prepare('SELECT * FROM storage_connections WHERE id = ?').get(id) as any

    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Storage connection not found' },
        { status: 404 }
      )
    }

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
    console.error('Error fetching storage connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch storage connection' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/storage-connections/[id]
 * Update a storage connection
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body: UpdateStorageConnectionRequest = await request.json()
    const db = getDatabase()

    // Check if connection exists
    const existing = db.prepare('SELECT * FROM storage_connections WHERE id = ?').get(id) as any
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Storage connection not found' },
        { status: 404 }
      )
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (body.name !== undefined) {
      // Check for duplicate name
      const duplicate = db.prepare('SELECT id FROM storage_connections WHERE name = ? AND id != ?').get(body.name, id)
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'A storage connection with this name already exists' },
          { status: 409 }
        )
      }
      updates.push('name = ?')
      values.push(body.name)
    }

    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }

    if (body.config !== undefined) {
      const existingConfig = JSON.parse(existing.config)
      const mergedConfig = { ...existingConfig, ...body.config }
      updates.push('config = ?')
      values.push(JSON.stringify(mergedConfig))
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Add updated_at
    updates.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    db.prepare(`
      UPDATE storage_connections
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    // Fetch updated connection
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
    console.error('Error updating storage connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update storage connection' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/storage-connections/[id]
 * Delete a storage connection
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const db = getDatabase()

    // Check if connection exists
    const existing = db.prepare('SELECT id FROM storage_connections WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Storage connection not found' },
        { status: 404 }
      )
    }

    // Delete the connection
    db.prepare('DELETE FROM storage_connections WHERE id = ?').run(id)

    return NextResponse.json({
      success: true,
      message: 'Storage connection deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting storage connection:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete storage connection' },
      { status: 500 }
    )
  }
}
