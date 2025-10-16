import { WorkflowTrigger, CreateTriggerRequest, UpdateTriggerRequest } from '@/types/trigger'

/**
 * Workflow Triggers Service
 * Handles CRUD operations for workflow triggers (time-based, dependency-based, event-driven)
 */
export class TriggersService {
  private static baseUrl = '/api'

  /**
   * Hydrate trigger data from API (convert timestamps to Date objects)
   */
  private static hydrateTrigger(raw: any): WorkflowTrigger {
    return {
      ...raw,
      nextRunAt: raw.nextRunAt ? new Date(raw.nextRunAt * 1000) : undefined, // Unix timestamp to Date
      lastRunAt: raw.lastRunAt ? new Date(raw.lastRunAt * 1000) : undefined,
      createdAt: new Date(raw.createdAt * 1000),
      updatedAt: new Date(raw.updatedAt * 1000),
    }
  }

  /**
   * Get all triggers for a workflow
   */
  static async getTriggers(workflowId: string): Promise<WorkflowTrigger[]> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch triggers')
    }

    const result = await response.json()
    return result.triggers.map(this.hydrateTrigger)
  }

  /**
   * Get a specific trigger by ID
   */
  static async getTrigger(workflowId: string, triggerId: string): Promise<WorkflowTrigger> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/${triggerId}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch trigger')
    }

    const result = await response.json()
    return this.hydrateTrigger(result.trigger)
  }

  /**
   * Create a new trigger
   */
  static async createTrigger(workflowId: string, data: CreateTriggerRequest): Promise<WorkflowTrigger> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to create trigger')
    }

    const result = await response.json()
    console.log(`Created ${data.triggerType} trigger for workflow ${workflowId}`)
    return this.hydrateTrigger(result.trigger)
  }

  /**
   * Update an existing trigger
   */
  static async updateTrigger(
    workflowId: string,
    triggerId: string,
    updates: UpdateTriggerRequest
  ): Promise<WorkflowTrigger> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/${triggerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update trigger')
    }

    const result = await response.json()
    console.log(`Updated trigger ${triggerId}`)
    return this.hydrateTrigger(result.trigger)
  }

  /**
   * Delete a trigger
   */
  static async deleteTrigger(workflowId: string, triggerId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/${triggerId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete trigger')
    }

    console.log(`Deleted trigger ${triggerId}`)
  }

  /**
   * Enable a trigger
   */
  static async enableTrigger(workflowId: string, triggerId: string): Promise<WorkflowTrigger> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/${triggerId}/enable`, {
      method: 'PATCH'
    })

    if (!response.ok) {
      throw new Error('Failed to enable trigger')
    }

    const result = await response.json()
    console.log(`Enabled trigger ${triggerId}`)
    return this.hydrateTrigger(result.trigger)
  }

  /**
   * Disable a trigger
   */
  static async disableTrigger(workflowId: string, triggerId: string): Promise<WorkflowTrigger> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/${triggerId}/disable`, {
      method: 'PATCH'
    })

    if (!response.ok) {
      throw new Error('Failed to disable trigger')
    }

    const result = await response.json()
    console.log(`Disabled trigger ${triggerId}`)
    return this.hydrateTrigger(result.trigger)
  }

  /**
   * Preview next scheduled run times for a cron expression
   */
  static async previewSchedule(
    workflowId: string,
    cronExpression: string,
    timezone: string = 'UTC',
    count: number = 5
  ): Promise<Date[]> {
    const response = await fetch(
      `${this.baseUrl}/workflows/${workflowId}/triggers/schedule/preview?cron=${encodeURIComponent(cronExpression)}&timezone=${timezone}&count=${count}`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to preview schedule')
    }

    const result = await response.json()
    return result.nextRuns.map((timestamp: number) => new Date(timestamp * 1000))
  }

  /**
   * Get dependency graph for a workflow
   * Returns upstream and downstream dependencies
   */
  static async getDependencyGraph(workflowId: string): Promise<{
    upstream: Array<{ workflowId: string; workflowName: string; triggerId: string }>
    downstream: Array<{ workflowId: string; workflowName: string; triggerId: string }>
  }> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/dependencies`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch dependency graph')
    }

    return await response.json()
  }

  /**
   * Get list of workflows that can be used as upstream dependencies
   */
  static async getAvailableUpstreamWorkflows(workflowId: string): Promise<Array<{
    id: string
    name: string
    description?: string
  }>> {
    const response = await fetch(`${this.baseUrl}/workflows/available-upstream?excludeWorkflowId=${workflowId}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch available workflows')
    }

    const result = await response.json()
    return result.workflows
  }

  /**
   * Validate dependency trigger (check for circular dependencies)
   */
  static async validateDependency(
    workflowId: string,
    dependsOnWorkflowId: string
  ): Promise<{ valid: boolean; error?: string; chain?: string[] }> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/triggers/validate-dependency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dependsOnWorkflowId })
    })

    if (!response.ok) {
      throw new Error('Failed to validate dependency')
    }

    return await response.json()
  }

  /**
   * Get trigger execution history
   */
  static async getTriggerHistory(
    workflowId: string,
    triggerId: string,
    limit: number = 10
  ): Promise<Array<{
    executionId: string
    triggeredAt: Date
    status: string
    duration?: number
  }>> {
    const response = await fetch(
      `${this.baseUrl}/workflows/${workflowId}/triggers/${triggerId}/history?limit=${limit}`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      throw new Error('Failed to fetch trigger history')
    }

    const result = await response.json()
    return result.history.map((item: any) => ({
      ...item,
      triggeredAt: new Date(item.triggeredAt)
    }))
  }
}
