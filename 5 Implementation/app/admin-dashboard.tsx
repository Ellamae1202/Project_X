import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, BackHandler, Animated, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { getUsers, getCourses } from '../lib/api';
import { LineChart, BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');

export default function AdminDashboard() {
  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ firstName: string; lastName: string } | null>(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCourses: 0,
    totalStudents: 0,
    totalLecturers: 0,
  });

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogoutConfirm(true);
      return true;
    });

    return () => backHandler.remove();
  }, []);

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    fetchDashboardStats();
    fetchCurrentUser();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setIsLoading(true);
      const [users, courses] = await Promise.all([
        getUsers(),
        getCourses()
      ]);

      const totalStudents = users.filter(user => user.role === 'student').length;
      const totalLecturers = users.filter(user => user.role === 'lecturer').length;
      const activeCourses = courses.length;

      setStats({
        totalUsers: users.length,
        activeCourses,
        totalStudents,
        totalLecturers,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUserData = JSON.parse(userData);
        setCurrentUser({
          firstName: parsedUserData.firstName,
          lastName: parsedUserData.lastName
        });
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    router.replace('/');
  };

  const handleManageUsers = () => {
    router.push('/manage-users');
  };

  const handleManageCourses = () => {
    router.push('/manage-courses');
  };

  const handleManageReports = () => {
    router.push('/reports');
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const navigationItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'home' as const,
      onPress: () => setActiveTab('dashboard'),
    },
    {
      id: 'users',
      title: 'Users',
      icon: 'people' as const,
      onPress: handleManageUsers,
    },
    {
      id: 'courses',
      title: 'Courses',
      icon: 'book' as const,
      onPress: handleManageCourses,
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: 'bar-chart' as const,
      onPress: handleManageReports,
    }
  ];

  const renderStatCard = (icon: string, value: number, label: string, color: string) => (
    <View style={styles.statCard}>
      <View style={styles.statHeader}>
        <View style={[styles.statIcon, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={24} color="#fff" />
        </View>
        <View style={styles.statInfo}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.backgroundPattern}>
        <View style={styles.patternCircle1} />
        <View style={styles.patternCircle2} />
        <View style={styles.patternCircle3} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.accentBar} />
        <View style={styles.headerTitleOnlyContainer}>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoTitle}>ATTENDANCE TRACKER</Text>
              <Text style={styles.logoSubtitle}>Admin Dashboard</Text>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButtonHeader} activeOpacity={0.8}>
              <Ionicons name="log-out-outline" size={32} color="#218c4a" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contentCentered}>
          <View style={styles.welcomeContainerCentered}>
            <Text style={styles.welcomeTitleCentered}>
              Welcome {currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Admin'}!
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#218c4a" />
            </View>
          ) : (
            <View style={styles.statsContainerCentered}>
              {renderStatCard('people', stats.totalUsers, 'Total Users', '#218c4a')}
              {renderStatCard('book', stats.activeCourses, 'Active Courses', '#34C759')}
              {renderStatCard('school', stats.totalStudents, 'Students', '#FF9500')}
              {renderStatCard('person', stats.totalLecturers, 'Lecturers', '#5856D6')}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        {navigationItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.navItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={item.icon}
                size={24}
                color={activeTab === item.id ? '#218c4a' : '#666'}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.logoutModalContentDashboard}>
            <View style={styles.logoutModalIconContainerDashboard}>
              <Ionicons name="log-out-outline" size={48} color="#fff" />
            </View>
            <Text style={styles.logoutModalTitleDashboard}>Confirm Logout</Text>
            <Text style={styles.logoutModalMessageDashboard}>Are you sure you want to logout?</Text>
            <View style={styles.logoutModalButtonsDashboard}>
              <TouchableOpacity
                style={[styles.logoutModalButtonDashboard, styles.logoutCancelButtonDashboard]}
                onPress={() => setShowLogoutConfirm(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutCancelTextDashboard}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalButtonDashboard, styles.logoutSubmitButtonDashboard]}
                onPress={handleConfirmLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutSubmitTextDashboard}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle1: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(33, 140, 74, 0.08)',
    top: -width * 0.2,
    right: -width * 0.2,
  },
  patternCircle2: {
    position: 'absolute',
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: 'rgba(33, 140, 74, 0.06)',
    bottom: -width * 0.1,
    left: -width * 0.1,
  },
  patternCircle3: {
    position: 'absolute',
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    backgroundColor: 'rgba(33, 140, 74, 0.05)',
    top: '30%',
    left: '20%',
  },
  accentBar: {
    height: 90,
    backgroundColor: '#218c4a',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: 0,
  },
  headerTitleOnlyContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 18,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 500,
    paddingHorizontal: 16,
  },
  logoTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 2,
    letterSpacing: 2,
  },
  logoSubtitle: {
    fontSize: 15,
    color: '#218c4a',
    opacity: 0.7,
  },
  contentCentered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  welcomeContainerCentered: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeTitleCentered: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitleCentered: {
    fontSize: 16,
    color: '#218c4a',
    opacity: 0.7,
    textAlign: 'center',
  },
  statsContainerCentered: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    marginHorizontal: 8,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  chartContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 140, 74, 0.1)',
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoutModalContentDashboard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 32,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  logoutModalIconContainerDashboard: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#218c4a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutModalTitleDashboard: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 8,
    textAlign: 'center',
  },
  logoutModalMessageDashboard: {
    fontSize: 16,
    color: '#218c4a',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  logoutModalButtonsDashboard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  logoutModalButtonDashboard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  logoutCancelButtonDashboard: {
    backgroundColor: '#e9fbe5',
  },
  logoutSubmitButtonDashboard: {
    backgroundColor: '#218c4a',
  },
  logoutCancelTextDashboard: {
    color: '#218c4a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutSubmitTextDashboard: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButtonHeader: {
    backgroundColor: 'rgba(33, 140, 74, 0.08)',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
}); 