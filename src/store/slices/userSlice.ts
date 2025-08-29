import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  preferences: {
    language: 'en' | 'es';
    currency: 'USD' | 'MXN';
    travelStyle: string[];
    dietaryRestrictions: string[];
    budget: 'low' | 'medium' | 'high';
  };
  points: number;
  badges: string[];
  createdAt: string;
}

interface UserState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: UserState = {
  currentUser: null,
  isAuthenticated: false,
  isLoading: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.currentUser = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.currentUser) {
        state.currentUser = {...state.currentUser, ...action.payload};
      }
    },
    addPoints: (state, action: PayloadAction<number>) => {
      if (state.currentUser) {
        state.currentUser.points += action.payload;
      }
    },
    addBadge: (state, action: PayloadAction<string>) => {
      if (state.currentUser && !state.currentUser.badges.includes(action.payload)) {
        state.currentUser.badges.push(action.payload);
      }
    },
    logout: (state) => {
      state.currentUser = null;
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  setUser,
  updateUser,
  addPoints,
  addBadge,
  logout,
  setLoading,
} = userSlice.actions;

export default userSlice.reducer;