/**
 * AI-powered Primary Key Detection
 * Analyzes columns to determine the best candidate for primary key
 */

export interface ColumnStats {
  name: string
  totalRows: number
  uniqueCount: number
  nullCount: number
  uniquenessPercent: number
  nullPercent: number
  dataType: 'string' | 'integer' | 'decimal' | 'date' | 'boolean' | 'mixed'
  sampleValues: string[]
  isPrimaryKeyCandidate: boolean
  score: number
  reasons: string[]
}

export interface PrimaryKeyRecommendation {
  recommendedColumn: string | null
  confidence: 'high' | 'medium' | 'low' | 'none'
  allColumns: ColumnStats[]
  warnings: string[]
}

/**
 * Analyze column data and detect primary key candidates
 */
export function analyzePrimaryKeyCandidates(
  data: any[],
  schema: Array<{ name: string; type: string }>
): PrimaryKeyRecommendation {
  if (!data || data.length === 0) {
    return {
      recommendedColumn: null,
      confidence: 'none',
      allColumns: [],
      warnings: ['No data provided for analysis']
    }
  }

  const totalRows = data.length
  const columnStats: ColumnStats[] = []
  const warnings: string[] = []

  // Analyze each column
  for (const col of schema) {
    const stats = analyzeColumn(col.name, data, totalRows)
    columnStats.push(stats)
  }

  // Sort by score (highest first)
  columnStats.sort((a, b) => b.score - a.score)

  // Find best candidate
  const bestCandidate = columnStats.find(col => col.isPrimaryKeyCandidate)

  let confidence: 'high' | 'medium' | 'low' | 'none' = 'none'
  if (bestCandidate) {
    if (bestCandidate.score >= 90) confidence = 'high'
    else if (bestCandidate.score >= 70) confidence = 'medium'
    else if (bestCandidate.score >= 50) confidence = 'low'
  }

  // Add warnings
  if (!bestCandidate) {
    warnings.push('No suitable primary key candidate found. Consider adding a unique identifier column.')
  }

  return {
    recommendedColumn: bestCandidate?.name || null,
    confidence,
    allColumns: columnStats,
    warnings
  }
}

/**
 * Analyze individual column for primary key suitability
 */
function analyzeColumn(columnName: string, data: any[], totalRows: number): ColumnStats {
  const values = data.map(row => row[columnName])
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '')
  
  const uniqueValues = new Set(nonNullValues)
  const uniqueCount = uniqueValues.size
  const nullCount = totalRows - nonNullValues.length

  const uniquenessPercent = totalRows > 0 ? (uniqueCount / totalRows) * 100 : 0
  const nullPercent = totalRows > 0 ? (nullCount / totalRows) * 100 : 0

  const dataType = detectDataType(nonNullValues)
  const sampleValues = Array.from(uniqueValues).slice(0, 5).map(v => String(v))

  const { score, reasons, isPrimaryKeyCandidate } = calculatePrimaryKeyScore(
    columnName,
    uniquenessPercent,
    nullPercent,
    dataType,
    totalRows,
    uniqueCount
  )

  return {
    name: columnName,
    totalRows,
    uniqueCount,
    nullCount,
    uniquenessPercent,
    nullPercent,
    dataType,
    sampleValues,
    isPrimaryKeyCandidate,
    score,
    reasons
  }
}

function detectDataType(values: any[]): 'string' | 'integer' | 'decimal' | 'date' | 'boolean' | 'mixed' {
  if (values.length === 0) return 'string'

  const sample = values.slice(0, 100)
  let intCount = 0
  let floatCount = 0

  for (const val of sample) {
    const str = String(val).trim()
    if (/^\d+$/.test(str)) {
      intCount++
    } else if (/^\d+\.\d+$/.test(str)) {
      floatCount++
    }
  }

  const threshold = sample.length * 0.8
  if (intCount > threshold) return 'integer'
  if (floatCount > threshold) return 'decimal'
  return 'string'
}

function calculatePrimaryKeyScore(
  columnName: string,
  uniquenessPercent: number,
  nullPercent: number,
  dataType: string,
  totalRows: number,
  uniqueCount: number
): { score: number; reasons: string[]; isPrimaryKeyCandidate: boolean } {
  let score = 0
  const reasons: string[] = []

  if (uniquenessPercent === 100) {
    score += 50
    reasons.push('100% unique values')
  } else if (uniquenessPercent >= 95) {
    score += 40
    reasons.push('Near-unique values')
  }

  if (nullPercent === 0) {
    score += 20
    reasons.push('No null values')
  } else if (nullPercent < 5) {
    score += 15
    reasons.push('Few null values')
  }

  const lowerName = columnName.toLowerCase()
  if (lowerName.includes('_id') || lowerName.endsWith('id') || lowerName === 'id') {
    score += 15
    reasons.push('ID field name')
  }

  if (dataType === 'integer') {
    score += 15
    reasons.push('Integer type')
  } else if (dataType === 'string') {
    score += 10
    reasons.push('String type')
  }

  const isPrimaryKeyCandidate = uniquenessPercent >= 95 && nullPercent < 10 && score >= 50

  return { score, reasons, isPrimaryKeyCandidate }
}
