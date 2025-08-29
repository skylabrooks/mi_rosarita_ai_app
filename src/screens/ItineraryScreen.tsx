import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

interface ItineraryItem {
  id: string;
  title: string;
  description: string;
  location: string;
  time: string;
  duration: string;
  cost?: number;
  category: 'food' | 'activity' | 'transport' | 'accommodation' | 'shopping';
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

interface Itinerary {
  id: string;
  title: string;
  date: string;
  duration: number;
  items: ItineraryItem[];
  totalCost?: number;
  createdAt: string;
  updatedAt: string;
  weather?: {
    temperature: number;
    condition: string;
    recommendation: string;
  };
}

const ItineraryScreen = () => {
  const navigation = useNavigation();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // TODO: Load itinerary from Redux store or Firebase
    loadSampleItinerary();
  }, []);

  const loadSampleItinerary = () => {
    // Sample itinerary data for demonstration
    const sampleItinerary: Itinerary = {
      id: 'sample_1',
      title: 'Rosarito Adventure - 3 Days',
      date: new Date().toISOString().split('T')[0],
      duration: 3,
      items: [
        {
          id: '1',
          title: 'Welcome to Rosarito!',
          description: 'Arrive in Rosarito and check into your accommodation. Take some time to relax and explore the immediate surroundings.',
          location: 'Downtown Rosarito',
          time: 'Morning',
          duration: '2 hours',
          category: 'transport',
        },
        {
          id: '2',
          title: 'Puerto Nuevo Lobster Lunch',
          description: 'Enjoy fresh lobster at one of Rosarito\'s famous Puerto Nuevo restaurants. A must-try local delicacy!',
          location: 'Puerto Nuevo',
          time: 'Afternoon',
          duration: '2 hours',
          cost: 25,
          category: 'food',
        },
        {
          id: '3',
          title: 'Beach Time & Surfing',
          description: 'Relax on Rosarito\'s beautiful beaches or try surfing lessons if you\'re feeling adventurous.',
          location: 'Rosarito Beach',
          time: 'Evening',
          duration: '3 hours',
          category: 'activity',
        },
      ],
      totalCost: 150,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      weather: {
        temperature: 22,
        condition: 'Sunny',
        recommendation: 'Perfect weather for beach activities!',
      },
    };

    setItinerary(sampleItinerary);
  };

  const handleGenerateNewItinerary = () => {
    setIsLoading(true);
    // TODO: Implement AI itinerary generation
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        'Coming Soon',
        'AI-powered itinerary generation will be available soon!',
      );
    }, 2000);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food':
        return '🍽️';
      case 'activity':
        return '🏄';
      case 'transport':
        return '🚗';
      case 'accommodation':
        return '🏨';
      case 'shopping':
        return '🛍️';
      default:
        return '📍';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'food':
        return '#e74c3c';
      case 'activity':
        return '#27ae60';
      case 'transport':
        return '#3498db';
      case 'accommodation':
        return '#9b59b6';
      case 'shopping':
        return '#f39c12';
      default:
        return '#95a5a6';
    }
  };

  if (!itinerary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading itinerary...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Itinerary</Text>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateNewItinerary}
          disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.generateButtonText}>Generate New</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.itineraryHeader}>
          <Text style={styles.itineraryTitle}>{itinerary.title}</Text>
          <Text style={styles.itineraryDate}>
            {new Date(itinerary.date).toLocaleDateString()} • {itinerary.duration} days
          </Text>
          {itinerary.weather && (
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherText}>
                🌤️ {itinerary.weather.temperature}°C • {itinerary.weather.condition}
              </Text>
              <Text style={styles.weatherRecommendation}>
                {itinerary.weather.recommendation}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.itemsContainer}>
          {itinerary.items.map((item, index) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View
                  style={[
                    styles.categoryIcon,
                    {backgroundColor: getCategoryColor(item.category)},
                  ]}>
                  <Text style={styles.categoryIconText}>
                    {getCategoryIcon(item.category)}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>
                    {item.time} • {item.duration}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemDescription}>{item.description}</Text>
              <View style={styles.itemFooter}>
                <Text style={styles.itemLocation}>📍 {item.location}</Text>
                {item.cost && (
                  <Text style={styles.itemCost}>💰 ${item.cost}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {itinerary.totalCost && (
          <View style={styles.totalCost}>
            <Text style={styles.totalCostText}>
              Total Estimated Cost: ${itinerary.totalCost}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#3498db',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  generateButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  scrollView: {
    flex: 1,
  },
  itineraryHeader: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 16,
  },
  itineraryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  itineraryDate: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 16,
  },
  weatherInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  weatherText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  weatherRecommendation: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  itemsContainer: {
    padding: 16,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    fontSize: 16,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  itemTime: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  itemDescription: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
    marginBottom: 12,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLocation: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  itemCost: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: '600',
  },
  totalCost: {
    backgroundColor: '#ffffff',
    padding: 20,
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalCostText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
});

export default ItineraryScreen;