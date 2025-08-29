import { auth, db, functions } from '../utils/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import {
  httpsCallable,
  HttpsCallableResult
} from 'firebase/functions';
import { getIdToken } from 'firebase/auth';

// Import types and error handler
import {
  ApiResponse,
  ServiceClients,
  DealsServiceMethods,
  ItineraryServiceMethods,
  UserServiceMethods,
  AIAssistantServiceMethods,
  AuthServiceMethods,
  Deal,
  Itinerary,
  UserProfile,
  ItineraryRequest,
  ItineraryResponse,
  PhotoAnalysisRequest,
  PhotoAnalysisResponse,
  AuthToken
} from '../types/services';
import { errorHandler, AppError, ErrorType } from './errorHandler';

class FirebaseClient implements ServiceClients {
  private authToken: string | null = null;

  // Service instances
  deals: DealsService;
  itinerary: ItineraryService;
  user: UserService;
  aiAssistant: AIAssistantService;
  auth: AuthService;

  constructor() {
    this.deals = new DealsService(this);
    this.itinerary = new ItineraryService(this);
    this.user = new UserService(this);
    this.aiAssistant = new AIAssistantService(this);
    this.auth = new AuthService(this);
  }

  // Authentication and token management
  async getAuthToken(): Promise<string | null> {
    if (!auth.currentUser) {
      this.authToken = null;
      return null;
    }

    try {
      this.authToken = await getIdToken(auth.currentUser, true);
      return this.authToken;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      this.authToken = null;
      return null;
    }
  }

  // Generic Firestore operations
  async queryDocuments<T>(
    collectionName: string,
    conditions: Array<{ field: string; operator: any; value: any }>,
    options: {
      orderBy?: { field: string; direction: 'asc' | 'desc' };
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<QueryDocumentSnapshot<DocumentData>[]> {
    try {
      const collectionRef = collection(db, collectionName);

      // Build query constraints
      const constraints: any[] = [];

      // Apply conditions
      conditions.forEach(condition => {
        constraints.push(where(condition.field, condition.operator, condition.value));
      });

      // Apply ordering
      if (options.orderBy) {
        constraints.push(orderBy(options.orderBy.field, options.orderBy.direction));
      }

      // Apply limit
      if (options.limit) {
        constraints.push(limit(options.limit));
      }

      // Execute query with all constraints
      const q = query(collectionRef, ...constraints);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs;
    } catch (error) {
      const appError = errorHandler.handleGenericError(error, {
        collection: collectionName,
        conditions,
        options
      });
      throw appError;
    }
  }

  async getDocument<T>(
    collectionName: string,
    documentId: string
  ): Promise<QueryDocumentSnapshot<DocumentData> | null> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap : null;
    } catch (error) {
      const appError = errorHandler.handleGenericError(error, {
        collection: collectionName,
        documentId
      });
      throw appError;
    }
  }

  async createDocument<T>(
    collectionName: string,
    data: Partial<T>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      const appError = errorHandler.handleGenericError(error, {
        collection: collectionName,
        data
      });
      throw appError;
    }
  }

  async updateDocument<T>(
    collectionName: string,
    documentId: string,
    data: Partial<T>
  ): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const appError = errorHandler.handleGenericError(error, {
        collection: collectionName,
        documentId,
        data
      });
      throw appError;
    }
  }

  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      const docRef = doc(db, collectionName, documentId);
      await deleteDoc(docRef);
    } catch (error) {
      const appError = errorHandler.handleGenericError(error, {
        collection: collectionName,
        documentId
      });
      throw appError;
    }
  }

  // Firebase Functions calls with authentication
  async callFunction<T = any>(
    functionName: string,
    data: any = {}
  ): Promise<HttpsCallableResult<T>> {
    try {
      const token = await this.getAuthToken();
      const callable = httpsCallable<T>(functions, functionName);

      // Add auth token to function call data
      const callData = {
        ...data,
        authToken: token,
      };

      return await callable(callData);
    } catch (error) {
      const appError = errorHandler.handleGenericError(error, {
        function: functionName,
        data
      });
      throw appError;
    }
  }

  // Utility method to convert Firestore document to typed object
  documentToObject<T>(doc: QueryDocumentSnapshot<DocumentData>): T {
    return {
      id: doc.id,
      ...doc.data(),
    } as T;
  }

  // Generic method to create API response
  createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
      success: true,
      data,
    };
  }

  createErrorResponse(error: AppError): ApiResponse {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        userMessage: error.userMessage,
      },
    };
  }
}

// Individual Service Classes

class DealsService implements DealsServiceMethods {
  constructor(private client: FirebaseClient) {}

