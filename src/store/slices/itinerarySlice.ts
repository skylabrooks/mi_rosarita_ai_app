import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface ItineraryItem {
  id: string;
  title: string;
  description: string;
  location: string;
  time: string;
  duration: string;
  cost?: number;
  category: 'food' | 'activity' | 'transport' | 'accommodation' | 'shopping';
}

export interface Itinerary {
  id: string;
  title: string;
  date: string;
  duration: number; // in days
  items: ItineraryItem[];
  totalCost?: number;
  createdAt: string;
  updatedAt: string;
}

interface ItineraryState {
  currentItinerary: Itinerary | null;
  savedItineraries: Itinerary[];
  isGenerating: boolean;
  error: string | null;
}

const initialState: ItineraryState = {
  currentItinerary: null,
  savedItineraries: [],
  isGenerating: false,
  error: null,
};

const itinerarySlice = createSlice({
  name: 'itinerary',
  initialState,
  reducers: {
    setGenerating: (state, action: PayloadAction<boolean>) => {
      state.isGenerating = action.payload;
    },
    setItinerary: (state, action: PayloadAction<Itinerary>) => {
      state.currentItinerary = action.payload;
      state.error = null;
    },
    saveItinerary: (state, action: PayloadAction<Itinerary>) => {
      state.savedItineraries.push(action.payload);
    },
    updateItinerary: (state, action: PayloadAction<Itinerary>) => {
      const index = state.savedItineraries.findIndex(
        itinerary => itinerary.id === action.payload.id
      );
      if (index !== -1) {
        state.savedItineraries[index] = action.payload;
      }
    },
    deleteItinerary: (state, action: PayloadAction<string>) => {
      state.savedItineraries = state.savedItineraries.filter(
        itinerary => itinerary.id !== action.payload
      );
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isGenerating = false;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setGenerating,
  setItinerary,
  saveItinerary,
  updateItinerary,
  deleteItinerary,
  setError,
  clearError,
} = itinerarySlice.actions;

export default itinerarySlice.reducer;