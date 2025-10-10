export interface MonitorFilters {
  status?: string[]
  workflowIds?: string[]
  timeRange?: string
  search?: string
  page?: number
  limit?: number
}

export class MonitorService {
  private static baseUrl = '/api/orchestration/monitor'

  static async getExecutions(filters: MonitorFilters = {}) {
    const params = new URLSearchParams()

    if (filters.status?.length) {
      params.append('status', filters.status.join(','))
    }
    if (filters.workflowIds?.length) {
      params.append('workflowIds', filters.workflowIds.join(','))
    }
    if (filters.timeRange) {
      params.append('timeRange', filters.timeRange)
    }
    if (filters.search) {
      params.append('search', filters.search)
    }
    if (filters.page) {
      params.append('page', filters.page.toString())
    }
    if (filters.limit) {
      params.append('limit', filters.limit.toString())
    }

    const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch executions')
    }

    return response.json()
  }

  static async getExecutionDetails(executionId: string) {
    const response = await fetch(`${this.baseUrl}/${executionId}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch execution details')
    }

    return response.json()
  }

  static async getPerformanceMetrics(timeRange: string = '30d') {
    const response = await fetch(`${this.baseUrl}/performance?timeRange=${timeRange}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch performance metrics')
    }

    return response.json()
  }
}
