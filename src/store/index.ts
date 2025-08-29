import {configureStore} from '@reduxjs/toolkit';
import itinerarySlice from './slices/itinerarySlice';
import userSlice from './slices/userSlice';
import dealsSlice from './slices/dealsSlice';

export const store = configureStore({
  reducer: {
    itinerary: itinerarySlice,
    user: userSlice,
    deals: dealsSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;