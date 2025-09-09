import { Workflow, WorkflowFormData, WorkflowStatus, Job } from '@/types/workflow'

// Simulate API delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class WorkflowService {
  // Create a new workflow
  static async createWorkflow(data: WorkflowFormData): Promise<Workflow> {
    await delay(1500) // Simulate API call
    
    const workflow: Workflow = {
      id: Date.now().toString(),
      name: data.name,
      description: data.description,
      application: data.application,
      owner: data.team,
      status: data.workflowType === 'manual' ? 'manual' : 'scheduled',
      type: data.workflowType,
      jobs: [], // Initialize with empty jobs array
      lastRun: undefined,
      nextRun: data.workflowType === 'scheduled' ? new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    return workflow
  }

  // Update workflow status
  static async updateWorkflowStatus(workflowId: string, status: WorkflowStatus): Promise<void> {
    await delay(800)
    console.log(`Updated workflow ${workflowId} status to ${status}`)
  }

  // Run a manual workflow
  static async runWorkflow(workflowId: string): Promise<void> {
    await delay(2000)
    console.log(`Started execution of workflow ${workflowId}`)
  }

  // Pause a scheduled workflow
  static async pauseWorkflow(workflowId: string): Promise<void> {
    await delay(500)
    console.log(`Paused workflow ${workflowId}`)
  }

  // Resume a paused workflow
  static async resumeWorkflow(workflowId: string): Promise<void> {
    await delay(500)
    console.log(`Resumed workflow ${workflowId}`)
  }

  // Delete a workflow
  static async deleteWorkflow(workflowId: string): Promise<void> {
    await delay(1000)
    console.log(`Deleted workflow ${workflowId}`)
  }

  // Update workflow details
  static async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    await delay(1200)
    
    // Simulate returning updated workflow
    const updatedWorkflow: Workflow = {
      id: workflowId,
      name: updates.name || 'Updated Workflow',
      description: updates.description || 'Updated description',
      application: updates.application || 'MDM',
      owner: updates.owner || 'Team',
      status: updates.status || 'manual',
      type: updates.type || 'manual',
      lastRun: updates.lastRun,
      nextRun: updates.nextRun,
      createdAt: updates.createdAt || new Date(),
      updatedAt: new Date()
    }
    
    return updatedWorkflow
  }

  // Get workflow execution history
  static async getWorkflowExecutions(workflowId: string) {
    await delay(800)
    
    // Mock execution data
    return [
      {
        id: '1',
        workflowId,
        status: 'completed' as const,
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
        duration: 5 * 60 * 1000, // 5 minutes
        logs: ['Started execution', 'Processing data', 'Completed successfully']
      },
      {
        id: '2',
        workflowId,
        status: 'failed' as const,
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
        duration: 2 * 60 * 1000, // 2 minutes
        logs: ['Started execution', 'Error: Connection timeout'],
        error: 'Connection timeout to external API'
      }
    ]
  }

  // Create a new job within a workflow
  static async createJob(job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    await delay(1000)
    
    const newJob: Job = {
      ...job,
      id: `job-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    console.log(`Created new job: ${newJob.name} in workflow ${newJob.workflowId}`)
    return newJob
  }

  // Update job configuration
  static async updateJob(jobId: string, updates: Partial<Job>): Promise<Job> {
    await delay(800)
    
    const updatedJob: Job = {
      id: jobId,
      workflowId: updates.workflowId || '',
      name: updates.name || 'Updated Job',
      description: updates.description || 'Updated description',
      type: updates.type || 'file-based',
      order: updates.order || 1,
      sourceConfig: updates.sourceConfig || {
        id: '',
        name: '',
        type: 'csv',
        connection: {}
      },
      destinationConfig: updates.destinationConfig || {
        bronzeConfig: { enabled: true, tableName: '', storageFormat: 'parquet' }
      },
      transformationConfig: updates.transformationConfig,
      validationConfig: updates.validationConfig,
      status: updates.status || 'configured',
      lastRun: updates.lastRun,
      createdAt: updates.createdAt || new Date(),
      updatedAt: new Date()
    }
    
    console.log(`Updated job ${jobId}`)
    return updatedJob
  }

  // Delete a job
  static async deleteJob(jobId: string): Promise<void> {
    await delay(600)
    console.log(`Deleted job ${jobId}`)
  }

  // Test data source connection
  static async testDataSourceConnection(sourceConfig: any): Promise<{ success: boolean; message: string }> {
    await delay(2000)
    
    // Mock connection test
    const success = Math.random() > 0.2 // 80% success rate
    
    return {
      success,
      message: success 
        ? 'Connection successful' 
        : 'Connection failed: Unable to reach host'
    }
  }
}