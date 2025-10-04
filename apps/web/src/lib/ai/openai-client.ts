import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  Warning: OPENAI_API_KEY not found in environment variables')
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-dummy-key-for-build'
})

export interface AISchemaAnalysis {
  columns: Array<{
    name: string
    detectedType: string
    semanticType: string
    description: string
    dataFormat?: string
    businessMeaning?: string
    suggestedValidations: string[]
  }>
  dataQualitySuggestions: Array<{
    type: string
    severity: 'warning' | 'error' | 'info'
    message: string
    column?: string
    suggestedRule?: any
  }>
  transformationSuggestions: Array<{
    column: string
    suggestion: string
    transformation: string
    reason: string
  }>
  overallQualityScore: number
  insights: string[]
}

/**
 * Analyze CSV schema using AI
 */
export async function analyzeSchemaWithAI(
  columns: Array<{ name: string; type: string; sample?: string }>,
  preview: any[]
): Promise<AISchemaAnalysis> {
  try {
    const prompt = `You are an expert data engineer analyzing a CSV file schema. Analyze the following data:

COLUMNS:
${columns.map((col, i) => `${i + 1}. ${col.name} (detected: ${col.type}, sample: "${col.sample || 'N/A'}")`).join('\n')}

SAMPLE DATA (first 3 rows):
${JSON.stringify(preview.slice(0, 3), null, 2)}

Provide a comprehensive analysis including:
1. Enhanced column definitions with semantic meaning
2. Data quality issues and suggestions
3. Recommended transformations
4. Business insights

Return your analysis as a JSON object matching this structure:
{
  "columns": [
    {
      "name": "column_name",
      "detectedType": "string|integer|decimal|date|email|phone",
      "semanticType": "identifier|name|email|phone|amount|date|category|etc",
      "description": "Business meaning of this column",
      "dataFormat": "Format pattern if applicable",
      "businessMeaning": "What this represents in business context",
      "suggestedValidations": ["validation rule suggestions"]
    }
  ],
  "dataQualitySuggestions": [
    {
      "type": "missing_values|format_issues|outliers|duplicates",
      "severity": "warning|error|info",
      "message": "Description of the issue",
      "column": "affected column",
      "suggestedRule": { rule object }
    }
  ],
  "transformationSuggestions": [
    {
      "column": "column_name",
      "suggestion": "What to transform",
      "transformation": "How to transform",
      "reason": "Why transform"
    }
  ],
  "overallQualityScore": 85,
  "insights": ["Business insights about the data"]
}

IMPORTANT: Return ONLY valid JSON, no markdown or explanations.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert data engineer. Always respond with valid JSON only, no markdown formatting.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0].message.content || '{}'
    const analysis = JSON.parse(content)

    console.log('✨ AI Schema Analysis completed')
    return analysis as AISchemaAnalysis

  } catch (error) {
    console.error('❌ AI Schema Analysis failed:', error)
    // Return fallback analysis
    return {
      columns: columns.map(col => ({
        name: col.name,
        detectedType: col.type,
        semanticType: col.type,
        description: `Column: ${col.name}`,
        suggestedValidations: []
      })),
      dataQualitySuggestions: [],
      transformationSuggestions: [],
      overallQualityScore: 50,
      insights: ['AI analysis not available']
    }
  }
}

/**
 * Generate transformation SQL from natural language
 */
export async function generateTransformationSQL(
  description: string,
  columns: string[]
): Promise<string> {
  try {
    const prompt = `Generate a SQL CASE expression or transformation logic for the following:

Description: ${description}
Available columns: ${columns.join(', ')}

Return ONLY the SQL expression, no explanations.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a SQL expert. Return only SQL code.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 500
    })

    return response.choices[0].message.content?.trim() || ''
  } catch (error) {
    console.error('❌ SQL Generation failed:', error)
    return ''
  }
}
