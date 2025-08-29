// User Profile Types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences: UserPreferences;
  points: number;
  badges: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  language: 'en' | 'es';
  currency: string;
  travelStyle: string[];
  dietaryRestrictions: string[];
  budget: 'low' | 'medium' | 'high';
}

// Deal Types
export interface Deal {
  id: string;
  businessId: string;
  businessName: string;
  title: string;
  description: string;
  originalPrice?: number;
  discountedPrice: number;
  discountPercentage?: number;
  category: string;
  location: string;
  validUntil: string;
  isActive: boolean;
  redeemedCount: number;
  maxRedemptions?: number;
  terms: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  description: string;
  category: string;
  location: Location;
  contact: ContactInfo;
  images: string[];
  isActive: boolean;
  createdAt: string;
}

export interface Location {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  hours: BusinessHours[];
}

export interface BusinessHours {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  open: string;
  close: string;
  isClosed: boolean;
}

// Itinerary Types
export interface Itinerary {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  activities: ItineraryActivity[];
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  totalCost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryActivity {
  id: string;
  date: string;
  time: string;
  title: string;
  description?: string;
  location: Location;
  businessId?: string;
  businessName?: string;
  category: string;
  estimatedCost?: number;
  duration?: number; // in minutes
  photos?: string[];
  completed: boolean;
  notes?: string;
}

// AI Service Types
export interface ItineraryRequest {
  userId: string;
  startDate: string;
  endDate: string;
  preferences: {
    budget: 'low' | 'medium' | 'high';
    travelStyle: string[];
    interests: string[];
    dietaryRestrictions: string[];
    groupSize?: number;
    specialRequirements?: string;
  };
  currentLocation?: Location;
  accommodation?: {
    type: string;
    budget?: number;
    preferredAreas?: string[];
  };
}

export interface ItineraryResponse {
  itinerary: Itinerary;
  recommendations: {
    activities: ItineraryActivity[];
    deals: Deal[];
    restaurants: BusinessProfile[];
  };
  estimatedCost: number;
  tips: string[];
  credits: number;
}

// Photo Analysis Types
export interface PhotoAnalysisRequest {
  userId: string;
  imageUri: string;
  location?: Location;
  tags?: string[];
  caption?: string;
}

export interface PhotoAnalysisResponse {
  analysis: {
    description: string;
    location?: Location;
    people: string[];
    activities: string[];
    emotions: string[];
    weather?: string;
    timeOfDay?: string;
  };
  highlights: string[];
  memories: string[];
  suggestedTags: string[];
  relatedDeals: Deal[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    userMessage: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    userMessage: string;
    statusCode: number;
  };
}

// Service Method Signatures
export interface DealsServiceMethods {
  getDeals(params?: {
    category?: string;
    location?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Deal[]>>;
  getNearbyDeals(coordinates: { latitude: number; longitude: number; radius?: number }): Promise<ApiResponse<Deal[]>>;
  getDealById(id: string): Promise<ApiResponse<Deal>>;
  redeemDeal(id: string): Promise<ApiResponse<{ redeemed: boolean; redemptionCode: string }>>;
  getMyRedemptions(): Promise<ApiResponse<{ deal: Deal; redeemedAt: string; code: string }[]>>;
}

export interface ItineraryServiceMethods {
  generateItinerary(request: ItineraryRequest): Promise<ApiResponse<ItineraryResponse>>;
  getItinerary(id: string): Promise<ApiResponse<Itinerary>>;
  getUserItineraries(userId?: string): Promise<ApiResponse<Itinerary[]>>;
  updateItinerary(id: string, updates: Partial<Itinerary>): Promise<ApiResponse<Itinerary>>;
  deleteItinerary(id: string): Promise<ApiResponse<{ deleted: boolean }>>;
  completeActivity(itineraryId: string, activityId: string): Promise<ApiResponse<ItineraryActivity>>;
}

export interface UserServiceMethods {
  getProfile(userId?: string): Promise<ApiResponse<UserProfile>>;
  updateProfile(updates: Partial<UserProfile>): Promise<ApiResponse<UserProfile>>;
  updatePreferences(preferences: Partial<UserPreferences>): Promise<ApiResponse<UserPreferences>>;
  getUserStats(userId?: string): Promise<ApiResponse<{
    totalItineraries: number;
    completedActivities: number;
    redeemedDeals: number;
    totalSavings: number;
    badges: string[];
  }>>;
}

export interface AIAssistantServiceMethods {
  analyzePhoto(request: PhotoAnalysisRequest): Promise<ApiResponse<PhotoAnalysisResponse>>;
  chatWithAssistant(message: string, context?: Record<string, any>): Promise<ApiResponse<{
    response: string;
    suggestions?: string[];
    actions?: { type: string; data: any }[];
  }>>;
}

// Authentication Service Types
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: UserProfile;
}

export interface AuthServiceMethods {
  getCurrentToken(): Promise<string | null>;
  refreshToken(): Promise<AuthToken | null>;
  isTokenValid(): boolean;
  clearTokens(): Promise<void>;
}

// Generic types for service responses
export type ServiceResponse<T> = ApiResponse<T>;
export type ServiceMethod<T extends (...args: any[]) => any> = T;

// Collection of all service interfaces
export interface ServiceClients {
  deals: DealsServiceMethods;
  itinerary: ItineraryServiceMethods;
  user: UserServiceMethods;
  aiAssistant: AIAssistantServiceMethods;
  auth: AuthServiceMethods;
}