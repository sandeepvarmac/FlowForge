export class OrchestrationService {
  private static baseUrl = '/api/orchestration'

  static async getOverviewMetrics() {
    const response = await fetch(`${this.baseUrl}/overview`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error('Failed to fetch overview metrics')
    }

    return response.json()
  }
}
