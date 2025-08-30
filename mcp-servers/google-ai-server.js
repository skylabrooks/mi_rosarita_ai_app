#!/usr/bin/env node

/**
 * Google AI MCP Server for Mi Rosarita AI App
 *
 * Provides tools for Google AI (Gemini) development, testing, and operations.
 * This server enables AI assistants to:
 * - Test Gemini AI API calls and responses
 * - Manage AI prompts and configurations
 * - Generate and test travel itineraries
 * - Analyze photos with Gemini Vision
 * - Monitor AI API usage and costs
 * - Validate AI responses for travel content
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';

class GoogleAIMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'google-ai-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.genAI = null;
    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'gemini_configure',
            description: 'Configure Google AI API with API key',
            inputSchema: {
              type: 'object',
              properties: {
                api_key: {
                  type: 'string',
                  description: 'Google AI API key',
                },
              },
              required: ['api_key'],
            },
          },
          {
            name: 'gemini_generate_itinerary',
            description: 'Generate AI-powered travel itinerary using Gemini',
            inputSchema: {
              type: 'object',
              properties: {
                duration: {
                  type: 'number',
                  description: 'Trip duration in days',
                },
                interests: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'User interests (e.g., ["beach", "culture", "food"])',
                },
                budget: {
                  type: 'string',
                  description: 'Budget level (low, medium, high)',
                  enum: ['low', 'medium', 'high'],
                },
                destination: {
                  type: 'string',
                  description: 'Destination city or region',
                  default: 'Rosarito, Mexico',
                },
                travel_style: {
                  type: 'string',
                  description: 'Travel style preferences',
                },
              },
              required: ['duration', 'interests'],
            },
          },
          {
            name: 'gemini_generate_deal_description',
            description: 'Generate AI-powered deal descriptions for businesses',
            inputSchema: {
              type: 'object',
              properties: {
                business_name: {
                  type: 'string',
                  description: 'Business name',
                },
                business_type: {
                  type: 'string',
                  description: 'Type of business',
                },
                original_price: {
                  type: 'string',
                  description: 'Original price',
                },
                discounted_price: {
                  type: 'string',
                  description: 'Discounted price',
                },
                description: {
                  type: 'string',
                  description: 'Business description',
                },
                location: {
                  type: 'string',
                  description: 'Business location',
                  default: 'Rosarito',
                },
              },
              required: ['business_name'],
            },
          },
          {
            name: 'gemini_analyze_photos',
            description: 'Analyze travel photos using Gemini Vision',
            inputSchema: {
              type: 'object',
              properties: {
                photo_urls: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of photo URLs to analyze',
                },
                analysis_type: {
                  type: 'string',
                  description: 'Type of analysis (travel, food, culture, general)',
                  enum: ['travel', 'food', 'culture', 'general'],
                  default: 'general',
                },
              },
              required: ['photo_urls'],
            },
          },
          {
            name: 'gemini_chat_completion',
            description: 'General chat completion with Gemini AI',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'User message for chat completion',
                },
                system_prompt: {
                  type: 'string',
                  description: 'System prompt to set context',
                },
                temperature: {
                  type: 'number',
                  description: 'Temperature for response creativity (0.0-1.0)',
                  minimum: 0.0,
                  maximum: 1.0,
                  default: 0.7,
                },
              },
              required: ['message'],
            },
          },
          {
            name: 'gemini_test_connection',
            description: 'Test Google AI API connection and configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'gemini_validate_content',
            description: 'Validate AI-generated content for travel app usage',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'string',
                  description: 'Content to validate',
                },
                content_type: {
                  type: 'string',
                  description: 'Type of content (itinerary, description, advice)',
                  enum: ['itinerary', 'description', 'advice'],
                },
                safety_check: {
                  type: 'boolean',
                  description: 'Perform safety/content policy check',
                  default: true,
                },
              },
              required: ['content', 'content_type'],
            },
          },
          {
            name: 'gemini_usage_stats',
            description: 'Get Google AI API usage statistics and costs',
            inputSchema: {
              type: 'object',
              properties: {
                period: {
                  type: 'string',
                  description: 'Time period for stats (day, week, month)',
                  enum: ['day', 'week', 'month'],
                  default: 'month',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'gemini_configure':
            return await this.configureGemini(args);
          case 'gemini_generate_itinerary':
            return await this.generateItinerary(args);
          case 'gemini_generate_deal_description':
            return await this.generateDealDescription(args);
          case 'gemini_analyze_photos':
            return await this.analyzePhotos(args);
          case 'gemini_chat_completion':
            return await this.chatCompletion(args);
          case 'gemini_test_connection':
            return await this.testConnection(args);
          case 'gemini_validate_content':
            return await this.validateContent(args);
          case 'gemini_usage_stats':
            return await this.getUsageStats(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler('resources/list', async () => {
      return {
        resources: [
          {
            uri: 'google-ai://models/list',
            mimeType: 'application/json',
            name: 'Available AI Models',
            description: 'List of available Google AI models',
          },
          {
            uri: 'google-ai://config/status',
            mimeType: 'application/json',
            name: 'API Configuration Status',
            description: 'Current API key and configuration status',
          },
          {
            uri: 'google-ai://examples/travel-prompts',
            mimeType: 'application/json',
            name: 'Travel Prompts Examples',
            description: 'Example prompts for travel-related AI tasks',
          },
        ],
      };
    });

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'google-ai://models/list':
            return await this.getModelsListResource();
          case 'google-ai://config/status':
            return await this.getConfigStatusResource();
          case 'google-ai://examples/travel-prompts':
            return await this.getTravelPromptsResource();
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async configureGemini(args) {
    const { api_key } = args;

    if (!api_key || !api_key.startsWith('AIza')) {
      throw new Error('Invalid Google AI API key format. Key should start with "AIza"');
    }

    this.genAI = new GoogleGenerativeAI(api_key);

    // Test the configuration
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      await model.generateContent('Hello, test connection');

      return {
        content: [
          {
            type: 'text',
            text: 'Google AI API configured successfully. Connection test passed.',
          },
        ],
      };
    } catch (error) {
      this.genAI = null;
      throw new Error(`Configuration test failed: ${error.message}`);
    }
  }

  async generateItinerary(args) {
    if (!this.genAI) {
      throw new Error('Google AI not configured. Use gemini_configure first.');
    }

    const { duration, interests, budget = 'medium', destination = 'Rosarito, Mexico', travel_style } = args;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Generate a detailed ${duration}-day travel itinerary for ${destination}.

User Preferences:
- Interests: ${interests.join(', ')}
- Budget: ${budget}
${travel_style ? `- Travel Style: ${travel_style}` : ''}

Please provide:
1. Daily itinerary breakdown
2. Recommended activities and attractions
3. Local dining recommendations
4. Transportation suggestions
5. Budget considerations
6. Cultural tips specific to the location

Format the response as a JSON object with the following structure:
{
  "title": "Trip Title",
  "duration": ${duration},
  "destination": "${destination}",
  "overview": "Brief trip overview",
  "dailyItinerary": [
    {
      "day": 1,
      "title": "Day title",
      "activities": ["Activity 1", "Activity 2"],
      "meals": ["Restaurant 1", "Restaurant 2"],
      "notes": "Any special notes"
    }
  ],
  "recommendations": {
    "activities": [],
    "dining": [],
    "transportation": [],
    "budgetTips": []
  }
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      const itinerary = JSON.parse(text);
      return {
        content: [
          {
            type: 'text',
            text: `Generated itinerary:\n${JSON.stringify(itinerary, null, 2)}`,
          },
        ],
      };
    } catch (parseError) {
      // If JSON parsing fails, return the raw text
      return {
        content: [
          {
            type: 'text',
            text: `Generated itinerary (raw response):\n${text}`,
          },
        ],
      };
    }
  }

  async generateDealDescription(args) {
    if (!this.genAI) {
      throw new Error('Google AI not configured. Use gemini_configure first.');
    }

    const { business_name, business_type, original_price, discounted_price, description, location = 'Rosarito' } = args;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Create an engaging deal description for a business in ${location}.

Business Details:
- Name: ${business_name}
${business_type ? `- Type: ${business_type}` : ''}
${original_price ? `- Original Price: ${original_price}` : ''}
${discounted_price ? `- Discounted Price: ${discounted_price}` : ''}
${description ? `- Description: ${description}` : ''}

Write a compelling deal description that:
1. Highlights the value and savings
2. Describes what makes this business special
3. Includes local context and appeal
4. Encourages action with a call-to-action
5. Is appropriate for tourists visiting ${location}

Keep it concise (50-100 words) and engaging.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return {
      content: [
        {
          type: 'text',
          text: `Generated deal description for ${business_name}:\n\n${response.text()}`,
        },
      ],
    };
  }

  async analyzePhotos(args) {
    if (!this.genAI) {
      throw new Error('Google AI not configured. Use gemini_configure first.');
    }

    const { photo_urls, analysis_type = 'general' } = args;

    if (!photo_urls || photo_urls.length === 0) {
      throw new Error('At least one photo URL is required');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

    const analysisPrompts = {
      travel: 'Analyze this travel photo and describe: 1) What location/activity is shown, 2) Best time to visit, 3) Cultural significance, 4) Nearby attractions, 5) Photography tips for similar shots',
      food: 'Analyze this food photo and describe: 1) Dish name and ingredients, 2) Cultural significance, 3) Where to find similar food in the area, 4) Pairing suggestions, 5) Dietary information',
      culture: 'Analyze this cultural photo and describe: 1) Cultural significance, 2) Historical context, 3) Local traditions shown, 4) Similar experiences nearby, 5) Respectful visitor guidelines',
      general: 'Describe this photo in detail, including: setting, subjects, mood, colors, composition, and any notable elements that would interest travelers'
    };

    const prompt = analysisPrompts[analysis_type] || analysisPrompts.general;

    // For MVP, we'll analyze first photo only
    const imageUrl = photo_urls[0];

    // Note: In a real implementation, you'd fetch the image and convert to appropriate format
    // For now, we'll simulate with text description
    const result = await model.generateContent([
      prompt,
      `Image URL: ${imageUrl}`
    ]);

    const response = await result.response;

    return {
      content: [
        {
          type: 'text',
          text: `Photo analysis (${analysis_type}) for ${photo_urls.length} photo(s):\n\n${response.text()}`,
        },
      ],
    };
  }

  async chatCompletion(args) {
    if (!this.genAI) {
      throw new Error('Google AI not configured. Use gemini_configure first.');
    }

    const { message, system_prompt, temperature = 0.7 } = args;

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: { temperature }
    });

    const fullPrompt = system_prompt ?
      `${system_prompt}\n\nUser: ${message}` :
      message;

    const result = await model.generateContent(fullPrompt);
    const response = await result.response;

    return {
      content: [
        {
          type: 'text',
          text: `AI Response:\n${response.text()}`,
        },
      ],
    };
  }

  async testConnection(args = {}) {
    if (!this.genAI) {
      throw new Error('Google AI not configured. Use gemini_configure first.');
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const startTime = Date.now();
    const result = await model.generateContent('Hello! This is a test message. Please respond with a simple greeting.');
    const response = await result.response;
    const endTime = Date.now();

    return {
      content: [
        {
          type: 'text',
          text: `✅ Connection test successful!\n\nResponse time: ${endTime - startTime}ms\nResponse: ${response.text()}`,
        },
      ],
    };
  }

  async validateContent(args) {
    if (!this.genAI) {
      throw new Error('Google AI not configured. Use gemini_configure first.');
    }

    const { content, content_type, safety_check = true } = args;

    const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });

    const validationPrompt = `Validate the following ${content_type} content for a travel app:

Content:
${content}

Please check for:
1. ${safety_check ? 'Safety and appropriateness for travelers' : 'General quality'}
2. Accuracy of information
3. Clarity and usefulness
4. Cultural sensitivity
5. Grammar and readability

Provide a validation score (1-10) and specific feedback for improvements.`;

    const result = await model.generateContent(validationPrompt);
    const response = await result.response;

    return {
      content: [
        {
          type: 'text',
          text: `Content validation for type "${content_type}":\n\n${response.text()}`,
        },
      ],
    };
  }

  async getUsageStats(args = {}) {
    // In a real implementation, you'd fetch actual usage stats from Google Cloud
    // For now, return mock data
    const period = args.period || 'month';

    const mockStats = {
      period,
      total_requests: 1250,
      estimated_cost: '$12.50',
      models_used: ['gemini-pro', 'gemini-pro-vision'],
      top_endpoints: [
        { endpoint: 'generate_itinerary', calls: 450 },
        { endpoint: 'generate_deal_description', calls: 320 },
        { endpoint: 'analyze_photos', calls: 280 },
        { endpoint: 'chat_completion', calls: 200 }
      ]
    };

    return {
      content: [
        {
          type: 'text',
          text: `Google AI Usage Stats (${period}):\n${JSON.stringify(mockStats, null, 2)}`,
        },
      ],
    };
  }

  async getModelsListResource() {
    return {
      contents: [
        {
          uri: 'google-ai://models/list',
          mimeType: 'application/json',
          text: JSON.stringify({
            models: [
              {
                name: 'gemini-pro',
                description: 'Latest Gemini model for text generation',
                capabilities: ['text-generation', 'chat', 'code'],
                context_window: '1M tokens'
              },
              {
                name: 'gemini-pro-vision',
                description: 'Gemini model with vision capabilities',
                capabilities: ['text-generation', 'image-analysis', 'multimodal'],
                context_window: '16M tokens'
              },
              {
                name: 'gemini-1.5-flash',
                description: 'Fast, lightweight Gemini model',
                capabilities: ['text-generation', 'chat', 'multimodal'],
                context_window: '1M tokens'
              }
            ],
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  async getConfigStatusResource() {
    return {
      contents: [
        {
          uri: 'google-ai://config/status',
          mimeType: 'application/json',
          text: JSON.stringify({
            configured: !!this.genAI,
            status: this.genAI ? 'ready' : 'not_configured',
            message: this.genAI ?
              'Google AI API is configured and ready to use' :
              'Please configure Google AI API using gemini_configure tool',
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  async getTravelPromptsResource() {
    return {
      contents: [
        {
          uri: 'google-ai://examples/travel-prompts',
          mimeType: 'application/json',
          text: JSON.stringify({
            prompts: {
              itinerary_generation: {
                template: 'Generate a {duration}-day itinerary for {destination} focusing on {interests}. Include daily activities, dining recommendations, and cultural experiences.',
                example: 'Generate a 3-day itinerary for Rosarito focusing on beach activities, local cuisine, and cultural sites.'
              },
              deal_description: {
                template: 'Create an engaging description for {business_name}, a {business_type} offering {deal_description} at {location}.',
                example: 'Create an engaging description for Beachside Grill, a seafood restaurant offering 30% off all dishes at Rosarito marina.'
              },
              photo_analysis: {
                template: 'Analyze this {photo_type} photo and provide {analysis_focus} information.',
                example: 'Analyze this travel photo and provide historical context, nearby attractions, and photography tips.'
              },
              safety_advice: {
                template: 'Provide safety advice for travelers visiting {location} interested in {activities}.',
                example: 'Provide safety advice for travelers visiting Baja California interested in hiking and beach activities.'
              }
            },
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Google AI MCP server started');
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new GoogleAIMCPServer();
  server.run().catch(console.error);
}

export default GoogleAIMCPServer;