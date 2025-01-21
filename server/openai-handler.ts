import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ChatContext {
  shifts: any[];
  users: any[];
  currentPage: string;
}

export class OpenAIChatHandler {
  private systemPrompt: string;
  private conversationHistory: ChatCompletionMessageParam[];

  constructor() {
    this.systemPrompt = `You are a scheduling assistant helping medical professionals manage their shifts and schedules.
    You have access to the following information:
    - User schedules and shifts
    - Staff information including roles (Physician/APP)
    - Current page context

    Please help users with:
    - Scheduling inquiries
    - Shift management
    - Time-off requests
    - Schedule conflicts
    - Staff availability`;

    this.conversationHistory = [{
      role: 'system',
      content: this.systemPrompt
    }];
  }

  async handleChat(userMessage: string, context: ChatContext) {
    try {
      // Handle time-related queries directly
      const timeRegex = /what (time|day|date) is it/i;
      if (timeRegex.test(userMessage)) {
        const now = new Date();
        const format = userMessage.toLowerCase().includes('time') ? 
          now.toLocaleTimeString() :
          now.toLocaleDateString();
        return `It is currently ${format}`;
      }

      // Add context to the message
      const contextMessage = {
        role: 'system' as const,
        content: `Current context: ${JSON.stringify(context)}`
      };

      const userMsg = {
        role: 'user' as const,
        content: userMessage
      };

      // Maintain conversation history
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
          name: "get_schedule_conflicts",
          description: "Get conflicts in the current schedule",
          parameters: {
            type: "object",
            properties: {
              startDate: { type: "string", description: "Start date of the period to check" },
              endDate: { type: "string", description: "End date of the period to check" }
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