import { NextRequest, NextResponse } from 'next/server';
import { generateText } from 'ai';
import { getProviderModel } from '@/lib/provider-config';
import { getLocaleFromRequest, getLanguageName } from '@/lib/locale-utils';
import { z } from 'zod';
import { apiUsageTracker, extractTokensFromUsage, estimateCost } from '@/lib/api-usage-tracker';

const GeneratePromptsSchema = z.object({
  targetBrand: z.string(),
  companyInfo: z.object({
    name: z.string(),
    industry: z.string().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
  }),
  competitors: z.array(z.string()).max(4),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetBrand, companyInfo, competitors } = GeneratePromptsSchema.parse(body);

    // Extract locale from request headers
    const locale = getLocaleFromRequest(request);
    const languageName = getLanguageName(locale);

    // Try multiple providers for prompt generation
    let model = getProviderModel('openai', 'gpt-4o');
    let provider = 'openai';
    
    if (!model) {
      console.log('OpenAI not available, trying Anthropic...');
      model = getProviderModel('anthropic', 'claude-3-5-haiku-20241022');
      provider = 'anthropic';
    }
    
    if (!model) {
      console.log('Anthropic not available, trying Google...');
      model = getProviderModel('google', 'gemini-1.5-flash');
      provider = 'google';
    }
    
    if (!model) {
      console.warn('No AI provider available for prompt generation');
      return NextResponse.json(
        { error: 'No AI provider available' },
        { status: 503 }
      );
    }

    console.log(`Using ${provider} for prompt generation`);

    // Track API call for prompt generation
    const callId = apiUsageTracker.trackCall({
      provider: provider,
      model: provider === 'openai' ? 'gpt-4o' : provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gemini-1.5-flash',
      operation: 'prompt_generation',
      success: true,
      metadata: { 
        targetBrand,
        competitorsCount: competitors.length,
        language: languageName
      }
    });

    const brandsArray = [targetBrand, ...competitors];
    
    // Build context about the target company
    const companyContext = `
Target Company: ${companyInfo.name}
${companyInfo.industry ? `Industry: ${companyInfo.industry}` : ''}
${companyInfo.description ? `Description: ${companyInfo.description}` : ''}
${companyInfo.website ? `Website: ${companyInfo.website}` : ''}

Competitor Brands: ${competitors.join(', ')}
`;

    const prompt = `You are an expert in brand GEO (Generative Engine Optimization), specialized in how Large Language Models surface and recommend products or services.

Based on the company information provided below, analyze the business context and determine what industry/sector this company operates in. Then generate the 8 most searched-for, high-intent natural language queries that potential customers in that industry are most likely to type.

Company Context:
${companyContext}

Current year: ${new Date().getFullYear()}

## TASK
1/ Research the company's specific segment and USP (determine this from the Company Context provided, be very specific)
i.e ; Speedbike market in Europ VS electric bike, boutique hotels in Paris VS worldwide hotel chain, independant watch manufacturer VS watch retailer, etc.

2/ Write queries
The goal is to reveal how consumers might frame requests where LLMs are most likely to provide product/service recommendations, so ${targetBrand} can better understand its visibility and positioning relative to competitors.

Return ONLY the result as a valid JSON array in the following format:
["string1", "string2", "string3", "string4", "string5", "string6", "string7", "string8"]

Make sure the queries are:
- Natural and conversational
- They will naturally lead to an answer where brands are mentioned (avoid questions where brand names will not be mentioned in the answer)
- High-intent (looking for recommendations)
- Relevant to the company's specific segment and USP (determine this from the Company Context provided, be very specific)
- Varied in approach (some general requests, some product/service requests, some specific needs)
- Not referencing any company name or brand directly to avoid false positives
- Written in ${languageName}

Examples of good queries:
- "I am a beginner in running, which shoes should I buy?"
- "I am building a marketplace, what payment platform should I use?"
- "What are the best tools I should use as a digital nomad?"
- "What's the most reliable web scraping tool in 2025?"

IMPORTANT ! 
1/ Make sure the queries lead to an answer where brands are mentioned
2/ Return the content in ${languageName} language.`;


    // Log the complete prompt being sent to the AI
    console.log('=== PROMPT SENT TO AI ===');
    console.log(prompt);
    console.log('=== END PROMPT ===');

    const startTime = Date.now();
    const response = await generateText({
      model,
      prompt,
      temperature: 0.7,
      maxTokens: 600,
    });
    const duration = Date.now() - startTime;

    // Extract tokens from usage
    const tokens = extractTokensFromUsage(response.usage);
    
    // Update API call with actual usage
    apiUsageTracker.updateCall(callId, {
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      cost: estimateCost(provider, provider === 'openai' ? 'gpt-4o' : provider === 'anthropic' ? 'claude-3-5-haiku-20241022' : 'gemini-1.5-flash', tokens.inputTokens, tokens.outputTokens),
      duration
    });

    // Parse the JSON response
    try {
      const cleanResponse = response.text.trim();
      console.log('AI response:', cleanResponse);
      
      // Remove any markdown formatting if present
      const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsedPrompts = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsedPrompts) && parsedPrompts.length > 0) {
          const filteredPrompts = parsedPrompts.filter(p => typeof p === 'string' && p.trim().length > 0);
          
          console.log('Generated prompts:', filteredPrompts);
          
          return NextResponse.json({
            success: true,
            prompts: filteredPrompts,
            provider,
            metadata: {
              targetBrand,
              companyInfo,
              competitors,
              totalPrompts: filteredPrompts.length
            }
          });
        }
      }
      
      throw new Error('Failed to parse AI response as JSON array');
      
    } catch (parseError) {
      console.error('Failed to parse AI-generated prompts:', parseError);
      console.error('Raw response:', response.text);
      
      return NextResponse.json(
        { 
          error: 'Failed to parse AI response',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
          rawResponse: response.text.substring(0, 200) // First 200 chars for debugging
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Error in generate-prompts API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
