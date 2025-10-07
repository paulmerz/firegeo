import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Autumn } from 'autumn-js';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { 
  AuthenticationError, 
  InsufficientCreditsError, 
  ValidationError, 
  ExternalServiceError,
  handleApiError 
} from '@/lib/api-errors';
import { 
  FEATURE_ID_CREDITS, 
  CREDITS_PER_MESSAGE,
  ERROR_MESSAGES,
  ROLE_USER,
  ROLE_ASSISTANT,
  UI_LIMITS
} from '@/config/constants';

const autumn = new Autumn({
  secretKey: process.env.AUTUMN_SECRET_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    // Get the session
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      throw new AuthenticationError('Please log in to use the chat');
    }

    const { message, conversationId } = await request.json();

    if (!message || typeof message !== 'string') {
      throw new ValidationError('Invalid message format', {
        message: 'Message must be a non-empty string'
      });
    }

    // Check if user has access to use the chat
    try {
      
      const access = await autumn.check({
        customer_id: sessionResponse.user.id,
        feature_id: FEATURE_ID_CREDITS,
      });
      
      if (!access.data?.allowed) {
        throw new InsufficientCreditsError(
          ERROR_MESSAGES.NO_CREDITS_REMAINING,
          CREDITS_PER_MESSAGE,
          access.data?.balance || 0 
        );
      }
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        throw err; // Re-throw our custom errors
      }
      throw new ExternalServiceError('Unable to verify credits. Please try again', 'autumn');
    }

    // Track API usage with Autumn
    try {
      await autumn.track({
        customer_id: sessionResponse.user.id,
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        feature_id: FEATURE_ID_MESSAGES,
=======
        feature_id: FEATURE_ID_CREDITS,
>>>>>>> Stashed changes
=======
        feature_id: FEATURE_ID_CREDITS,
>>>>>>> Stashed changes
        value: CREDITS_PER_MESSAGE,
      });
    } catch (err) {
      throw new ExternalServiceError('Unable to process credit usage. Please try again', 'autumn');
    }

    // Get or create conversation
    let currentConversation;
    
    if (conversationId) {
      // Find existing conversation
      const existingConversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, sessionResponse.user.id)
        ),
      });
      
      if (existingConversation) {
        currentConversation = existingConversation;
        // Update last message timestamp
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }
    }
    
    if (!currentConversation) {
      // Create new conversation
      const [newConversation] = await db
        .insert(conversations)
        .values({
          userId: sessionResponse.user.id,
          title: message.substring(0, UI_LIMITS.TITLE_MAX_LENGTH) + (message.length > UI_LIMITS.TITLE_MAX_LENGTH ? '...' : ''),
          lastMessageAt: new Date(),
        })
        .returning();
      
      currentConversation = newConversation;
    }

    // Store user message
    await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        userId: sessionResponse.user.id,
        role: ROLE_USER,
        content: message,
      })
      .returning();

    // Simple mock AI response
    const responses = [
      "I understand you're asking about " + message.substring(0, 20) + ". Here's what I think...",
      "That's an interesting question! Let me help you with that.",
      "Based on what you're saying, I can suggest the following approach...",
      "Thanks for your message! Here's my response to your query.",
      "I'm here to help! Regarding your question about " + message.substring(0, 15) + "...",
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // Store AI response
    const [aiMessage] = await db
      .insert(messages)
      .values({
        conversationId: currentConversation.id,
        userId: sessionResponse.user.id,
        role: ROLE_ASSISTANT,
        content: randomResponse,
        tokenCount: randomResponse.length, // Simple token count estimate
      })
      .returning();

    // Get remaining credits from Autumn
    let remainingCredits = 0;
    try {
      const usage = await autumn.check({
        customer_id: sessionResponse.user.id,
        feature_id: FEATURE_ID_CREDITS,
      });
      remainingCredits = usage.data?.balance || 0;
    } catch (err) {
      // Silently fail if we can't get remaining credits
    }

    return NextResponse.json({
      response: randomResponse,
      remainingCredits,
      creditsUsed: CREDITS_PER_MESSAGE,
      conversationId: currentConversation.id,
      messageId: aiMessage.id,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return handleApiError(error);
  }
}

// GET endpoint to fetch conversation history
export async function GET(request: NextRequest) {
  try {
    const sessionResponse = await auth.api.getSession({
      headers: request.headers,
    });

    if (!sessionResponse?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // Get specific conversation with messages
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, sessionResponse.user.id)
        ),
        with: {
          messages: {
            orderBy: [messages.createdAt],
          },
        },
      });

      if (!conversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      return NextResponse.json(conversation);
    } else {
      // Get all conversations for the user
      const userConversations = await db.query.conversations.findMany({
        where: eq(conversations.userId, sessionResponse.user.id),
        orderBy: [desc(conversations.lastMessageAt)],
        with: {
          messages: {
            limit: 1,
            orderBy: [desc(messages.createdAt)],
          },
        },
      });

      return NextResponse.json(userConversations);
    }
  } catch (error) {
    console.error('Chat GET error:', error);
    return handleApiError(error);
  }
}
