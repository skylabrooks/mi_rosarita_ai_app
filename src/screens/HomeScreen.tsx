import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useSelector, useDispatch} from 'react-redux';
import {useAuth} from '../hooks/useAuth';

// Redux imports
import {RootState} from '../store/index';
import {fetchDeals, fetchNearbyDeals} from '../store/thunks/dealsThunks';
import {generateItinerary} from '../store/thunks/itineraryThunks';
import {fetchUserItineraries} from '../store/thunks/itineraryThunks';

// Types
import {Deal} from '../types/services';

const HomeScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useAuth();

  // Redux state
  const { deals, nearbyDeals, isLoading: dealsLoading, error: dealsError } = useSelector(
    (state: RootState) => state.deals
  );
  const itineraries = useSelector((state: RootState) => state.itinerary.savedItineraries || []);

  const [refreshing, setRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load data on component mount
  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated, dispatch]);

  const loadInitialData = () => {
    // Fetch general deals
    dispatch(fetchDeals({ limit: 10 }));

    // Fetch nearby deals (using default coordinates for now)
    // In production, you'd get these from GPS
    dispatch(fetchNearbyDeals({
      latitude: 23.2521, // Default Rosarito coordinates
      longitude: -106.4107,
      radius: 5000
    }));

    // Fetch user's itineraries
    dispatch(fetchUserItineraries({}));
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadInitialData();
    setRefreshing(false);
  };

  const handleGenerateItinerary = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to generate personalized itineraries.'
      );
      return;
    }

    setIsGenerating(true);
    try {
      // For now, use basic itinerary request
      // In production, you'd collect user preferences first
      const itineraryRequest = {
        userId: user?.uid || '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
        preferences: {
          budget: 'medium' as const,
          travelStyle: ['relaxation', 'food'],
          interests: ['beach', 'food', 'sightseeing'],
          dietaryRestrictions: [],
          groupSize: 1,
        }
      };

      await dispatch(generateItinerary(itineraryRequest)).unwrap();

      Alert.alert(
        'Success!',
        'Your personalized itinerary has been generated!'
      );

      // Navigate to itinerary screen
      navigation.navigate('Itinerary' as never);

    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to generate itinerary. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleViewDeals = () => {
    // For now, just show the deals in an alert
    // In production, you'd navigate to a deals screen
    if (deals.length > 0) {
      const dealsText = deals.slice(0, 3).map(deal =>
        `• ${deal.title} - ${deal.businessName}`
      ).join('\n');

      Alert.alert(
        `Hot Deals in Rosarito (${deals.length} available)`,
        dealsText + (deals.length > 3 ? '\n\n...and more!' : ''),
        [
          { text: 'View All', onPress: () => {/* TODO: Navigate to deals screen */} },
          { text: 'OK', style: 'cancel' }
        ]
      );
    } else {
      Alert.alert(
        'No Deals Available',
        'Check back later for the latest deals!'
      );
    }
  };

  const handlePhotoAnalysis = () => {
    Alert.alert(
      'Photo Analysis',
      'This feature is coming soon! Capture photos during your trip to get AI-powered insights and memories.',
      [{ text: 'OK', style: 'cancel' }]
    );
  };

  // Render featured deals section
  const renderFeaturedDeals = () => {
    if (dealsLoading && deals.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Deals</Text>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>Loading deals...</Text>
          </View>
        </View>
      );
    }

    if (dealsError) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Deals</Text>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Failed to load deals</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (deals.length === 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Deals</Text>
          <Text style={styles.emptyText}>No deals available right now</Text>
        </View>
      );
    }

    // Show top 3 deals
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Deals</Text>
        {deals.slice(0, 3).map((deal) => (
          <TouchableOpacity
            key={deal.id}
            style={styles.dealCard}
            onPress={() => handleViewDeals()}
          >
            <Text style={styles.dealTitle}>{deal.title}</Text>
            <Text style={styles.dealBusiness}>{deal.businessName}</Text>
            <Text style={styles.dealDescription} numberOfLines={2}>
              {deal.description}
            </Text>
            <View style={styles.dealPrice}>
              <Text style={styles.originalPrice}>
                {deal.originalPrice ? `$${deal.originalPrice}` : ''}
              </Text>
              <Text style={styles.discountedPrice}>${deal.discountedPrice}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {deals.length > 3 && (
          <TouchableOpacity style={styles.viewAllButton} onPress={handleViewDeals}>
            <Text style={styles.viewAllButtonText}>View All Deals</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render user greeting
  const renderGreeting = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    if (isAuthenticated && user) {
      return `${greeting}, ${user.displayName || 'traveler'}!`;
    }
    return `${greeting}! Welcome to Rosarito`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Mi Rosarita AI</Text>
          <Text style={styles.subtitle}>
            {renderGreeting()}
          </Text>
        </View>

        {/* Featured Deals Section */}
        {renderFeaturedDeals()}

        <View style={styles.featuresContainer}>
          <TouchableOpacity
            style={[styles.featureCard, isGenerating && styles.featureCardDisabled]}
            onPress={handleGenerateItinerary}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3498db" />
                <Text style={styles.featureTitle}>Generating...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.featureTitle}>🗺️ AI Itinerary</Text>
                <Text style={styles.featureDescription}>
                  Get personalized travel plans powered by AI
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureCard}
            onPress={handleViewDeals}>
            <Text style={styles.featureTitle}>💰 Local Deals</Text>
            <Text style={styles.featureDescription}>
              {deals.length > 0
                ? `${deals.length} deals available in Rosarito`
                : 'Discover exclusive offers from Rosarito businesses'
              }
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.featureCard}
            onPress={handlePhotoAnalysis}>
            <Text style={styles.featureTitle}>📸 Memory Maker</Text>
            <Text style={styles.featureDescription}>
              Analyze your travel photos with AI
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, itineraries.length === 0 && styles.buttonDisabled]}
            onPress={() => navigation.navigate('Itinerary' as never)}
            disabled={itineraries.length === 0}
          >
            <Text style={styles.secondaryButtonText}>
              {itineraries.length > 0 ? `My Itineraries (${itineraries.length})` : 'No Itineraries Yet'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Profile' as never)}>
            <Text style={styles.secondaryButtonText}>
              {isAuthenticated ? 'My Profile' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  dealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  dealBusiness: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  dealDescription: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 12,
    lineHeight: 20,
  },
  dealPrice: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 14,
    color: '#95a5a6',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountedPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e74c3c',
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  featureCardDisabled: {
    opacity: 0.7,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 20,
  },
  quickActions: {
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    opacity: 0.6,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7f8c8d',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    padding: 20,
  },
  retryButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewAllButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  viewAllButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default HomeScreen;