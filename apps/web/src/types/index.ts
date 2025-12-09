// Primary exports - new terminology
export * from './pipeline'
export * from './dashboard'

// Legacy exports for backward compatibility
// TODO: Remove after full migration
export * from './workflow'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  department: string
}

export type UserRole = 'admin' | 'user' | 'viewer'

export interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
  errors?: string[]
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}