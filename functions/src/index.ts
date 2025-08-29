import {setGlobalOptions} from "firebase-functions";
import {onRequest, onCall} from "firebase-functions/https";
import {onDocumentCreated} from "firebase-functions/firestore";
import * as logger from "firebase-functions/logger";
import cors from "cors";
import {initializeApp, getApps, cert} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore} from "firebase-admin/firestore";
import {GeminiService, UserPreferences} from "./services/geminiService";
import {
  AmadeusService,
  FlightSearchParams,
  HotelSearchParams,
} from "./services/amadeusService";

// Initialize services with secure validation
const geminiService = new GeminiService(
  process.env.GOOGLE_AI_API_KEY || (() => {
    logger.error("GOOGLE_AI_API_KEY environment variable is not set");
    throw new Error("GOOGLE_AI_API_KEY environment variable is required for Gemini service");
  })()
);

// Amadeus service with secure validation
const amadeusApiKey = process.env.AMADEUS_API_KEY;
const amadeusApiSecret = process.env.AMADEUS_API_SECRET;

if (!amadeusApiKey || !amadeusApiSecret) {
  logger.error("Amadeus API credentials are not properly configured", {
    hasApiKey: !!amadeusApiKey,
    hasApiSecret: !!amadeusApiSecret
  });
  throw new Error("AMADUES_API_KEY and AMADEUS_API_SECRET environment variables are required for Amadeus service");
}

const amadeusService = new AmadeusService(amadeusApiKey, amadeusApiSecret);

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp();
}

const adminAuth = getAuth();
const adminDB = getFirestore();

// Configure CORS
const corsHandler = cors({origin: true});

// Authentication middleware for callable functions
const withAuth = (handler: (req: any, userId: string) => Promise<any>) => {
  return async (request: any) => {
    try {
      if (!request.auth) {
        throw new Error('User must be authenticated');
      }

      const userId = request.auth.uid;

      // Verify the user still exists
      await adminAuth.getUser(userId);

      return await handler(request, userId);
    } catch (error: any) {
      logger.error('Authentication middleware error:', error);

      if (error.code === 'auth/user-not-found') {
        throw new Error('User account no longer exists');
      }

      throw error;
    }
  };
};

setGlobalOptions({
  maxInstances: 10,
  region: "us-central1",
});

/**
 * Generate AI-powered itinerary for users
 */
export const generateItinerary = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  withAuth(async (request, userId) => {
    try {
      const preferences: UserPreferences = request.data;

      if (!preferences || !preferences.duration || !preferences.interests) {
        throw new Error("Invalid preferences provided");
      }

      logger.info("Generating itinerary for user", {userId, preferences});

      // Generate itinerary using user's preferences context
      const itinerary = await geminiService.generateItinerary(preferences);

      // Store generated itinerary in Firestore for the user
      const userItineraryRef = adminDB.collection('users').doc(userId).collection('itineraries').doc();
      await userItineraryRef.set({
        ...itinerary,
        userId,
        createdAt: new Date(),
        preferences
      });

      return {
        success: true,
        itinerary: {
          ...itinerary,
          id: userItineraryRef.id
        },
      };
    } catch (error) {
      logger.error("Error generating itinerary:", error);
      throw new Error(
        `Failed to generate itinerary: ${(error as Error).message}`
      );
    }
  })
);

/**
 * Generate deal descriptions using AI
 */
