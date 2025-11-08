export type DatabaseType = 'sql-server' | 'postgresql' | 'mysql' | 'oracle'

export interface DatabaseConnection {
  id: string
  name: string
  description?: string
  type: DatabaseType

  // Connection details
  host: string
  port: number
  database: string
  username: string
  password: string

  // Additional settings
  sslEnabled?: boolean
  connectionTimeout?: number

  // Metadata
  lastTestedAt?: number
  lastTestStatus?: 'success' | 'failed'
  lastTestMessage?: string

  createdAt: number
  updatedAt: number
}

export interface CreateConnectionInput {
  name: string
  description?: string
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  sslEnabled?: boolean
  connectionTimeout?: number
}

export interface UpdateConnectionInput extends Partial<CreateConnectionInput> {
  id: string
}
