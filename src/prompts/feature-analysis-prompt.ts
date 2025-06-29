import { Prompt, PromptArgument, PromptMessage } from '@core/types.js';

export class FeatureAnalysisPrompt implements Prompt {
  public readonly name = 'pb_feature_analysis';
  public readonly description = 'Analyze and provide insights on Productboard features data';
  public readonly arguments: PromptArgument[] = [
    {
      name: 'features_data',
      description: 'JSON data containing features information',
      required: true,
    },
    {
      name: 'analysis_type',
      description: 'Type of analysis to perform (priority, status, trends, gaps)',
      required: false,
    },
    {
      name: 'focus_area',
      description: 'Specific area to focus analysis on (e.g., component, release, team)',
      required: false,
    },
  ];

  async execute(params: any): Promise<PromptMessage[]> {
    const { features_data, analysis_type = 'priority', focus_area } = params || {};

    if (!features_data) {
      return [
        {
          role: 'system',
          content: {
            type: 'text',
            text: 'Error: features_data parameter is required for feature analysis.',
          },
        },
      ];
    }

    let analysisPrompt = '';
    
    switch (analysis_type) {
      case 'priority':
        analysisPrompt = `Analyze the priority distribution and prioritization patterns in these Productboard features. Identify:
- High priority features and their characteristics
- Priority distribution across components/releases
- Features that may need priority adjustment
- Potential priority conflicts or gaps`;
        break;
        
      case 'status':
        analysisPrompt = `Analyze the status distribution and workflow patterns in these Productboard features. Identify:
- Features stuck in certain statuses
- Status progression bottlenecks  
- Features ready to advance to next status
- Status distribution health across the pipeline`;
        break;
        
      case 'trends':
        analysisPrompt = `Analyze trends and patterns in these Productboard features. Identify:
- Common themes and feature categories
- Release planning patterns
- Feature complexity trends
- Dependencies and interconnections`;
        break;
        
      case 'gaps':
        analysisPrompt = `Analyze gaps and opportunities in these Productboard features. Identify:
- Missing feature areas or capabilities
- Underrepresented components or user segments
- Potential feature consolidation opportunities
- Strategic gaps in the product roadmap`;
        break;
        
      default:
        analysisPrompt = `Provide a comprehensive analysis of these Productboard features including priority distribution, status health, trends, and strategic gaps.`;
    }

    if (focus_area) {
      analysisPrompt += `\n\nFocus specifically on: ${focus_area}`;
    }

    return [
      {
        role: 'system',
        content: {
          type: 'text',
          text: `You are a product management expert analyzing Productboard features data. Provide actionable insights based on the data provided.`,
        },
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: `${analysisPrompt}

Features Data:
${typeof features_data === 'string' ? features_data : JSON.stringify(features_data, null, 2)}

Please provide:
1. Key insights and findings
2. Specific recommendations
3. Action items for the product team
4. Data-driven conclusions`,
        },
      },
    ];
  }
}