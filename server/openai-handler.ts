import OpenAI from 'openai';

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
  private conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;

  constructor() {
    this.systemPrompt = `You are an advanced scheduling assistant for medical professionals with direct access to the ICU scheduling system.
    You have access to and should actively use:
    - Current shift schedule and upcoming shifts with provider assignments
    - Staff information and availability
    - Historical scheduling patterns
    - Staff preferences and past behavior patterns
    - Workload distribution history
    - Shift swap patterns
    - Consecutive shift patterns

    You should:
    - When asked about "current and upcoming shifts", ONLY show:
      * "Ongoing shifts" (shifts that include today's date)
      * "Upcoming shifts" (shifts that start after today)
      DO NOT include past shifts or completed shifts in this response
    - When explicitly asked about recent history, you may include:
      * "Recent shifts" (completed within the last week)
    - Always sort shifts by start date within each category
    - Provide specific information about assigned providers
    - Learn from historical scheduling patterns
    - Identify optimal shift arrangements based on past success
    - Consider staff preferences and past behavior
    - Detect potential scheduling conflicts
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
      // Verify API key is present
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not found');
      }

      // Get current date at start of day for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calculate date range for recent shifts (last 7 days)
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      console.log('Date references:', {
        today: today.toISOString(),
        lastWeek: lastWeek.toISOString(),
      });

      // Format and categorize shifts
      const categorizedShifts = context?.shifts
        ?.map(shift => {
          const startDate = new Date(shift.startDate);
          const endDate = new Date(shift.endDate);
          const provider = shift.userId ? 
            context.users?.find(u => u.id === shift.userId)?.name || 'Unknown Provider' : 
            'Unassigned';

          // A shift is current if it spans today
          const isCurrentShift = startDate <= today && endDate >= today;
          // A shift is upcoming if it starts after today
          const isUpcomingShift = startDate > today;
          // A shift is recent if it ended within the last week
          const isRecentShift = endDate < today && endDate >= lastWeek;

          console.log('Shift categorization:', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            provider,
            isCurrentShift,
            isUpcomingShift,
            isRecentShift
          });

          return {
            startDate: startDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric'
            }),
            endDate: endDate.toLocaleDateString('en-US', {
              month: 'short', 
              day: 'numeric', 
              year: 'numeric'
            }),
            provider,
            status: shift.status,
            category: isCurrentShift ? 'current' : 
                     isUpcomingShift ? 'upcoming' : 
                     isRecentShift ? 'recent' : 'past'
          };
        })
        ?.filter(shift => shift.category !== 'past') // Remove old shifts
        ?.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      const currentShifts = categorizedShifts?.filter(s => s.category === 'current') || [];
      const upcomingShifts = categorizedShifts?.filter(s => s.category === 'upcoming') || [];
      const recentShifts = categorizedShifts?.filter(s => s.category === 'recent') || [];

      console.log('Categorized shifts:', {
        current: currentShifts.length,
        upcoming: upcomingShifts.length,
        recent: recentShifts.length
      });

      // Prepare current context information
      const currentContextInfo = `
Today's date: ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}

Current Schedule Information:
${currentShifts.length > 0 ? `- Ongoing Shifts (${currentShifts.length}): ${JSON.stringify(currentShifts, null, 2)}` : '- No ongoing shifts'}
${upcomingShifts.length > 0 ? `- Upcoming Shifts (${upcomingShifts.length}): ${JSON.stringify(upcomingShifts, null, 2)}` : '- No upcoming shifts'}
${recentShifts.length > 0 ? `- Recent Shifts (${recentShifts.length}): ${JSON.stringify(recentShifts, null, 2)}` : '- No recent shifts'}

Additional Context:
- Current page: ${context?.currentPage}
- Number of users: ${context?.users?.length || 0}
- Active providers: ${context?.users?.map(u => u.name).join(', ') || 'None'}`;

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

      // Add context information to the conversation
      const contextMessage = {
        role: 'system' as const,
        content: `${currentContextInfo}\n\n${historicalInsights}`
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

      if (response && response.content !== null) {
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        });
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