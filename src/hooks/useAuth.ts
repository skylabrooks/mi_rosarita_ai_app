import {useAuth as useAuthContext} from '../contexts/AuthContext';
import {useDispatch} from 'react-redux';
import {setUser, logout as logoutAction, setLoading} from '../store/slices/userSlice';

// Hook that combines Firebase auth with Redux
export const useAuth = () => {
  const authContext = useAuthContext();
  const dispatch = useDispatch();

  const login = async (email: string, password: string) => {
    dispatch(setLoading(true));
    try {
      await authContext.login(email, password);
    } catch (error) {
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    dispatch(setLoading(true));
    try {
      await authContext.register(email, password, displayName);

      // Update Redux store with user data
      dispatch(setUser({
        id: authContext.user!.uid,
        email: email,
        displayName: displayName,
        preferences: {
          language: 'en',
          currency: 'USD',
          travelStyle: [],
          dietaryRestrictions: [],
          budget: 'medium'
        },
        points: 0,
        badges: [],
        createdAt: new Date().toISOString()
      }));
    } catch (error) {
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const logout = async () => {
    dispatch(setLoading(true));
    try {
      await authContext.logout();
      dispatch(logoutAction());
    } catch (error) {
      throw error;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authContext.resetPassword(email);
    } catch (error) {
      throw error;
    }
  };

  return {
    ...authContext,
    login,
    register,
    logout,
    resetPassword
  };
};