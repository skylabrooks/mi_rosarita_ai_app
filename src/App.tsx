import React from 'react';
import {Provider} from 'react-redux';
import {NavigationContainer} from '@react-navigation/native';
import {store} from './store';
import {AuthProvider} from './contexts/AuthContext';
import AuthNavigator from './navigation/AuthNavigator';

export default function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <NavigationContainer>
          <AuthNavigator />
        </NavigationContainer>
      </AuthProvider>
    </Provider>
  );
}