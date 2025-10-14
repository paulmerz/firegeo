import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getLocaleFromRequest } from '@/lib/locale-utils';
import { generateBrandQueryPrompts } from '@/lib/prompt-generation';

const GeneratePromptsSchema = z.object({
  targetBrand: z.string(),
  companyInfo: z.object({
    name: z.string(),
    industry: z.string().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
  }),
  competitors: z.array(z.string()).max(9),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetBrand, companyInfo, competitors } = GeneratePromptsSchema.parse(body);

    const locale = getLocaleFromRequest(request);

    const { prompts, provider } = await generateBrandQueryPrompts({
      targetBrand,
      companyInfo,
      competitors,
      locale,
    });

    logger.info(`[GeneratePromptsAPI] Generated ${prompts.length} prompts with ${provider}`);

    return NextResponse.json({
      success: true,
      prompts,
      provider,
      metadata: {
        targetBrand,
        companyInfo,
        competitors,
        totalPrompts: prompts.length,
      },
    });
  } catch (error) {
    logger.error('Error in generate-prompts API:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate prompts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