  async getDeals(params: {
    category?: string;
    location?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ApiResponse<Deal[]>> {
    try {
      const conditions: Array<{ field: string; operator: any; value: any }> = [
        { field: 'isActive', operator: '==', value: true }
      ];

      if (params.category) {
        conditions.push({ field: 'category', operator: '==', value: params.category });
      }

      const docs = await this.client.queryDocuments('deals', conditions, {
        orderBy: { field: 'createdAt', direction: 'desc' },
        limit: params.limit || 20,
      });

      const deals: Deal[] = docs.map(doc => this.client.documentToObject<Deal>(doc));
      return this.client.createSuccessResponse(deals);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async getNearbyDeals(coordinates: { latitude: number; longitude: number; radius?: number }): Promise<ApiResponse<Deal[]>> {
    try {
      // Note: Firebase doesn't support geo queries natively
      // In production, you'd use a geo library or Cloud Functions
      const docs = await this.client.queryDocuments('deals', [
        { field: 'isActive', operator: '==', value: true }
      ], {
        limit: 50,
      });

      const deals: Deal[] = docs
        .map(doc => this.client.documentToObject<Deal>(doc))
        .filter(deal => {
          // Simple distance calculation (replace with proper geo query in production)
          if (!deal.location?.coordinates) return false;
          const distance = this.calculateDistance(
            coordinates,
            deal.location.coordinates
          );
          return distance <= (coordinates.radius || 5000); // Default 5km radius
        });

      return this.client.createSuccessResponse(deals);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async getDealById(id: string): Promise<ApiResponse<Deal>> {
    try {
      const doc = await this.client.getDocument('deals', id);
      if (!doc) {
        const notFoundError = errorHandler.createError(
          ErrorType.NOT_FOUND_ERROR,
          'deal-not-found',
          `Deal with ID ${id} not found`,
          'Deal not found',
          undefined,
          404
        );
        return this.client.createErrorResponse(notFoundError);
      }

      const deal = this.client.documentToObject<Deal>(doc);
      return this.client.createSuccessResponse(deal);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async redeemDeal(id: string): Promise<ApiResponse<{ redeemed: boolean; redemptionCode: string }>> {
    try {
      const result = await this.client.callFunction('redeemDeal', { dealId: id });
      return this.client.createSuccessResponse(result.data as { redeemed: boolean; redemptionCode: string });
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async getMyRedemptions(): Promise<ApiResponse<{ deal: Deal; redeemedAt: string; code: string }[]>> {
    try {
      const docs = await this.client.queryDocuments('redemptions', [], {
        orderBy: { field: 'redeemedAt', direction: 'desc' }
      });

      const redemptions = docs.map(doc => ({
        ...doc.data(),
        deal: doc.data().deal,
        redeemedAt: doc.data().redeemedAt,
        code: doc.data().code
      }));

      return this.client.createSuccessResponse(redemptions);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    // Simple Haversine formula implementation
    const R = 6371e3; // Earth's radius in meters
    const φ1 = point1.latitude * Math.PI / 180;
    const φ2 = point2.latitude * Math.PI / 180;
    const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
    const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }
}

class ItineraryService implements ItineraryServiceMethods {
  constructor(private client: FirebaseClient) {}

  async generateItinerary(request: ItineraryRequest): Promise<ApiResponse<ItineraryResponse>> {
    try {
      const result = await this.client.callFunction<ItineraryResponse>('generateItinerary', request);
      return this.client.createSuccessResponse(result.data);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async getItinerary(id: string): Promise<ApiResponse<Itinerary>> {
    try {
      const doc = await this.client.getDocument('itineraries', id);
      if (!doc) {
        const notFoundError = errorHandler.createError(
          ErrorType.NOT_FOUND_ERROR,
          'itinerary-not-found',
          `Itinerary with ID ${id} not found`,
          'Itinerary not found',
          undefined,
          404
        );
        return this.client.createErrorResponse(notFoundError);
      }

      const itinerary = this.client.documentToObject<Itinerary>(doc);
      return this.client.createSuccessResponse(itinerary);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async getUserItineraries(userId?: string): Promise<ApiResponse<Itinerary[]>> {
    try {
      const targetUserId = userId || (await this.client.getAuthToken()) ? auth.currentUser?.uid : null;

      if (!targetUserId) {
        const authError = errorHandler.createAuthenticationError('User not authenticated');
        return this.client.createErrorResponse(authError);
      }

      const docs = await this.client.queryDocuments('itineraries', [
        { field: 'userId', operator: '==', value: targetUserId }
      ], {
        orderBy: { field: 'createdAt', direction: 'desc' }
      });

      const itineraries: Itinerary[] = docs.map(doc => this.client.documentToObject<Itinerary>(doc));
      return this.client.createSuccessResponse(itineraries);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async updateItinerary(id: string, updates: Partial<Itinerary>): Promise<ApiResponse<Itinerary>> {
    try {
      await this.client.updateDocument('itineraries', id, updates);
      const updatedDoc = await this.client.getDocument('itineraries', id);
      if (!updatedDoc) {
        throw new Error('Failed to retrieve updated itinerary');
      }

      const itinerary = this.client.documentToObject<Itinerary>(updatedDoc);
      return this.client.createSuccessResponse(itinerary);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async deleteItinerary(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      await this.client.deleteDocument('itineraries', id);
      return this.client.createSuccessResponse({ deleted: true });
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async completeActivity(itineraryId: string, activityId: string): Promise<ApiResponse<any>> {
    try {
      const result = await this.client.callFunction('completeActivity', {
        itineraryId,
        activityId
      });
      return this.client.createSuccessResponse(result.data);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }
}

class UserService implements UserServiceMethods {
  constructor(private client: FirebaseClient) {}

  async getProfile(userId?: string): Promise<ApiResponse<UserProfile>> {
    try {
      const targetUserId = userId || auth.currentUser?.uid;
      if (!targetUserId) {
        const authError = errorHandler.createAuthenticationError('User not authenticated');
        return this.client.createErrorResponse(authError);
      }

      const doc = await this.client.getDocument('users', targetUserId);
      if (!doc) {
        const notFoundError = errorHandler.createError(
          ErrorType.NOT_FOUND_ERROR,
          'profile-not-found',
          `User profile not found for ${targetUserId}`,
          'Profile not found',
          undefined,
          404
        );
        return this.client.createErrorResponse(notFoundError);
      }

      const profile = this.client.documentToObject<UserProfile>(doc);
      return this.client.createSuccessResponse(profile);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<ApiResponse<UserProfile>> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        const authError = errorHandler.createAuthenticationError('User not authenticated');
        return this.client.createErrorResponse(authError);
      }

      await this.client.updateDocument('users', userId, updates);
      const updatedDoc = await this.client.getDocument('users', userId);
      if (!updatedDoc) {
        throw new Error('Failed to retrieve updated profile');
      }

      const profile = this.client.documentToObject<UserProfile>(updatedDoc);
      return this.client.createSuccessResponse(profile);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async updatePreferences(preferences: Partial<UserProfile['preferences']>): Promise<ApiResponse<any>> {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        const authError = errorHandler.createAuthenticationError('User not authenticated');
        return this.client.createErrorResponse(authError);
      }

      await this.client.updateDocument('users', userId, { preferences });
      return this.client.createSuccessResponse({ success: true });
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async getUserStats(userId?: string): Promise<ApiResponse<any>> {
    try {
      const result = await this.client.callFunction('getUserStats', { userId });
      return this.client.createSuccessResponse(result.data);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }
}

class AIAssistantService implements AIAssistantServiceMethods {
  constructor(private client: FirebaseClient) {}

  async analyzePhoto(request: PhotoAnalysisRequest): Promise<ApiResponse<PhotoAnalysisResponse>> {
    try {
      const result = await this.client.callFunction<PhotoAnalysisResponse>('analyzePhoto', request);
      return this.client.createSuccessResponse(result.data);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }

  async chatWithAssistant(message: string, context?: Record<string, any>): Promise<ApiResponse<any>> {
    try {
      const result = await this.client.callFunction('chatWithAssistant', {
        message,
        context
      });
      return this.client.createSuccessResponse(result.data);
    } catch (error) {
      return this.client.createErrorResponse(error as AppError);
    }
  }
}

class AuthService implements AuthServiceMethods {
  constructor(private client: FirebaseClient) {}

  async getCurrentToken(): Promise<string | null> {
    return await this.client.getAuthToken();
  }

  async refreshToken(): Promise<AuthToken | null> {
    try {
      if (!auth.currentUser) return null;

      const token = await getIdToken(auth.currentUser, true);
      const userDoc = await this.client.getDocument('users', auth.currentUser.uid);

      if (!userDoc) {
        throw new Error('User profile not found');
      }

      const userProfile = this.client.documentToObject<UserProfile>(userDoc);

      const authToken: AuthToken = {
        accessToken: token,
        refreshToken: '', // Firebase handles refresh tokens internally
        expiresAt: Date.now() + (60 * 60 * 1000), // Assume 1 hour expiry
        user: userProfile,
      };

      return authToken;
    } catch (error) {
      const appError = errorHandler.handleGenericError(error);
      throw appError;
    }
  }

  isTokenValid(): boolean {
    return auth.currentUser !== null;
  }

  async clearTokens(): Promise<void> {
    this.client['authToken'] = null;
  }
}

// Export singleton instance
export const firebaseClient = new FirebaseClient();
export default firebaseClient;
export type { FirebaseClient };