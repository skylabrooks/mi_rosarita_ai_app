import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: 'Travel Enthusiast',
    email: 'user@example.com',
    bio: 'Love exploring new places and creating unforgettable memories!',
    interests: ['Beach Activities', 'Local Cuisine', 'Adventure Sports'],
    language: 'English',
  });

  const handleSaveProfile = () => {
    // TODO: Save profile to Redux store or Firebase
    setIsEditing(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement logout logic
            Alert.alert('Coming Soon', 'Logout functionality will be available soon!');
          },
        },
      ],
    );
  };

  const handlePrivacySettings = () => {
    Alert.alert('Coming Soon', 'Privacy settings will be available soon!');
  };

  const handleNotificationSettings = () => {
    Alert.alert('Coming Soon', 'Notification settings will be available soon!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditing(!isEditing)}>
          <Text style={styles.editButtonText}>
            {isEditing ? 'Cancel' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>

          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.input}
                value={profile.name}
                onChangeText={(text) =>
                  setProfile({...profile, name: text})
                }
                placeholder="Name"
              />
              <TextInput
                style={styles.input}
                value={profile.email}
                onChangeText={(text) =>
                  setProfile({...profile, email: text})
                }
                placeholder="Email"
                keyboardType="email-address"
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={profile.bio}
                onChangeText={(text) =>
                  setProfile({...profile, bio: text})
                }
                placeholder="Bio"
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profile.name}</Text>
              <Text style={styles.email}>{profile.email}</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          )}
        </View>

        <View style={styles.preferencesSection}>
          <Text style={styles.sectionTitle}>Travel Preferences</Text>

          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Interests:</Text>
            <Text style={styles.preferenceValue}>
              {profile.interests.join(', ')}
            </Text>
          </View>

          <View style={styles.preferenceItem}>
            <Text style={styles.preferenceLabel}>Language:</Text>
            <Text style={styles.preferenceValue}>{profile.language}</Text>
          </View>
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handlePrivacySettings}>
            <Text style={styles.settingText}>🔒 Privacy Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={handleNotificationSettings}>
            <Text style={styles.settingText}>🔔 Notifications</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, styles.logoutItem]}
            onPress={handleLogout}>
            <Text style={[styles.settingText, styles.logoutText]}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Travel Stats</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Deals Used</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Photos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </View>
          </View>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Mi Rosarita AI v1.0.0</Text>
          <Text style={styles.appDescription}>
            Your AI-powered travel companion for discovering Rosarito
          </Text>
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
  editButton: {
    padding: 8,
  },
  editButtonText: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  profileInfo: {
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: '#34495e',
    textAlign: 'center',
    lineHeight: 20,
  },
  editContainer: {
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  preferencesSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '600',
  },
  preferenceValue: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  settingsSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 16,
  },
  settingItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  settingText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#e74c3c',
  },
  statsSection: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    width: '45%',
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3498db',
  },
  statLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 4,
  },
  appInfo: {
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
  },
  appVersion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ProfileScreen;