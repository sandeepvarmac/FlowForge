"use client"

import { MetricCard, SimpleLineChart, SimpleAreaChart, SimpleBarChart, SimplePieChart, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Activity, TrendingUp, AlertTriangle, CheckCircle, Clock, Server } from 'lucide-react'
import { 
  mockDashboardMetrics, 
  mockRecentActivities, 
  mockWorkflowTrends, 
  mockPerformanceData, 
  mockStatusDistribution,
  generateMiniTrend 
} from '@/lib/mock-data'
import { formatDate } from '@/lib/utils'

export default function Page() {
  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="border-l-4 border-primary pl-6">
        <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
        <p className="text-foreground-secondary mt-2 text-lg">
          Welcome to FlowForge - Your Workflow Management Platform
        </p>
        <p className="text-xs text-foreground-muted mt-1">
          Last updated: {formatDate(mockDashboardMetrics.lastUpdated)}
        </p>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <MetricCard
          title="Workflow Runs Today"
          value={mockDashboardMetrics.runsToday}
          change={{
            value: 12,
            type: 'increase',
            period: 'yesterday'
          }}
          icon={Activity}
          trend={generateMiniTrend()}
          variant="default"
        />
        
        <MetricCard
          title="Active Workflows"
          value={mockDashboardMetrics.activeWorkflows}
          change={{
            value: 8,
            type: 'increase',
            period: 'last week'
          }}
          icon={CheckCircle}
          trend={generateMiniTrend()}
          variant="success"
        />
        
        <MetricCard
          title="Failed Runs"
          value={mockDashboardMetrics.failures}
          change={{
            value: 15,
            type: 'decrease',
            period: 'yesterday'
          }}
          icon={AlertTriangle}
          trend={generateMiniTrend()}
          variant="error"
        />
        
        <MetricCard
          title="DQ Violations"
          value={mockDashboardMetrics.dqViolations}
          change={{
            value: 5,
            type: 'decrease',
            period: 'yesterday'
          }}
          icon={TrendingUp}
          trend={generateMiniTrend()}
          variant="warning"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
        <SimpleAreaChart
          title="Workflow Executions (Last 7 Days)"
          data={mockWorkflowTrends}
          dataKey="executions"
          color="#2563eb"
          height={280}
        />
        
        <SimplePieChart
          title="Workflow Status Distribution"
          data={mockStatusDistribution}
          dataKey="value"
          nameKey="name"
          height={280}
        />
      </div>

      {/* Performance and Activity Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
        <div className="xl:col-span-2 order-2 xl:order-1">
          <SimpleLineChart
            title="System Performance (Last 24 Hours)"
            data={mockPerformanceData}
            dataKey="responseTime"
            color="#059669"
            height={300}
          />
        </div>
        
        <Card className="shadow-corporate-lg order-1 xl:order-2">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              Recent Activity
              <div className="w-2 h-2 md:w-3 md:h-3 bg-primary rounded-full animate-pulse"></div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[300px] md:max-h-[350px] overflow-y-auto">
            <div className="space-y-0">
              {mockRecentActivities.slice(0, 6).map((activity, index) => (
                <div 
                  key={activity.id} 
                  className="flex items-center space-x-3 p-3 md:p-4 hover:bg-background-tertiary transition-colors border-b border-border last:border-b-0"
                >
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    activity.status === 'success' ? 'bg-green-50' :
                    activity.status === 'failed' ? 'bg-red-50' :
                    activity.status === 'running' ? 'bg-blue-50' : 'bg-gray-50'
                  }`}>
                    <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                      activity.status === 'success' ? 'bg-success' :
                      activity.status === 'failed' ? 'bg-error' :
                      activity.status === 'running' ? 'bg-primary' : 'bg-gray-400'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium text-foreground truncate">
                      {activity.workflowName}
                    </p>
                    <p className="text-xs text-foreground-muted">
                      {formatDate(activity.timestamp)}
                    </p>
                    {activity.message && (
                      <p className="text-xs text-foreground-muted mt-1 line-clamp-2 hidden md:block">
                        {activity.message}
                      </p>
                    )}
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full font-medium border flex-shrink-0 ${
                    activity.status === 'success' ? 'text-success bg-green-50 border-green-200' :
                    activity.status === 'failed' ? 'text-error bg-red-50 border-red-200' :
                    activity.status === 'running' ? 'text-primary bg-primary-50 border-primary-200' : 
                    'text-gray-600 bg-gray-50 border-gray-200'
                  }`}>
                    {activity.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Overview */}
      <Card className="shadow-corporate-lg">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-3 text-lg">
            <Server className="w-5 h-5 text-primary" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Total Workflows</span>
                <span className="font-semibold text-foreground">{mockDashboardMetrics.totalWorkflows}</span>
              </div>
              <div className="w-full bg-background-tertiary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${(mockDashboardMetrics.activeWorkflows / mockDashboardMetrics.totalWorkflows) * 100}%` }}
                />
              </div>
              <p className="text-xs text-foreground-muted">
                {mockDashboardMetrics.activeWorkflows} active workflows
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Success Rate</span>
                <span className="font-semibold text-success">91.7%</span>
              </div>
              <div className="w-full bg-background-tertiary rounded-full h-2">
                <div className="bg-success h-2 rounded-full transition-all duration-300" style={{ width: '91.7%' }} />
              </div>
              <p className="text-xs text-foreground-muted">
                22 successful runs today
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground-muted">Avg Response Time</span>
                <span className="font-semibold text-foreground">287ms</span>
              </div>
              <div className="w-full bg-background-tertiary rounded-full h-2">
                <div className="bg-secondary h-2 rounded-full transition-all duration-300" style={{ width: '65%' }} />
              </div>
              <p className="text-xs text-foreground-muted">
                15% faster than last week
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

