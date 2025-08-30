import {GoogleGenerativeAI} from "@google/generative-ai";
import {logger, config} from "firebase-functions";

export interface UserPreferences {
  duration: number; // in days
  budget: "low" | "medium" | "high";
  interests: string[];
  groupSize: number;
  language: "en" | "es";
  dietaryRestrictions?: string[];
  accommodationType?: string;
  transportationMode?: string;
}

export interface ItineraryItem {
  id: string;
  title: string;
  description: string;
  location: string;
  time: string;
  duration: string;
  cost?: number;
  category: "food" | "activity" | "transport" | "accommodation" | "shopping";
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Itinerary {
  id: string;
  title: string;
  date: string;
  duration: number;
  items: ItineraryItem[];
  totalCost?: number;
  createdAt: string;
  updatedAt: string;
  weather?: {
    temperature: number;
    condition: string;
    recommendation: string;
  };
}

/**
 * Service for interacting with Google's Gemini AI API
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  /**
   * Creates an instance of GeminiService
   */
  constructor() {
    const apiKey = config().gemini.key;
    if (!apiKey) {
      throw new Error("Gemini API key not configured in Firebase functions.");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Returns the generative model.
   * @param model The model to use.
   * @returns The generative model.
   */
  getGenerativeModel(model: string) {
    return this.genAI.getGenerativeModel({model});
  }

  /**
   * Generates a personalized itinerary using Gemini AI
   * @param userPreferences The user's travel preferences and requirements
   * @return A structured itinerary object
   */
  async generateItinerary(
    userPreferences: UserPreferences
  ): Promise<Itinerary> {
    try {
      const prompt = this.buildItineraryPrompt(userPreferences);

      logger.info("Generating itinerary with preferences:", userPreferences);

      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error("No response from Gemini API");
      }

      // For now, we'll parse JSON from the text response
      // TODO: Implement proper structured output when schema is supported
      let itineraryData;
      try {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        itineraryData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
      } catch (parseError) {
        logger.warn(
          "Failed to parse JSON response, using fallback",
          parseError
        );
        itineraryData = {
          title: `Rosarito Adventure - ${userPreferences.duration} Days`,
          date: new Date().toISOString().split("T")[0],
          duration: userPreferences.duration,
          items: [],
        };
      }
      return this.processItineraryResponse(itineraryData, userPreferences);
    } catch (error) {
      logger.error("Error generating itinerary:", error);
      throw new Error(
        `Failed to generate itinerary: ${(error as Error).message}`
      );
    }
  }

  /**
   * Generates an attractive description for a business deal using AI
   * @param businessInfo Information about the business and deal
   * @return A compelling deal description
   */
  async generateDealDescription(businessInfo: {
    businessName: string;
    type?: string;
    originalPrice?: string;
    discountedPrice?: string;
    description?: string;
  }): Promise<string> {
    try {
      const prompt = `
      Create an attractive, compelling description for this business deal in Rosarito:

Business: ${businessInfo.businessName}
Type: ${businessInfo.type || "General"}
Original Price: ${businessInfo.originalPrice || "N/A"}
Discounted Price: ${businessInfo.discountedPrice || "N/A"}
Description: ${businessInfo.description || "No description available"}

      Write a persuasive, engaging description that highlights the value and creates urgency.
Keep it under 100 words.`;

      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 200,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text() || "Limited time offer available!";
    } catch (error) {
      logger.error("Error generating deal description:", error);
      return businessInfo.description || "Special offer available!";
    }
  }

  /**
   * Analyzes user photos using AI to provide trip insights
   * @param photos Array of photo URLs to analyze
   * @return Array of analysis strings about the trip
   */
  async analyzeUserPhotos(photos: string[]): Promise<string[]> {
    try {
      const prompt = `
      Analyze these vacation photos and provide insights about the user's trip.
For each photo, identify:
- Location/activity shown
- Mood/emotion captured
- Key highlights
- Suggestions for similar experiences

Photos: ${photos.join(", ")}

Provide a comprehensive summary of the trip based on the photos.`;

      const model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1000,
        },
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return text ? text.split("\n").filter((line) => line.trim()) : [];
    } catch (error) {
      logger.error("Error analyzing photos:", error);
      return ["Unable to analyze photos at this time"];
    }
  }

  /**
   * Builds a prompt for the Gemini AI to generate an itinerary
   * @param preferences User preferences for the itinerary
   * @return Formatted prompt string for the AI
   */
  private buildItineraryPrompt(preferences: UserPreferences): string {
    const {
      duration,
      budget,
      interests,
      groupSize,
      language,
      dietaryRestrictions,
    } = preferences;

    return `
    Create a personalized ${duration}-day itinerary for a trip to Rosarito, Mexico.

TRAVELER PROFILE:
- Group size: ${groupSize} people
- Budget level: ${budget}
- Interests: ${interests.join(", ")}
- Language: ${language === "es" ? "Spanish" : "English"}
    ${
  dietaryRestrictions ?
    `- Dietary restrictions: ${dietaryRestrictions.join(", ")}` :
    ""
}

REQUIREMENTS:
1. Focus on authentic Rosarito experiences
2. Include a mix of activities, dining, and relaxation
3. Consider group size for activity selection
4. Provide realistic timeframes and costs
5. Include local transportation options
6. Highlight unique Rosarito attractions like Puerto Nuevo lobster,
    Valle de Guadalupe, ATV tours, and beach activities

FORMAT: Return a JSON object with the complete itinerary structure including
      daily activities, timing, locations, estimated costs, and transportation details.

KEY ROSARITO HIGHLIGHTS TO INCLUDE:
- Puerto Nuevo lobster restaurants
- Valle de Guadalupe wine tasting
- ATV and off-road adventures
- Beach activities and surfing
- Local artisan markets
- Cultural experiences
- Seafood dining options
- Scenic viewpoints and nature spots

      Ensure the itinerary is balanced, engaging, and tailored to the group's preferences.
    `;
  }


  /**
   * Processes the AI response and formats it into a structured itinerary
   * @param data Raw response data from the AI
   * @param preferences User preferences used for the itinerary
   * @return Structured itinerary object
   */
  private processItineraryResponse(
    data: {
      title?: string;
      date?: string;
      items?: unknown[];
      totalCost?: number;
      weather?: {
        temperature: number;
        condition: string;
        recommendation: string;
      };
    },
    preferences: UserPreferences
  ): Itinerary {
    const now = new Date();
    const itinerary: Itinerary = {
      id: `itinerary_${Date.now()}`,
      title: data.title || `Rosarito Adventure - ${preferences.duration} Days`,
      date: data.date || now.toISOString().split("T")[0],
      duration: preferences.duration,
      items: [],
      totalCost: data.totalCost,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      weather: data.weather,
    };

    // Ensure each item has required fields
    itinerary.items = (data.items || []).map((item: unknown, index: number) => {
      const typedItem = item as Partial<ItineraryItem>;
      return {
        id: typedItem.id || `item_${index}`,
        title: typedItem.title || "Activity",
        description: typedItem.description || "",
        location: typedItem.location || "Rosarito",
        time: typedItem.time || "TBD",
        duration: typedItem.duration || "2 hours",
        cost: typedItem.cost,
        category: typedItem.category || "activity",
        coordinates: typedItem.coordinates,
      };
    });

    return itinerary;
  }
}
