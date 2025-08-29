import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {useAuth} from '../hooks/useAuth';
import HomeScreen from '../screens/HomeScreen';
import ItineraryScreen from '../screens/ItineraryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

const Stack = createNativeStackNavigator();

const AuthNavigator: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    // Show loading screen while checking authentication
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7DAB" />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {isAuthenticated ? (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: 'Rosarito AI Travel' }}
          />
          <Stack.Screen
            name="Itinerary"
            component={ItineraryScreen}
            options={{ title: 'Your Itinerary' }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              title: 'Profile',
              headerRight: () => (
                // You can add logout button here if needed
                null
              )
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ title: 'Sign In' }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Create Account' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default AuthNavigator;