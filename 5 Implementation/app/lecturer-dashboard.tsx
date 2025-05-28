import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, BackHandler, Alert, TextInput, RefreshControl, Platform, Vibration, Dimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Course, getCourses } from '../lib/api';
import QRCode from 'react-native-qrcode-svg';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { API_CONFIG } from '../config';

const { width } = Dimensions.get('window');

// Function to get current Philippine time
const getPhilippineTime = () => {
  const now = new Date();
  // Get the current UTC time
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Convert to Philippine time (UTC+8)
  const phTime = new Date(utcTime + (8 * 60 * 60 * 1000));

  // Format the time to ensure accuracy
  const hours = phTime.getHours().toString().padStart(2, '0');
  const minutes = phTime.getMinutes().toString().padStart(2, '0');
  const seconds = phTime.getSeconds().toString().padStart(2, '0');

  // Create a new date with the exact Philippine time
  const exactPhTime = new Date(phTime.getFullYear(), phTime.getMonth(), phTime.getDate(),
    parseInt(hours), parseInt(minutes), parseInt(seconds));

  return exactPhTime;
};

// Function to format time in Philippine timezone
const formatPhilippineTime = (timestamp: string) => {
  try {
    // Parse the ISO string timestamp directly
    const date = new Date(timestamp);
    
    // Extract time directly from the timestamp without adding 8 hours
    const match = timestamp.match(/T(\d{2}):(\d{2})/);
    if (match) {
      const hours24 = parseInt(match[1], 10);
      const minutes = match[2];
      
      // Convert to 12-hour format
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      
      // Return formatted string - display the database time directly
      return `${hours12}:${minutes} ${ampm}`;
    }
    
    // Fallback if regex fails
    const hours = date.getUTCHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    return `${hours12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// Function to format date from database timestamp
const formatPhilippineDate = (timestamp: string) => {
  try {
    // Parse the ISO string timestamp directly
    const date = new Date(timestamp);
    
    // Extract date directly from the timestamp without timezone adjustment
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Months are 0-based in JS
      const day = parseInt(match[3], 10);
      
      // Create a Date object with these values to get day of week
      const dateObj = new Date(year, month, day);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
      
      // Get month name
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
      
      // Return formatted string
      return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
    }
    
    // Fallback if regex fails
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    
    return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// Function to format date and time for session tabs
const formatSessionTabTime = (timestamp: string) => {
  try {
    // Extract date and time directly from the timestamp without timezone adjustment
    const dateMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = timestamp.match(/T(\d{2}):(\d{2})/);
    
    if (dateMatch && timeMatch) {
      // Parse date components
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // Months are 0-based in JS
      const day = parseInt(dateMatch[3], 10);
      
      // Parse time components
      const hours24 = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      
      // Convert to 12-hour format
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      
      // Get abbreviated month name
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Return formatted string - display the database time directly
      return `${months[month]} ${day}, ${hours12}:${minutes} ${ampm}`;
    }
    
    // Fallback if regex fails - use direct UTC methods
    const date = new Date(timestamp);
    
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    // Format time for display
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    
    // Get abbreviated month name
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${months[month]} ${day}, ${hours12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting session tab time:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// WebSocket connection setup
const setupWebSocket = (courseId: string, onNewScan: () => void) => {
  const wsUrl = API_CONFIG.baseURL.replace('http', 'ws');
  const ws = new WebSocket(`${wsUrl}/attendance/${courseId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'new_scan') {
      onNewScan();
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  return ws;
};

SplashScreen.preventAutoHideAsync();

export default function LecturerDashboard() {
  const params = useLocalSearchParams();
  const currentUserId = params.id as string;

  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      fetchAssignedCourses();
    }
  }, [currentUserId]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogoutConfirm(true);
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  const fetchAssignedCourses = async () => {
    try {
      setIsLoading(true);
      const allCourses = await getCourses();
      console.log('Current Lecturer ID:', currentUserId);
      console.log('All Courses:', allCourses);

      const assignedCourses = allCourses.filter((course: Course) => {
        console.log('Course Lecturer ID:', course.lecturerId?._id);
        return course.lecturerId?._id === currentUserId;
      });

      console.log('Assigned Courses:', assignedCourses);
      setCourses(assignedCourses);
      setError(null);
    } catch (error) {
      console.error('Error fetching assigned courses:', error);
      setError('Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
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

  const handleRefresh = () => {
    fetchAssignedCourses();
  };

  const generateQRData = (course: Course) => {
    const phTime = getPhilippineTime();
    const expiryTime = new Date(phTime.getTime() + (60 * 60 * 1000)); // 1 hour from now

    return JSON.stringify({
      courseId: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      generatedAt: phTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    });
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.logoTitle}>ATTENDANCE</Text>
              <Text style={styles.logoSubtitle}>Lecturer Dashboard</Text>
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
            onRefresh={handleRefresh}
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
            <Text style={styles.emptyStateText}>No assigned courses found</Text>
          </View>
        ) : (
          courses.map((course) => (
            <CourseCard key={course._id} course={course} />
          ))
        )}
      </ScrollView>

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

const CourseCard = ({ course }: { course: Course }) => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [qrData, setQRData] = useState<{ data: string; expiresAt: string } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [newScans, setNewScans] = useState(0);
  const qrRef = useRef<any>(null);
  const countdownInterval = useRef<NodeJS.Timeout>();
  const wsRef = useRef<WebSocket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lastCheckTime = useRef<Date>(new Date());

  // Setup WebSocket connection
  useEffect(() => {
    const handleNewScan = async () => {
      try {
        const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
        if (!response.ok) return;

        const records = await response.json();
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        // Count scans in the last 5 minutes
        const recentScans = records.reduce((count: number, record: any) => {
          const recordTime = new Date(record.generatedAt);
          const timeDiff = phTime.getTime() - recordTime.getTime();
          if (timeDiff <= 5 * 60 * 1000) { // 5 minutes
            return count + record.scannedBy.length;
          }
          return count;
        }, 0);

        setNewScans(recentScans);
      } catch (error) {
        console.error('Error checking new scans:', error);
      }
    };

    // Initialize WebSocket connection
    wsRef.current = setupWebSocket(course._id, handleNewScan);

    // Cleanup WebSocket connection
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [course._id]);

  // Check for existing valid QR code
  const checkExistingQRCode = async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const records = await response.json();

      // Find the most recent valid QR code
      const now = new Date();
      const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
      const validRecord = records.find((record: any) => new Date(record.expiresAt) > phTime);

      if (validRecord) {
        setQRData({
          data: validRecord.qrCodeData,
          expiresAt: validRecord.expiresAt
        });
        setShowQRModal(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking existing QR code:', error);
      return false;
    }
  };

  useEffect(() => {
    if (qrData) {
      // Start countdown timer
      countdownInterval.current = setInterval(() => {
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
        const expiryTime = new Date(qrData.expiresAt);
        const diffInMinutes = Math.floor((expiryTime.getTime() - phTime.getTime()) / (1000 * 60));

        if (diffInMinutes <= 0) {
          setRemainingTime('expired');
          clearInterval(countdownInterval.current);
        } else {
          const hours = Math.floor(diffInMinutes / 60);
          const minutes = diffInMinutes % 60;
          if (hours > 0) {
            setRemainingTime(`${hours}h ${minutes}m`);
          } else {
            setRemainingTime(`${minutes} minutes`);
          }
        }
      }, 1000);

      return () => {
        if (countdownInterval.current) {
          clearInterval(countdownInterval.current);
        }
      };
    }
  }, [qrData]);

  const generateQRData = async () => {
    try {
      setIsLoading(true);
      if (!course.lecturerId?._id) {
        throw new Error('Lecturer ID not found');
      }

      // Calculate expiration time (1 hour from now)
      const now = new Date();
      const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // Current PH time
      const expiryTime = new Date(phTime.getTime() + (60 * 60 * 1000)); // 1 hour from now

      const response = await fetch(`${API_CONFIG.baseURL}/attendance/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course._id,
          lecturerId: course.lecturerId._id,
          expiresAt: expiryTime.toISOString() // Explicitly set expiration time
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const data = await response.json();
      
      // Use our calculated expiration time
      return {
        data: data.qrData,
        expiresAt: expiryTime.toISOString()
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    const hasValidQR = await checkExistingQRCode();
    if (!hasValidQR) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmGenerateQR = async () => {
    setShowConfirmModal(false);
    const newQRData = await generateQRData();
    if (newQRData) {
      setQRData(newQRData);
      setShowQRModal(true);
    }
  };

  // Check for new scans
  useEffect(() => {
    const checkNewScans = async () => {
      try {
        const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
        if (!response.ok) return;

        const records = await response.json();
        const now = new Date();
        const phTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));

        // Get the most recent record
        const mostRecentRecord = records.sort((a: any, b: any) =>
          new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
        )[0];

        if (mostRecentRecord) {
          const recordTime = new Date(mostRecentRecord.generatedAt);
          const timeDiff = phTime.getTime() - recordTime.getTime();

          // If the record is from the last 5 minutes
          if (timeDiff <= 5 * 60 * 1000) {
            const scanCount = mostRecentRecord.scannedBy.length;
            if (scanCount > newScans) {
              setNewScans(scanCount);
              // Vibrate or play sound to notify
              if (Platform.OS === 'android') {
                Vibration.vibrate(500);
              }
            }
          } else {
            setNewScans(0);
          }
        }

        lastCheckTime.current = now;
      } catch (error) {
        console.error('Error checking new scans:', error);
      }
    };

    // Check every 3 seconds
    const interval = setInterval(checkNewScans, 3000);
    return () => clearInterval(interval);
  }, [course._id]);

  // Reset new scans count when viewing attendance
  const handleViewAttendance = async () => {
    setNewScans(0);
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const records = await response.json();

      // Sort records by generation time (most recent first)
      const sortedRecords = records.sort((a: any, b: any) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );

      setAttendanceRecords(sortedRecords);
      setShowAttendanceModal(true);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      Alert.alert('Error', 'Failed to fetch attendance records. Please try again.');
    }
  };

  const handleSaveQRCode = async () => {
    try {
      // Request permission to access media library
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant permission to save QR code to your gallery.');
        return;
      }

      if (qrRef.current) {
        const uri = await qrRef.current.capture();
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('CHEQR', asset, false);

        Alert.alert('Success', 'QR code saved to gallery successfully!');
      }
    } catch (error) {
      console.error('Error saving QR code:', error);
      Alert.alert('Error', 'Failed to save QR code to gallery.');
    }
  };

  const filteredRecords = attendanceRecords.map(record => {
    const filteredScans = record.scannedBy.filter((scan: any) => {
      const fullName = `${scan.studentId.firstName} ${scan.studentId.lastName}`.toLowerCase();
      const idNumber = scan.studentId.idNumber.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || idNumber.includes(query);
    });
    return { ...record, scannedBy: filteredScans };
  }).filter(record => record.scannedBy.length > 0);

  const handleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <View style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <View style={styles.courseTitleSection}>
          <Text style={styles.courseCode}>{course.courseCode}</Text>
          <Text style={styles.courseTitle} numberOfLines={1}>{course.courseName}</Text>
        </View>
        <View style={styles.courseActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.qrButton]}
            onPress={handleGenerateQR}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#218c4a" />
            ) : (
              <Ionicons name="qr-code-outline" size={20} color="#218c4a" />
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.attendanceButton]}
            onPress={handleViewAttendance}
          >
            <View>
              <Ionicons name="people-outline" size={20} color="#218c4a" />
              {newScans > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationText}>{newScans}</Text>
                </View>
              )}
            </View>
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
                <Ionicons name="time-outline" size={16} color="#1a73e8" />
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

      {/* QR Code Generation Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <Ionicons name="qr-code-outline" size={48} color="#218c4a" />
            </View>

            <Text style={styles.confirmText}>
              Generate a QR code that will last for 1 hour
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmGenerateButton]}
                onPress={handleConfirmGenerateQR}
              >
                <Text style={styles.confirmGenerateText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.qrModalContent]}>
            <View style={styles.qrModalHeader}>
              <View style={styles.qrModalTitleContainer}>
                <Text style={styles.qrModalTitle}>Attendance QR Code</Text>
                <Text style={styles.qrModalSubtitle}>{course.courseCode} - {course.courseName}</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowQRModal(false)}
                style={styles.qrCloseButton}
              >
                <Ionicons name="close" size={24} color="#218c4a" />
              </TouchableOpacity>
            </View>

            <View style={styles.qrContentContainer}>
              <View style={styles.qrWrapper}>
                <ViewShot ref={qrRef} style={styles.qrContainer}>
                  {qrData && (
                    <QRCode
                      value={qrData.data}
                      size={220}
                      color="#002147"
                      backgroundColor="white"
                    />
                  )}
                </ViewShot>
                <View style={styles.qrTimerContainer}>
                  <Ionicons name="time-outline" size={20} color="#218c4a" />
                  <Text style={styles.qrTimerText}>
                    Expires in {remainingTime} {qrData && qrData.expiresAt ? `(${formatPhilippineTime(qrData.expiresAt)})` : ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveQRButton}
                onPress={handleSaveQRCode}
              >
                <Text style={styles.saveQRButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attendance Modal */}
      <Modal
        visible={showAttendanceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAttendanceModal(false)}
      >
        <View style={[styles.modalOverlay, isFullScreen && styles.fullScreenModal]}>
          <View style={[styles.modalContent, isFullScreen && styles.fullScreenContent, styles.attendanceModalContent]}>
            <View style={styles.attendanceHeader}>
              <View style={styles.attendanceHeaderContent}>
                <TouchableOpacity 
                  onPress={() => setShowAttendanceModal(false)}
                  style={styles.backButton}
                >
                  <Ionicons name="chevron-back" size={24} color="#218c4a" />
                </TouchableOpacity>
                <View style={styles.attendanceTitleSection}>
                  <Text style={styles.attendanceTitle}>Attendance Record</Text>
                  <Text style={styles.attendanceSubtitle}>{course.courseName}</Text>
                </View>
              </View>

              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search name or ID number"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.totalAttendanceContainer}>
                <View style={styles.totalAttendanceCircle}>
                  <Text style={styles.totalAttendanceNumber}>
                    {selectedSession 
                      ? filteredRecords.find(record => record._id === selectedSession)?.scannedBy.length || 0
                      : filteredRecords.reduce((total, record) => total + record.scannedBy.length, 0)
                    }
                  </Text>
                  <Text style={styles.totalAttendanceLabel}>
                    {selectedSession ? 'Attendees' : 'Total Attendees'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.daysContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.daysScrollContent}
              >
                <TouchableOpacity
                  style={[
                    styles.dayTab,
                    !selectedSession && styles.selectedDayTab
                  ]}
                  onPress={() => setSelectedSession(null)}
                >
                  <View style={styles.dayTabContent}>
                    <Ionicons 
                      name="calendar-outline" 
                      size={16} 
                      color={!selectedSession ? "#fff" : "#666"} 
                    />
                    <Text style={[
                      styles.dayTabText,
                      !selectedSession && styles.selectedDayTabText
                    ]}>
                      All Sessions
                    </Text>
                  </View>
                </TouchableOpacity>
                {filteredRecords.map((record, index) => (
                  <TouchableOpacity
                    key={record._id}
                    style={[
                      styles.dayTab,
                      selectedSession === record._id && styles.selectedDayTab
                    ]}
                    onPress={() => setSelectedSession(record._id)}
                  >
                    <Text style={[
                      styles.dayTabText,
                      selectedSession === record._id && styles.selectedDayTabText
                    ]}>
                      {formatPhilippineDate(record.generatedAt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <ScrollView style={styles.attendanceList}>
              {filteredRecords.length === 0 ? (
                <View style={styles.emptyAttendanceState}>
                  <Ionicons name="people-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyAttendanceText}>
                    {searchQuery ? 'No matching students found' : 'No attendance records found'}
                  </Text>
                </View>
              ) : (
                filteredRecords
                  .filter(record => !selectedSession || record._id === selectedSession)
                  .map((record) => (
                    <View key={record._id}>
                      {record.scannedBy.map((scan: any, scanIndex: number) => (
                        <View key={`${record._id}-${scanIndex}`} style={styles.studentItem}>
                          <View style={[
                            styles.studentAvatar,
                            { backgroundColor: getAvatarColor(scan.studentId.firstName[0]) }
                          ]}>
                            <Text style={styles.avatarText}>
                              {scan.studentId.firstName[0]}
                            </Text>
                          </View>
                          <View style={styles.studentDetails}>
                            <Text style={styles.studentName}>
                              {scan.studentId.firstName} {scan.studentId.lastName}
                            </Text>
                            <Text style={styles.studentEmail}>
                              {scan.studentId.idNumber} • {formatPhilippineDate(scan.scannedAt)} • {formatPhilippineTime(scan.scannedAt)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getAvatarColor = (initial: string) => {
  const colors = [
    '#FF6B6B', // red
    '#4ECDC4', // teal
    '#45B7D1', // blue
    '#96CEB4', // green
    '#FFEEAD', // yellow
    '#D4A5A5', // pink
    '#9B59B6', // purple
    '#3498DB', // bright blue
    '#E67E22', // orange
    '#1ABC9C', // turquoise
  ];
  
  const index = initial.toLowerCase().charCodeAt(0) % colors.length;
  return colors[index];
};

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
  logoCircle: {
    display: 'none',
  },
  logoText: {
    display: 'none',
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
  content: {
    flex: 1,
    padding: 20,
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
    position: 'relative',
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
    position: 'absolute',
    right: 20,
    bottom: 20,
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
  qrButton: {
    backgroundColor: '#fff',
    borderColor: '#218c4a',
    borderWidth: 2,
  },
  attendanceButton: {
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
  confirmGenerateButton: {
    backgroundColor: '#218c4a',
  },
  confirmGenerateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  qrModalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 0,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  qrModalTitleContainer: {
    flex: 1,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#218c4a',
  },
  qrModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  qrCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrContentContainer: {
    padding: 24,
  },
  qrWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    padding: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  qrTimerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 140, 74, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  qrTimerText: {
    fontSize: 14,
    color: '#218c4a',
    fontWeight: '600',
  },
  qrInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  qrInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrInfoText: {
    fontSize: 14,
    color: '#218c4a',
    fontWeight: '500',
  },
  saveQRButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#218c4a',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveQRButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  courseSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fullScreenButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 8,
  },
  sessionTabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingVertical: 8,
  },
  sessionTabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  sessionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  selectedSessionTab: {
    backgroundColor: '#002147',
  },
  sessionTabText: {
    fontSize: 14,
    color: '#218c4a',
    fontWeight: '500',
  },
  selectedSessionTabText: {
    color: '#fff',
  },
  attendanceList: {
    flex: 1,
    padding: 16,
  },
  emptyAttendanceState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyAttendanceText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  attendanceSession: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#002147',
    marginBottom: 4,
  },
  sessionTime: {
    fontSize: 16,
    color: '#666',
  },
  studentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 140, 74, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  studentCountText: {
    fontSize: 14,
    color: '#218c4a',
    fontWeight: '500',
  },
  studentsList: {
    gap: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 140, 74, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#218c4a',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#002147',
    marginBottom: 2,
  },
  studentId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  scanTime: {
    fontSize: 14,
    color: '#218c4a',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  attendanceModalContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    padding: 0,
    backgroundColor: '#f8f9fa',
  },
  attendanceHeader: {
    backgroundColor: '#fff',
    padding: 16,
  },
  attendanceHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  attendanceTitleSection: {
    flex: 1,
  },
  attendanceTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  attendanceSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  totalAttendanceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  totalAttendanceCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalAttendanceNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 4,
  },
  totalAttendanceLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  studentEmail: {
    fontSize: 14,
    color: '#666',
  },
  fullScreenModal: {
    backgroundColor: '#fff',
  },
  fullScreenContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    padding: 0,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  daysContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 8,
  },
  daysScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  selectedDayTab: {
    backgroundColor: '#218c4a',
    borderColor: '#218c4a',
  },
  dayTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dayTabDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  selectedDayTabText: {
    color: '#fff',
  },
  dayTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
}); 