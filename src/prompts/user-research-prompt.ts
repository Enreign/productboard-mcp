import { Prompt, PromptArgument, PromptMessage } from '@core/types.js';

export class UserResearchPrompt implements Prompt {
  public readonly name = 'pb_user_research';
  public readonly description = 'Generate user research insights and recommendations based on Productboard data';
  public readonly arguments: PromptArgument[] = [
    {
      name: 'research_data',
      description: 'JSON data containing user feedback, notes, or research information',
      required: true,
    },
    {
      name: 'research_goal',
      description: 'Specific research objective (personas, pain_points, opportunities, validation)',
      required: false,
    },
    {
      name: 'user_segment',
      description: 'Specific user segment to focus analysis on',
      required: false,
    },
  ];

  async execute(params: any): Promise<PromptMessage[]> {
    const { research_data, research_goal = 'insights', user_segment } = params || {};

    if (!research_data) {
      return [
        {
          role: 'system',
          content: {
            type: 'text',
            text: 'Error: research_data parameter is required for user research analysis.',
          },
        },
      ];
    }

    let researchPrompt = '';
    
    switch (research_goal) {
      case 'personas':
        researchPrompt = `Based on this user research data, create detailed user personas. Include:
- Demographic and behavioral characteristics
- Goals, motivations, and pain points
- Usage patterns and preferences
- Persona-specific needs and priorities
- How each persona interacts with the product`;
        break;
        
      case 'pain_points':
        researchPrompt = `Analyze this user research data to identify key pain points. Include:
- Most frequently mentioned problems
- Critical user frustrations and blockers
- Pain points by user segment or use case
- Impact severity of each pain point
- Potential solutions and workarounds`;
        break;
        
      case 'opportunities':
        researchPrompt = `Identify opportunities and unmet needs from this user research data. Include:
- Gaps in current product capabilities
- Emerging user needs and trends
- Feature opportunities with high user value
- Market opportunities and competitive advantages
- Innovation potential areas`;
        break;
        
      case 'validation':
        researchPrompt = `Validate assumptions and hypotheses using this user research data. Include:
- Evidence supporting or contradicting current assumptions
- User behavior patterns vs. expected behavior
- Feature usage and adoption insights
- Market validation findings
- Risk assessment for product decisions`;
        break;
        
      default:
        researchPrompt = `Provide comprehensive user research insights from this data including key findings, user needs, pain points, and opportunities.`;
    }

    if (user_segment) {
      researchPrompt += `\n\nFocus specifically on the user segment: ${user_segment}`;
    }

    return [
      {
        role: 'system',
        content: {
          type: 'text',
          text: `You are a UX researcher and product strategist specializing in user research analysis. Provide evidence-based insights that can inform product decisions.`,
        },
      },
      {
        role: 'user',
        content: {
          type: 'text',
          text: `${researchPrompt}

Research Data:
${typeof research_data === 'string' ? research_data : JSON.stringify(research_data, null, 2)}

Please provide:
1. Key research findings and insights
2. User needs and requirements
3. Actionable recommendations for product team
4. Supporting evidence and data points
5. Next steps for further research if needed`,
        },
      },
    ];
  }
}