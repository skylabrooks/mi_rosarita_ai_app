import React from 'react';
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullScreen?: boolean;
}

const Loading: React.FC<LoadingProps> = ({
  text = 'Loading...',
  size = 'large',
  color = '#3498db',
  style,
  textStyle,
  fullScreen = false,
}) => {
  const containerStyle = fullScreen
    ? [styles.fullScreenContainer, style]
    : [styles.container, style];

  return (
    <View style={containerStyle}>
      <ActivityIndicator size={size} color={color} />
      {text && (
        <Text style={[styles.text, textStyle]}>{text}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  text: {
    marginTop: 12,
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
  },
});

export default Loading;