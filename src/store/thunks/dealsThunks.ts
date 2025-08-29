import { createAsyncThunk } from '@reduxjs/toolkit';
import { firebaseClient } from '../../services/firebaseClient';
import { Deal } from '../../types/services';

// Async thunk for fetching deals
export const fetchDeals = createAsyncThunk(
  'deals/fetchDeals',
  async (params: {
    category?: string;
    location?: string;
    limit?: number;
    offset?: number;
  } = {}, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.deals.getDeals(params);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to fetch deals');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch deals');
    }
  }
);

// Async thunk for fetching nearby deals
export const fetchNearbyDeals = createAsyncThunk(
  'deals/fetchNearbyDeals',
  async (coordinates: {
    latitude: number;
    longitude: number;
    radius?: number;
  }, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.deals.getNearbyDeals(coordinates);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to fetch nearby deals');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch nearby deals');
    }
  }
);

// Async thunk for fetching a single deal
export const fetchDealById = createAsyncThunk(
  'deals/fetchDealById',
  async (dealId: string, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.deals.getDealById(dealId);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Deal not found');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch deal');
    }
  }
);

// Async thunk for redeeming a deal
export const redeemDeal = createAsyncThunk(
  'deals/redeemDeal',
  async (dealId: string, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.deals.redeemDeal(dealId);

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to redeem deal');
      }

      return {
        dealId,
        ...response.data
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to redeem deal');
    }
  }
);

// Async thunk for fetching user's redemptions
export const fetchMyRedemptions = createAsyncThunk(
  'deals/fetchMyRedemptions',
  async (_, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.deals.getMyRedemptions();

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to fetch redemptions');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch redemptions');
    }
  }
);

// Async thunk for refreshing deals data
export const refreshDeals = createAsyncThunk(
  'deals/refreshDeals',
  async (_, { rejectWithValue }) => {
    try {
      const response = await firebaseClient.deals.getDeals();

      if (!response.success) {
        return rejectWithValue(response.error?.message || 'Failed to refresh deals');
      }

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to refresh deals');
    }
  }
);