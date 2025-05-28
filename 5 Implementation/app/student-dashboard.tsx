import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, BackHandler, Alert, Animated, Dimensions, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Course, getCourses } from '../lib/api';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { API_CONFIG } from '../config';

const { width } = Dimensions.get('window');

SplashScreen.preventAutoHideAsync();

export default function StudentDashboard() {
  const params = useLocalSearchParams();
  const currentUserId = params.id as string;
  
  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const [currentScanningCourse, setCurrentScanningCourse] = useState<Course | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogoutConfirm(true);
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    checkPermissions();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      setIsLoading(true);
      const allCourses = await getCourses();
      console.log('Current Student ID:', currentUserId);
      console.log('All Courses:', allCourses);
      
      const enrolledCourses = allCourses.filter((course: Course) => {
        console.log('Course Students:', course.students);
        return course.students && course.students.includes(currentUserId);
      });
      
      console.log('Enrolled Courses:', enrolledCourses);
      setCourses(enrolledCourses);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      setError('Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (err) {
      console.error('Error checking permissions:', err);
      Alert.alert('Error', 'Failed to access camera');
    }
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    try {
      setScanned(true);

      console.log('Scanned QR data:', data);

      // Parse the QR data to get the course information
      let qrDataObj;
      try {
        qrDataObj = JSON.parse(data);
        console.log('Parsed QR data:', qrDataObj);
      } catch (e) {
        console.error('Failed to parse QR data:', e);
        throw new Error('Invalid QR code format');
      }

      // Verify the QR code is for the correct course
      if (!currentScanningCourse) {
        throw new Error('Course information not available');
      }

      console.log('Current scanning course:', currentScanningCourse);
      console.log('QR course ID:', qrDataObj.courseId);
      console.log('Scanning course ID:', currentScanningCourse._id);

      // Strict comparison of course IDs
      if (qrDataObj.courseId !== currentScanningCourse._id) {
        throw new Error(`This QR code is for ${qrDataObj.courseCode || 'another course'}. You are trying to mark attendance for ${currentScanningCourse.courseCode}.`);
      }

      // Verify the student is enrolled in this course
      const isEnrolled = courses.some(course => 
        course._id === qrDataObj.courseId && 
        course.students && 
        course.students.includes(currentUserId)
      );

      if (!isEnrolled) {
        throw new Error(`You are not enrolled in ${qrDataObj.courseCode || 'this course'}. Attendance cannot be marked.`);
      }

      // Check if QR code has expired
      if (qrDataObj.expiresAt) {
        const expiryTime = new Date(qrDataObj.expiresAt);
        const currentTime = new Date();
        
        if (currentTime > expiryTime) {
          throw new Error('This QR code has expired. Please ask your lecturer to generate a new one.');
        }
      }

      // Send scan to backend
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          qrData: data,
          studentId: currentUserId,
          intendedCourseId: currentScanningCourse._id, // Send the intended course ID for additional validation
          courseCode: currentScanningCourse.courseCode // Send course code for better error messages
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to record attendance');
      }

      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        setScannerVisible(false);
        setScanned(false);
        setCurrentScanningCourse(null); // Reset current scanning course
      }, 2000);
    } catch (error: any) {
      console.error('Error scanning QR code:', error);
      setErrorMessage(error.message === 'Network request failed' 
        ? 'Unable to connect to the server. Please check your internet connection.'
        : error.message || 'Failed to record attendance');
      setShowErrorModal(true);
      setScanned(false);
    }
  };

  const handleScanPress = (course: Course) => {
    if (hasPermission === null) {
      Alert.alert('Error', 'Requesting camera permission...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert('Error', 'No access to camera');
      return;
    }
    setCurrentScanningCourse(course); // Set the current course for which attendance is being marked
    setScannerVisible(true);
  };

  const startScanAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    router.replace('/');
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const CourseCard = ({ course }: { course: Course }) => {
    return (
      <View style={styles.courseCard}>
        <View style={styles.courseHeader}>
          <View style={styles.courseTitleSection}>
            <Text style={styles.courseCode}>{course.courseCode}</Text>
            <Text style={styles.courseTitle} numberOfLines={1}>{course.courseName}</Text>
          </View>
          <View style={styles.courseActions}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.scanButton]}
              onPress={() => handleScanPress(course)}
            >
              <Ionicons name="scan-outline" size={20} color="#218c4a" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.courseInfo}>
          <View style={styles.instructorSection}>
            <Ionicons name="person-circle-outline" size={20} color="#666" />
            <Text style={styles.instructorText}>
              {course.lecturerId ? `${course.lecturerId.firstName} ${course.lecturerId.lastName}` : 'Not assigned'}
            </Text>
          </View>

          <View style={styles.schedulesContainer}>
            {course.schedules.map((schedule, scheduleIndex) => (
              <View 
                key={scheduleIndex} 
                style={styles.scheduleItem}
              >
                <View style={styles.scheduleTime}>
                  <Ionicons name="time-outline" size={16} color="#218c4a" />
                  <Text style={styles.timeText}>{schedule.startTime} - {schedule.endTime}</Text>
                </View>
                <View style={styles.scheduleDays}>
                  {schedule.days.map((day, dayIndex) => (
                    <View key={dayIndex} style={styles.dayPill}>
                      <Text style={styles.dayText}>{day}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundPattern}>
        <View style={styles.patternCircle1} />
        <View style={styles.patternCircle2} />
        <View style={styles.patternCircle3} />
      </View>

      <View style={styles.accentBar} />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.logoTitle}>ATTENDANCE</Text>
              <Text style={styles.logoSubtitle}>Student Dashboard</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={32} color="#218c4a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchEnrolledCourses}
            colors={['#1a4b8e']}
            tintColor="#1a4b8e"
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#1a4b8e" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No enrolled courses found</Text>
          </View>
        ) : (
          courses.map((course) => (
            <CourseCard key={course._id} course={course} />
          ))
        )}
      </ScrollView>

      {isScannerVisible && (
        <View style={styles.scannerOverlayContainer}>
          <LinearGradient
            colors={['#fff', '#fff']}
            style={styles.scannerGradient}
          >
            <View style={styles.scannerHeader}>
              <TouchableOpacity
                style={styles.closeScannerButton}
                onPress={() => {
                  setScannerVisible(false);
                  setScanned(false);
                  setCurrentScanningCourse(null);
                }}
              >
                <Ionicons name="close" size={24} color="#218c4a" />
              </TouchableOpacity>
              <View style={styles.scannerTitleContainer}>
                <Text style={styles.scannerTitle}>Scan QR Code</Text>
                <Text style={styles.scannerSubtitle}>
                  {currentScanningCourse ? currentScanningCourse.courseCode : ''} - Position the code within the frame
                </Text>
              </View>
              <View style={styles.closeScannerButton} />
            </View>
            
            <View style={styles.scannerContent}>
              <View style={styles.scannerFrame}>
                <View style={styles.scannerBox}>
                  <CameraView
                    style={styles.camera}
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  />
                  <View style={styles.scannerOverlay}>
                    <View style={styles.scannerCornerTopLeft} />
                    <View style={styles.scannerCornerTopRight} />
                    <View style={styles.scannerCornerBottomLeft} />
                    <View style={styles.scannerCornerBottomRight} />
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [
                            {
                              translateY: scanLineAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, width * 0.85],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                </View>
                
                {scanned && (
                  <TouchableOpacity
                    style={styles.scanAgainButton}
                    onPress={() => setScanned(false)}
                  >
                    <Ionicons name="refresh" size={24} color="#fff" />
                    <Text style={styles.scanAgainText}>Scan Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.successModal]}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={64} color="#218c4a" />
            </View>
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successText}>Attendance marked successfully</Text>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.errorModal]}>
            <View style={styles.errorIconContainer}>
              <Ionicons name="alert-circle" size={64} color="#218c4a" />
            </View>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessageText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.errorButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <Ionicons name="log-out-outline" size={48} color="#218c4a" />
              <Text style={styles.confirmTitle}>Confirm Logout</Text>
            </View>
            
            <Text style={styles.confirmText}>
              Are you sure you want to logout?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.logoutConfirmButton]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
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
    backgroundColor: '#218c4a',
    height: 4,
    marginTop: 32,
    marginBottom: 18,
  },
  header: {
    backgroundColor: 'transparent',
    padding: 0,
    marginTop: 32,
    marginBottom: 18,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 500,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'column',
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
  logoutButton: {
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
  content: {
    flex: 1,
    padding: 20,
  },
  loader: {
    marginTop: 20,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 20,
    padding: 20,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  courseTitleSection: {
    flex: 1,
    marginRight: 12,
  },
  courseCode: {
    fontSize: 16,
    color: '#218c4a',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#218c4a',
    lineHeight: 24,
  },
  courseActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderColor: '#218c4a',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 3,
  },
  scanButton: {
    backgroundColor: '#fff',
    borderColor: '#218c4a',
    borderWidth: 2,
  },
  courseInfo: {
    gap: 12,
  },
  instructorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  instructorText: {
    fontSize: 15,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
  schedulesContainer: {
    marginTop: 10,
  },
  scheduleItem: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 6,
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    color: '#218c4a',
    marginLeft: 8,
    fontWeight: '600',
  },
  scheduleDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayPill: {
    backgroundColor: 'rgba(33, 140, 74, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayText: {
    fontSize: 12,
    color: '#218c4a',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
  },
  confirmModal: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginTop: 8,
  },
  confirmText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 24,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelConfirmButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logoutConfirmButton: {
    backgroundColor: '#218c4a',
  },
  cancelConfirmText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  scannerOverlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  scannerGradient: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  scannerTitleContainer: {
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#218c4a',
    fontFamily: 'THEDISPLAYFONT',
    marginBottom: 4,
  },
  scannerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeScannerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scannerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  scannerFrame: {
    width: '100%',
    alignItems: 'center',
    gap: 24,
  },
  scannerBox: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#fff',
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerCornerTopLeft: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#218c4a',
    borderTopLeftRadius: 12,
  },
  scannerCornerTopRight: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#218c4a',
    borderTopRightRadius: 12,
  },
  scannerCornerBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#218c4a',
    borderBottomLeftRadius: 12,
  },
  scannerCornerBottomRight: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#218c4a',
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 3,
    backgroundColor: '#218c4a',
    opacity: 0.8,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#218c4a',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(33, 140, 74, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(33, 140, 74, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 8,
  },
  errorMessageText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#218c4a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 