export const generateDealDescription = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const businessInfo = request.data;

      if (!businessInfo || !businessInfo.name) {
        throw new Error("Invalid business information provided");
      }

      logger.info("Generating deal description for business", {
        businessName: businessInfo.name,
      });

      const description = await geminiService.generateDealDescription(businessInfo);

      return {
        success: true,
        description,
      };
    } catch (error) {
      logger.error("Error generating deal description:", error);
      throw new Error(
        `Failed to generate deal description: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Analyze user photos for memory maker feature
 */
export const analyzePhotos = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  async (request) => {
    try {
      const {photoUrls} = request.data;

      if (!photoUrls || !Array.isArray(photoUrls)) {
        throw new Error("Invalid photo URLs provided");
      }

      logger.info("Analyzing photos for user", {photoCount: photoUrls.length});

      const analysis = await geminiService.analyzeUserPhotos(photoUrls);

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      logger.error("Error analyzing photos:", error);
      throw new Error(
        `Failed to analyze photos: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Search for flight offers using Amadeus API
 */
export const searchFlights = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const params: FlightSearchParams = request.data;

      if (!params.originLocationCode || !params.destinationLocationCode ||
          !params.departureDate || !params.adults) {
        throw new Error("Missing required flight search parameters");
      }

      logger.info("Searching flights", {params});

      const flights = await amadeusService.searchFlights(params);

      return {
        success: true,
        flights,
        count: flights.length,
      };
    } catch (error) {
      logger.error("Error searching flights:", error);
      throw new Error(
        `Failed to search flights: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Search for hotel offers using Amadeus API
 */
export const searchHotels = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  async (request) => {
    try {
      const params: HotelSearchParams = request.data;

      if (!params.cityCode || !params.checkInDate || !params.checkOutDate ||
          !params.adults) {
        throw new Error("Missing required hotel search parameters");
      }

      logger.info("Searching hotels", {params});

      const hotels = await amadeusService.searchHotels(params);

      return {
        success: true,
        hotels,
        count: hotels.length,
      };
    } catch (error) {
      logger.error("Error searching hotels:", error);
      throw new Error(
        `Failed to search hotels: ${(error as Error).message}`
      );
    }
  }
);

/**
 * Generate enhanced itinerary with flight and hotel integration
 */
export const generateEnhancedItinerary = onCall(
  {
    region: "us-central1",
    memory: "1GiB",
    timeoutSeconds: 60,
  },
  withAuth(async (request, userId) => {
    try {
      const {preferences, flightParams, hotelParams} = request.data;

      if (!preferences || !preferences.duration || !preferences.interests) {
        throw new Error("Invalid preferences provided");
      }

      logger.info("Generating enhanced itinerary", {userId, preferences});

      // Generate base itinerary
      const baseItinerary = await geminiService.generateItinerary(preferences);

      // Add flight information if provided
      let flights = null;
      if (flightParams) {
        try {
          flights = await amadeusService.searchFlights(flightParams);
          logger.info("Flights added to itinerary", {
            userId, flightCount: flights.length,
          });
        } catch (flightError) {
          logger.warn("Failed to fetch flights for itinerary", flightError);
        }
      }

      // Add hotel information if provided
      let hotels = null;
      if (hotelParams) {
        try {
          hotels = await amadeusService.searchHotels(hotelParams);
          logger.info("Hotels added to itinerary", {userId, hotelCount: hotels.length});
        } catch (hotelError) {
          logger.warn("Failed to fetch hotels for itinerary", hotelError);
        }
      }

      // Enhance the itinerary with Amadeus data
      const enhancedItinerary = {
        ...baseItinerary,
        travelOptions: {
          flights: flights?.slice(0, 3) || [], // Include top 3 flight options
          hotels: hotels?.slice(0, 3) || [], // Include top 3 hotel options
        },
        updatedAt: new Date().toISOString(),
      };

      // Store enhanced itinerary for the user
      const userItineraryRef = adminDB.collection('users').doc(userId).collection('itineraries').doc();
      await userItineraryRef.set({
        ...enhancedItinerary,
        userId,
        createdAt: new Date(),
        preferences,
        hasTravelOptions: !!(flights || hotels)
      });

      return {
        success: true,
        itinerary: {
          ...enhancedItinerary,
          id: userItineraryRef.id
        },
      };
    } catch (error) {
      logger.error("Error generating enhanced itinerary:", error);
      throw new Error(
        `Failed to generate enhanced itinerary: ${(error as Error).message}`
      );
    }
  })
);

/**
 * Health check endpoint
 */
export const healthCheck = onRequest(
  {
    region: "us-central1",
    cors: true,
  },
  (req, res) => {
    corsHandler(req, res, () => {
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "rosarito-ai-functions",
      });
    });
  }
);

/**
 * Get user itineraries (requires authentication)
 */
export const getUserItineraries = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 30,
  },
  withAuth(async (request, userId) => {
    try {
      const { limit = 10, offset = 0 } = request.data || {};

      logger.info("Getting user itineraries", { userId, limit, offset });

      const itinerariesRef = adminDB.collection('users').doc(userId).collection('itineraries');
      const query = itinerariesRef
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      const snapshot = await query.get();

      const itineraries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate().toISOString()
      }));

      return {
        success: true,
        itineraries,
        hasMore: itineraries.length === limit
      };
    } catch (error) {
      logger.error("Error retrieving user itineraries:", error);
      throw new Error(`Failed to get itineraries: ${(error as Error).message}`);
    }
  })
);

/**
 * Update user preferences
 */
export const updateUserPreferences = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withAuth(async (request, userId) => {
    try {
      const preferences = request.data;

      if (!preferences) {
        throw new Error("Preferences data is required");
      }

      logger.info("Updating user preferences", { userId, preferences });

      const userRef = adminDB.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error("User profile not found");
      }

      const currentPreferences = userDoc.data()?.preferences || {};

      // Merge new preferences with existing ones
      const updatedPreferences = {
        ...currentPreferences,
        ...preferences
      };

      await userRef.update({
        preferences: updatedPreferences,
        updatedAt: new Date()
      });

      return {
        success: true,
        preferences: updatedPreferences
      };
    } catch (error) {
      logger.error("Error updating user preferences:", error);
      throw new Error(`Failed to update preferences: ${(error as Error).message}`);
    }
  })
);

/**
 * Get user profile data
 */
export const getUserProfile = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withAuth(async (request, userId) => {
    try {
      logger.info("Getting user profile", { userId });

      const userRef = adminDB.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error("User profile not found");
      }

      const userData = userDoc.data();

      return {
        success: true,
        profile: {
          uid: userData?.uid,
          email: userData?.email,
          displayName: userData?.displayName,
          preferences: userData?.preferences,
          points: userData?.points || 0,
          badges: userData?.badges || [],
          createdAt: userData?.createdAt.toDate().toISOString(),
          updatedAt: userData?.updatedAt.toDate().toISOString()
        }
      };
    } catch (error) {
      logger.error("Error retrieving user profile:", error);
      throw new Error(`Failed to get profile: ${(error as Error).message}`);
    }
  })
);

/**
 * Trigger function when new deal is created
 */
export const onDealCreated = onDocumentCreated(
  "deals/{dealId}",
  async (event) => {
    try {
      const dealData = event.data?.data();

      if (!dealData) {
        logger.warn("No deal data found in document");
        return;
      }

      logger.info("New deal created, generating AI description", {
        dealId: event.params.dealId,
        businessName: dealData.businessName,
      });

      const description = await geminiService.generateDealDescription(
        dealData as {
          businessName: string;
          type?: string;
          originalPrice?: string;
          discountedPrice?: string;
          description?: string;
        }
      );

      // Update the deal document with AI-generated description
      await event.data?.ref.update({
        aiDescription: description,
        updatedAt: new Date(),
      });
    } catch (error) {
      logger.error("Error processing new deal:", error);
    }
  }
);
