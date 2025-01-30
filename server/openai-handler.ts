import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ChatContext {
  shifts: any[];
  users: any[];
  currentPage: string;
  historicalPatterns?: {
    preferredShifts: any[];
    previousSwaps: any[];
    workloadHistory: any[];
    consecutiveShiftPatterns: any[];
  };
}

export class OpenAIChatHandler {
  private systemPrompt: string;
  private conversationHistory: ChatCompletionMessageParam[];

  constructor() {
    this.systemPrompt = `You are an advanced scheduling assistant for medical professionals that learns from historical patterns.
    You have access to:
    - Current and historical schedules
    - Staff preferences and past behavior patterns
    - Workload distribution history
    - Shift swap patterns
    - Consecutive shift patterns

    You should:
    - Learn from historical scheduling patterns
    - Identify optimal shift arrangements based on past success
    - Consider staff preferences and past behavior
    - Detect potential scheduling conflicts before they occur
    - Suggest improvements based on historical data
    - Provide data-driven recommendations

    Always consider:
    - Individual provider preferences
    - Historical workload balance
    - Past conflict patterns
    - Successful shift combinations
    - Staff satisfaction indicators`;

    this.conversationHistory = [{
      role: 'system',
      content: this.systemPrompt
    }];
  }

  async handleChat(userMessage: string, context: ChatContext) {
    try {
      // Sanitize context before logging
      const sanitizedContext = {
        shifts: context?.shifts?.map(shift => ({
          id: shift.id,
          startDate: shift.startDate,
          endDate: shift.endDate,
          status: shift.status
        })) || [],
        users: context?.users?.map(user => ({
          id: user.id,
          name: user.name,
          title: user.title,
          userType: user.userType
        })) || [],
        currentPage: context?.currentPage,
        historicalPatterns: context?.historicalPatterns
      };

      console.log('Processing chat with context:', sanitizedContext);

      if (!context || (!context.shifts && !context.users)) {
        console.warn('Missing context data');
        return 'I apologize, but I cannot access the schedule information at the moment.';
      }

      // Add historical pattern analysis
      let historicalInsights = '';
      if (context.historicalPatterns) {
        const { preferredShifts, previousSwaps, workloadHistory, consecutiveShiftPatterns } = context.historicalPatterns;

        historicalInsights = `Based on historical data:
        - Common preferred shifts: ${JSON.stringify(preferredShifts)}
        - Previous swap patterns: ${JSON.stringify(previousSwaps)}
        - Workload distribution: ${JSON.stringify(workloadHistory)}
        - Consecutive shift trends: ${JSON.stringify(consecutiveShiftPatterns)}`;
      }

      // Handle time-related queries directly
      const timeRegex = /what (?:is )?(?:the )?(?:current )?(time|day|date)(?: and (time|day|date))?/i;
      if (timeRegex.test(userMessage)) {
        const now = new Date();
        const options = {
          timeZone: 'America/Chicago',
          hour12: true
        };

        if (userMessage.toLowerCase().includes('date') && userMessage.toLowerCase().includes('time')) {
          const date = now.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
          const time = now.toLocaleTimeString('en-US', options);
          return `It is ${date} at ${time} Central Time`;
        }

        const format = userMessage.toLowerCase().includes('time') ? 
          now.toLocaleTimeString('en-US', options) :
          now.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
        return `It is currently ${format} Central Time`;
      }

      // Add context and historical insights to the message
      const contextStr = JSON.stringify({ ...context, historicalInsights }) || '{}';
      const contextMessage = {
        role: 'system' as const,
        content: `Current context: ${contextStr}\n\nHistorical Insights: ${historicalInsights}`
      };

      // Validate user message
      if (typeof userMessage !== 'string' || !userMessage.trim()) {
        console.error('Invalid message format:', userMessage);
        return 'I apologize, but I received an empty or invalid message.';
      }

      const userMsg = {
        role: 'user' as const,
        content: userMessage
      };

      // Clean conversation history of any null contents
      this.conversationHistory = this.conversationHistory.filter(msg => msg.content != null);

      // Add new messages
      this.conversationHistory.push(contextMessage, userMsg);

      // Limit history to last 10 messages to prevent token overflow
      const recentHistory = this.conversationHistory.slice(-10);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: recentHistory,
        temperature: 0.7,
        max_tokens: 500,
        stream: false,
        functions: [{
          name: "analyze_historical_patterns",
          description: "Analyze historical scheduling patterns and provide insights",
          parameters: {
            type: "object",
            properties: {
              timeRange: { 
                type: "string",
                description: "Time range for pattern analysis (e.g., '3months', '6months', '1year')"
              },
              patternTypes: {
                type: "array",
                items: { type: "string" },
                description: "Types of patterns to analyze (e.g., 'shifts', 'swaps', 'conflicts')"
              }
            }
          }
        }]
      });

      const response = completion.choices[0].message;

      if (response) {
        this.conversationHistory.push(response);
        return response.content;
      }

      return 'I apologize, but I was unable to process your request.';

    } catch (error) {
      console.error('OpenAI Chat Error:', error);
      return 'I encountered an error processing your request.';
    }
  }

  resetConversation() {
    this.conversationHistory = [{
      role: 'system',
      content: this.systemPrompt
    }];
  }
}