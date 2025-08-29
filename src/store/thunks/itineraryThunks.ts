import { createAsyncThunk } from '@reduxjs/toolkit';
import { firebaseClient } from '../../services/firebaseClient';
import { Itinerary, ItineraryRequest, ItineraryResponse } from '../../types/services';

// Async thunk for generating itinerary with AI
export const generateItinerary = createAsyncThunk(
  'itinerary/generateItinerary',
  async (request: ItineraryRequest, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.itinerary.generateItinerary(request);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to generate itinerary');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to generate itinerary');
    }
  }
);

// Async thunk for fetching a single itinerary
export const fetchItinerary = createAsyncThunk(
  'itinerary/fetchItinerary',
  async (itineraryId: string, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.itinerary.getItinerary(itineraryId);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Itinerary not found');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch itinerary');
    }
  }
);

// Async thunk for fetching user's itineraries
export const fetchUserItineraries = createAsyncThunk(
  'itinerary/fetchUserItineraries',
  async ({ userId }: { userId?: string } = {}, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.itinerary.getUserItineraries(userId);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to fetch itineraries');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch itineraries');
    }
  }
);

// Async thunk for updating an itinerary
export const updateItinerary = createAsyncThunk(
  'itinerary/updateItinerary',
  async ({
    itineraryId,
    updates
  }: {
    itineraryId: string;
    updates: Partial<Itinerary>
  }, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.itinerary.updateItinerary(itineraryId, updates);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to update itinerary');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update itinerary');
    }
  }
);

// Async thunk for deleting an itinerary
export const deleteItinerary = createAsyncThunk(
  'itinerary/deleteItinerary',
  async (itineraryId: string, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.itinerary.deleteItinerary(itineraryId);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to delete itinerary');
      }

      return { itineraryId, deleted: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete itinerary');
    }
  }
);

// Async thunk for completing an itinerary activity
export const completeItineraryActivity = createAsyncThunk(
  'itinerary/completeActivity',
  async ({
    itineraryId,
    activityId
  }: {
    itineraryId: string;
    activityId: string
  }, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.itinerary.completeActivity(itineraryId, activityId);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to complete activity');
      }

      return {
        itineraryId,
        activityId,
        ...response.data
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to complete activity');
    }
  }
);

// Async thunk for duplicating an existing itinerary
export const duplicateItinerary = createAsyncThunk(
  'itinerary/duplicateItinerary',
  async ({
    itineraryId,
    newDates
  }: {
    itineraryId: string;
    newDates?: { startDate: string; endDate: string }
  }, { rejectWithValue }) => {
    try {
      // First get the original itinerary
      const fetchResponse = await firebaseClient.itinerary.getItinerary(itineraryId);

      if (!fetchResponse.success) {
        return rejectWithValue('Original itinerary not found');
      }

      // Create a copy with new dates if provided
      const original = fetchResponse.data;
      const duplicatedItinerary = {
        ...original,
        id: '', // Will be set by Firestore
        title: `${original.title} (Copy)`,
        status: 'draft' as const,
        ...(newDates && {
          startDate: newDates.startDate,
          endDate: newDates.endDate
        }),
        createdAt: '', // Will be set by Firestore
        updatedAt: '', // Will be set by Firestore
      };

      // Use Firebase function to create the duplicate
      // For now, return the duplicated data (you would implement this on the backend)
      return {
        originalId: itineraryId,
        duplicatedItinerary
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to duplicate itinerary');
    }
  }
);

// Async thunk for sharing an itinerary
export const shareItinerary = createAsyncThunk(
  'itinerary/shareItinerary',
  async ({
    itineraryId,
    shareWith
  }: {
    itineraryId: string;
    shareWith: string[]
  }, { rejectWithValue }) => {
    try {
      // This would typically call a Firebase function to handle sharing
      // For now, we'll just return success
      return {
        itineraryId,
        sharedWith: shareWith,
        shareLink: `https://mi-rosarita-ai.app/itinerary/${itineraryId}`
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to share itinerary');
    }
  }
);