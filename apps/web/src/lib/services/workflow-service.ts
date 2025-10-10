import { Workflow, WorkflowFormData, WorkflowStatus, Job } from '@/types/workflow'

/**
 * Real API-based Workflow Service
 */
export class WorkflowService {
  private static baseUrl = '/api'

  /**
   * Hydrate workflow data from API (convert date strings to Date objects)
   */
  private static hydrateWorkflow(raw: any): Workflow {
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      lastRun: raw.lastRun ? new Date(raw.lastRun) : undefined,
      nextRun: raw.nextRun ? new Date(raw.nextRun) : undefined,
      jobs: Array.isArray(raw.jobs)
        ? raw.jobs.map((job: any) => ({
            ...job,
            createdAt: new Date(job.createdAt),
            updatedAt: new Date(job.updatedAt),
            lastRun: job.lastRun ? new Date(job.lastRun) : undefined,
          }))
        : [],
    }
  }

  /**
   * Hydrate job data from API (convert date strings to Date objects)
   */
  private static hydrateJob(raw: any): Job {
    return {
      ...raw,
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      lastRun: raw.lastRun ? new Date(raw.lastRun) : undefined,
    }
  }

  // Create a new workflow
  static async createWorkflow(data: WorkflowFormData): Promise<Workflow> {
    const response = await fetch(`${this.baseUrl}/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Failed to create workflow')
    }

    const result = await response.json()
    return this.hydrateWorkflow(result.workflow)
  }

  // Get all workflows
  static async getWorkflows(): Promise<Workflow[]> {
    const response = await fetch(`${this.baseUrl}/workflows`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch workflows')
    }

    const result = await response.json()
    return result.workflows.map(this.hydrateWorkflow)
  }

  // Get all workflows with their latest execution summary
  static async getWorkflowsWithLastExecution(): Promise<any[]> {
    const response = await fetch(`${this.baseUrl}/workflows?includeLastExecution=true`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch workflows')
    }

    const result = await response.json()
    return result.workflows.map((workflow: any) => ({
      ...this.hydrateWorkflow(workflow),
      lastExecution: workflow.lastExecution ? {
        id: workflow.lastExecution.id,
        status: workflow.lastExecution.status,
        startTime: workflow.lastExecution.startTime ? new Date(workflow.lastExecution.startTime) : undefined,
        endTime: workflow.lastExecution.endTime ? new Date(workflow.lastExecution.endTime) : undefined,
        duration: workflow.lastExecution.duration,
        completedJobs: workflow.lastExecution.completedJobs || 0,
        failedJobs: workflow.lastExecution.failedJobs || 0,
        totalJobs: workflow.lastExecution.totalJobs || 0,
      } : null
    }))
  }

  // Update workflow status
  static async updateWorkflowStatus(workflowId: string, status: WorkflowStatus): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })

    if (!response.ok) {
      throw new Error('Failed to update workflow status')
    }

    console.log(`Updated workflow ${workflowId} status to ${status}`)
  }

  // Run a manual workflow
  static async runWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/run`, {
      method: 'POST'
    })

    if (!response.ok) {
      throw new Error('Failed to run workflow')
    }

    console.log(`Started execution of workflow ${workflowId}`)
  }

  // Pause a scheduled workflow
  static async pauseWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'paused')
  }

  // Resume a paused workflow
  static async resumeWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'scheduled')
  }

  // Delete a workflow
  static async deleteWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete workflow')
    }

    console.log(`Deleted workflow ${workflowId}`)
  }

  // Update workflow details
  static async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error('Failed to update workflow')
    }

    const result = await response.json()
    return this.hydrateWorkflow(result.workflow)
  }

  // Get workflow execution history
  static async getWorkflowExecutions(workflowId: string) {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/executions`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch executions')
    }

    const result = await response.json()
    return (result.executions || []).map((execution: any) => ({
      ...execution,
      startTime: execution.startTime ? new Date(execution.startTime) : undefined,
      endTime: execution.endTime ? new Date(execution.endTime) : undefined,
      createdAt: execution.createdAt ? new Date(execution.createdAt) : undefined,
      updatedAt: execution.updatedAt ? new Date(execution.updatedAt) : undefined,
      duration: typeof execution.duration === 'number' ? execution.duration : execution.duration ? Number(execution.duration) : undefined,
      logs: Array.isArray(execution.logs) ? execution.logs : [],
      jobExecutions: Array.isArray(execution.jobExecutions)
        ? execution.jobExecutions.map((job: any) => ({
            ...job,
            startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
            completedAt: job.completedAt ? new Date(job.completedAt) : undefined,
            createdAt: job.createdAt ? new Date(job.createdAt) : undefined,
            updatedAt: job.updatedAt ? new Date(job.updatedAt) : undefined,
            durationMs: typeof job.durationMs === 'number' ? job.durationMs : job.durationMs ? Number(job.durationMs) : undefined,
            logs: Array.isArray(job.logs) ? job.logs : []
          }))
        : []
    }))
  }

  // Create a new job within a workflow
  static async createJob(workflowId: string, job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job)
    })

    if (!response.ok) {
      throw new Error('Failed to create job')
    }

    const result = await response.json()
    console.log(`Created new job: ${result.job.name} in workflow ${workflowId}`)
    return this.hydrateJob(result.job)
  }

  // Execute a job
  static async executeJob(jobId: string, sourceFilePath: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceFilePath })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to execute job')
    }

    return await response.json()
  }

  // Upload file with AI analysis
  static async uploadFile(workflowId: string, jobId: string, file: File): Promise<any> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('workflowId', workflowId)
    formData.append('jobId', jobId)

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload file')
    }

    return await response.json()
  }

  // Update job configuration
  static async updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      throw new Error('Failed to update job')
    }

    const result = await response.json()
    console.log(`Updated job ${jobId}`)
    return this.hydrateJob(result.job)
  }

  // Delete a job
  static async deleteJob(jobId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete job')
    }

    console.log(`Deleted job ${jobId}`)
  }

  // Test data source connection
  static async testDataSourceConnection(sourceConfig: any): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceConfig })
    })

    if (!response.ok) {
      throw new Error('Failed to test connection')
    }

    return await response.json()
  }
}
