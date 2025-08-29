import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import { Deal } from '../../types/services';
import {
  fetchDeals,
  fetchNearbyDeals,
  fetchDealById,
  redeemDeal as redeemDealThunk,
  fetchMyRedemptions,
  refreshDeals
} from '../thunks';

interface DealsState {
  deals: Deal[];
  nearbyDeals: Deal[];
  selectedDeal: Deal | null;
  myRedemptions: Array<{ deal: Deal; redeemedAt: string; code: string }>;
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: DealsState = {
  deals: [],
  nearbyDeals: [],
  selectedDeal: null,
  myRedemptions: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

const dealsSlice = createSlice({
  name: 'deals',
  initialState,
  reducers: {
    setDeals: (state, action: PayloadAction<Deal[]>) => {
      state.deals = action.payload;
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    },
    setNearbyDeals: (state, action: PayloadAction<Deal[]>) => {
      state.nearbyDeals = action.payload;
    },
    addDeal: (state, action: PayloadAction<Deal>) => {
      state.deals.push(action.payload);
    },
    updateDeal: (state, action: PayloadAction<Deal>) => {
      const index = state.deals.findIndex(deal => deal.id === action.payload.id);
      if (index !== -1) {
        state.deals[index] = action.payload;
      }
    },
    redeemDeal: (state, action: PayloadAction<string>) => {
      const deal = state.deals.find(d => d.id === action.payload);
      if (deal) {
        deal.redeemedCount += 1;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedDeal: (state) => {
      state.selectedDeal = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch deals
    builder.addCase(fetchDeals.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(fetchDeals.fulfilled, (state, action) => {
      state.isLoading = false;
      state.deals = action.payload || [];
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(fetchDeals.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string || 'Failed to fetch deals';
    });

    // Fetch nearby deals
    builder.addCase(fetchNearbyDeals.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchNearbyDeals.fulfilled, (state, action) => {
      state.isLoading = false;
      state.nearbyDeals = action.payload || [];
      state.error = null;
    });
    builder.addCase(fetchNearbyDeals.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string || 'Failed to fetch nearby deals';
    });

    // Fetch deal by ID
    builder.addCase(fetchDealById.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchDealById.fulfilled, (state, action) => {
      state.isLoading = false;
      state.selectedDeal = action.payload || null;
      state.error = null;
    });
    builder.addCase(fetchDealById.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string || 'Failed to fetch deal';
    });

    // Redeem deal
    builder.addCase(redeemDealThunk.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(redeemDealThunk.fulfilled, (state, action) => {
      state.isLoading = false;
      // Update redeemed count for the deal
      const dealIndex = state.deals.findIndex(d => d.id === action.payload.dealId);
      if (dealIndex !== -1) {
        state.deals[dealIndex].redeemedCount += 1;
      }
      // Add to my redemptions if it's there
      const deal = state.deals.find(d => d.id === action.payload.dealId);
      if (deal) {
        state.myRedemptions.unshift({
          deal,
          redeemedAt: new Date().toISOString(),
          code: action.payload.redemptionCode,
        });
      }
      state.error = null;
    });
    builder.addCase(redeemDealThunk.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string || 'Failed to redeem deal';
    });

    // Fetch my redemptions
    builder.addCase(fetchMyRedemptions.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(fetchMyRedemptions.fulfilled, (state, action) => {
      state.isLoading = false;
      state.myRedemptions = action.payload || [];
      state.error = null;
    });
    builder.addCase(fetchMyRedemptions.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string || 'Failed to fetch redemptions';
    });

    // Refresh deals
    builder.addCase(refreshDeals.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(refreshDeals.fulfilled, (state, action) => {
      state.isLoading = false;
      state.deals = action.payload || [];
      state.error = null;
      state.lastUpdated = new Date().toISOString();
    });
    builder.addCase(refreshDeals.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as string || 'Failed to refresh deals';
    });
  },
});

export const {
  setDeals,
  setNearbyDeals,
  addDeal,
  updateDeal,
  redeemDeal,
  setLoading,
  setError,
  clearError,
  clearSelectedDeal,
} = dealsSlice.actions;

export default dealsSlice.reducer;