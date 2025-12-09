'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { ArrowRight, Zap, Database, GitBranch, Sparkles, Shield, BarChart3, CheckCircle2, Clock, Eye, Search } from 'lucide-react'
import Image from 'next/image'
import { CreatePipelineModal } from '@/components/workflows/create-workflow-modal'

export default function HomePage() {
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = React.useState(false)

  const features = [
    {
      title: 'Medallion Architecture',
      description: 'Automated Bronze, Silver, Gold data layers with full lineage tracking',
      icon: Database,
      status: 'available',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'AI-Powered Intelligence',
      description: 'Automatic schema detection, primary key analysis, and transformation suggestions',
      icon: Sparkles,
      status: 'available',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Pattern Matching',
      description: 'Process multiple files with glob patterns (e.g., customer_*.csv)',
      icon: GitBranch,
      status: 'available',
      gradient: 'from-indigo-500 to-purple-500'
    },
    {
      title: 'DuckDB Integration',
      description: 'Build Snowflake schemas with dimensions and fact tables',
      icon: BarChart3,
      status: 'available',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Data Reconciliation',
      description: 'Automated validation, row counts, and drift detection',
      icon: CheckCircle2,
      status: 'coming-soon',
      gradient: 'from-orange-500 to-red-500'
    },
    {
      title: 'Downstream Feeds',
      description: 'Push data to SFTP, databases, APIs, and cloud storage',
      icon: Zap,
      status: 'coming-soon',
      gradient: 'from-yellow-500 to-orange-500'
    },
    {
      title: 'Real-time Monitoring',
      description: 'Track job executions, performance metrics, and data quality',
      icon: Eye,
      status: 'coming-soon',
      gradient: 'from-teal-500 to-cyan-500'
    },
    {
      title: 'Enterprise Security',
      description: 'Role-based access control, audit logs, and compliance tracking',
      icon: Shield,
      status: 'coming-soon',
      gradient: 'from-red-500 to-pink-500'
    }
  ]

  const stats = [
    { label: 'Data Layers', value: '3', description: 'Bronze, Silver, Gold' },
    { label: 'Job Types', value: '5+', description: 'File, DB, API, Analytics' },
    { label: 'AI Features', value: '4', description: 'Schema, Keys, Quality' },
    { label: 'Integrations', value: '10+', description: 'Coming Soon' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-200 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-16 sm:pt-24 sm:pb-20">
          <div className="text-center">
            {/* Large Logo */}
            <div className="flex justify-center mb-6">
              <div className="relative w-48 h-48">
                <Image
                  src="/logo-large.svg"
                  alt="FlowForge Logo"
                  width={240}
                  height={240}
                  priority
                />
              </div>
            </div>

            {/* Hero Text */}
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-brand-gradient bg-clip-text text-transparent mb-4 pb-3">
              FlowForge
            </h1>

            <p className="text-xl sm:text-2xl text-slate-600 font-medium mb-3">
              Enterprise Data Orchestration Platform
            </p>

            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-8">
              Build robust data pipelines with Medallion Architecture. Transform raw data into business-ready insights with AI-powered automation.
            </p>

            {/* Dual CTA Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4 items-center">
              <Button
                size="lg"
                className="bg-brand-gradient hover:shadow-brand-lg text-white px-8 py-6 text-lg transition-all w-full sm:w-auto"
                onClick={() => setShowCreateModal(true)}
              >
                Create a New Pipeline
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-primary hover:bg-primary hover:text-white px-8 py-6 text-lg transition-all w-full sm:w-auto"
                onClick={() => router.push('/data-assets/explorer')}
              >
                <Search className="mr-2 w-5 h-5" />
                Explore Data
              </Button>
            </div>

            {/* CTA Helper Text */}
            <div className="flex flex-col sm:flex-row justify-center gap-6 mt-4 text-sm text-slate-500 max-w-2xl mx-auto">
              <div className="flex items-center justify-center gap-2">
                <span className="text-primary font-semibold">New users:</span>
                <span>Start building pipelines</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-primary font-semibold">Explorers:</span>
                <span>Browse data catalog</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                  <div className="text-3xl font-bold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm font-semibold text-slate-700">{stat.label}</div>
                  <div className="text-xs text-slate-500 mt-1">{stat.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 pt-16 pb-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Powerful Features
          </h2>
          <p className="text-lg text-slate-600">
            Everything you need for enterprise-grade data orchestration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card
                key={index}
                className={`relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                  feature.status === 'available'
                    ? 'border-primary-200 hover:border-primary-400 hover:shadow-brand'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${feature.gradient}`} style={{ opacity: 0.1 }}>
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <Badge
                      variant={feature.status === 'available' ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {feature.status === 'available' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Available
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          Coming Soon
                        </>
                      )}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Vision Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-12">
        <div className="max-w-4xl mx-auto px-6 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Our Vision
          </h2>
          <p className="text-xl text-blue-100 mb-6">
            Democratize enterprise data engineering with intelligent automation and best practices built-in.
          </p>
          <p className="text-lg text-blue-50">
            FlowForge empowers data teams to build production-ready pipelines in minutes, not weeks.
            From raw data ingestion to analytics-ready datasets, we handle the complexity so you can focus on insights.
          </p>
        </div>
      </div>

      {/* Create Pipeline Modal */}
      <CreatePipelineModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  )
}
