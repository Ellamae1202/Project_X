import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { getCourses } from '../lib/api';
import { LineChart } from 'react-native-chart-kit';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_CONFIG } from '../config';

SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');

export default function Reports() {
  const [fontsLoaded] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const coursesData = await getCourses();
      setCourses(coursesData);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleCourseSelect = (course: any) => {
    setSelectedCourse(course);
    setShowCourseModal(false);
  };

  const fetchAttendanceData = async (courseId: string) => {
    try {
      // Fetch students enrolled in the course using the new endpoint
      const response = await fetch(`${API_CONFIG.baseURL}/courses/${courseId}/students`, {
        headers: API_CONFIG.headers
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Students API response:', response.status, errorText);
        throw new Error(`Failed to fetch students: ${response.status}`);
      }
      
      const students = await response.json();
      
      if (students.length === 0) {
        throw new Error('No students enrolled in this course');
      }
      
      // Fetch attendance records for the course
      const attendanceResponse = await fetch(`${API_CONFIG.baseURL}/attendance/course/${courseId}`, {
        headers: API_CONFIG.headers
      });
      
      if (!attendanceResponse.ok) {
        const errorText = await attendanceResponse.text();
        console.error('Attendance API response:', attendanceResponse.status, errorText);
        throw new Error(`Failed to fetch attendance records: ${attendanceResponse.status}`);
      }
      
      const attendanceRecords = await attendanceResponse.json();
      
      // Sort attendance dates chronologically
      const sortedAttendance = attendanceRecords.sort((a: any, b: any) => 
        new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
      );
      
      // Calculate statistics
      const totalSessions = sortedAttendance.length;
      const totalStudents = students.length;
      
      // Calculate average attendance per session
      let totalAttendees = 0;
      sortedAttendance.forEach((record: any) => {
        totalAttendees += record.scannedBy.length;
      });
      const avgAttendance = totalSessions > 0 ? Math.round(totalAttendees / totalSessions) : 0;
      
      // Calculate attendance rate
      const attendanceRate = totalSessions > 0 && totalStudents > 0 
        ? Math.round((totalAttendees / (totalSessions * totalStudents)) * 100) 
        : 0;
      
      // Generate chart data
      const dates = sortedAttendance.map((record: any) => {
        const date = new Date(record.generatedAt);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      
      const attendanceCounts = sortedAttendance.map((record: any) => record.scannedBy.length);
      
      return {
        students,
        attendance: sortedAttendance,
        stats: {
          totalStudents,
          totalSessions,
          avgAttendance,
          attendanceRate
        },
        chart: {
          labels: dates.length > 5 ? dates.slice(-5) : dates, // Show last 5 dates for readability
          data: attendanceCounts.length > 5 ? attendanceCounts.slice(-5) : attendanceCounts
        }
      };
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      throw error;
    }
  };

  const generateCSV = (courseName: string, students: any[], attendanceRecords: any[]) => {
    // Create the CSV header row with dates
    const dates = attendanceRecords.map(record => {
      const date = new Date(record.generatedAt);
      return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${date.getFullYear()}`;
    });
    
    // Start with header row - use quotes to ensure values stay in one cell
    let csv = `"Course: ${courseName}"\n`;
    
    // Add header row with ID number, student name, and dates
    csv += `"ID Number","Student Name",${dates.map(date => `"${date}"`).join(',')}\n`;
    
    // Add rows for each student
    students.forEach(student => {
      // Add ID number and full name with quotes
      const idNumber = `"${student.idNumber || ''}"`;
      const fullName = `"${student.lastName}, ${student.firstName}"`;
      
      // For each date, check if student was present
      const attendanceStatus = attendanceRecords.map(record => {
        const isPresent = record.scannedBy.some((scan: any) => 
          scan.studentId._id === student._id || scan.studentId === student._id
        );
        return `"${isPresent ? 'Present' : 'Absent'}"`;
      });
      
      csv += `${idNumber},${fullName},${attendanceStatus.join(',')}\n`;
    });
    
    return csv;
  };

  const handleGenerateReport = async () => {
    if (!selectedCourse) {
      Alert.alert('Error', 'Please select a course first');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      const data = await fetchAttendanceData(selectedCourse._id);
      
      if (!data.attendance.length) {
        Alert.alert('No Data', 'No attendance records found for this course');
        setIsGenerating(false);
        return;
      }
      
      setAttendanceStats(data);
      setReportGenerated(true);
      
      const csv = generateCSV(selectedCourse.courseName, data.students, data.attendance);
      
      // Generate a filename with course code and date
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${selectedCourse.courseCode}_Engagement_${timestamp}.csv`;
      
      // Save the CSV file
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, csv);
      
      setIsGenerating(false);
    } catch (error) {
      console.error('Error generating report:', error);
      let errorMessage = 'Failed to generate engagement report';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to fetch students')) {
          errorMessage = 'Unable to retrieve student data for this course. Please try again later.';
        } else if (error.message.includes('Failed to fetch attendance')) {
          errorMessage = 'Unable to retrieve attendance records. Please try again later.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      Alert.alert('Report Generation Failed', errorMessage);
      setIsGenerating(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (!selectedCourse || !attendanceStats) return;
    
    try {
      const csv = generateCSV(selectedCourse.courseName, attendanceStats.students, attendanceStats.attendance);
      
      // Generate a filename with course code and date
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${selectedCourse.courseCode}_Engagement_${timestamp}.csv`;
      
      // Save the CSV file
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, csv);
      
      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert(
          'Sharing not available',
          'Sharing is not available on your device'
        );
      }
    } catch (error) {
      console.error('Error downloading CSV:', error);
      Alert.alert('Error', 'Failed to download CSV file');
    }
  };

  const handleNewReport = () => {
    setReportGenerated(false);
    setSelectedCourse(null);
    setAttendanceStats(null);
  };

  const handleManageUsers = () => {
    router.push('/manage-users');
  };

  const handleManageCourses = () => {
    router.push('/manage-courses');
  };

  const handleDashboard = () => {
    router.push('/admin-dashboard');
  };

  const navigationItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: 'home' as const,
      onPress: handleDashboard,
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
      onPress: () => setActiveTab('reports'),
    }
  ];

  if (!fontsLoaded) {
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
              <Text style={styles.logoSubtitle}>Report Generator</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {reportGenerated && attendanceStats ? (
          <View style={styles.reportContent}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>Engagement Report</Text>
              <Text style={styles.reportDate}>{new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</Text>
              <Text style={styles.reportCourse}>
                Course: {selectedCourse?.courseName || 'Unknown'}
              </Text>
            </View>
            
            <View style={styles.chartContainer}>
              <LineChart
                data={{
                  labels: attendanceStats.chart.labels,
                  datasets: [{
                    data: attendanceStats.chart.data
                  }]
                }}
                width={width - 40}
                height={220}
                chartConfig={{
                  backgroundColor: '#ffffff',
                  backgroundGradientFrom: '#ffffff',
                  backgroundGradientTo: '#ffffff',
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(26, 75, 142, ${opacity})`,
                  style: {
                    borderRadius: 16
                  }
                }}
                bezier
                style={styles.chart}
              />
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{attendanceStats.stats.totalStudents}</Text>
                <Text style={styles.statLabel}>Total Students</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{attendanceStats.stats.totalSessions}</Text>
                <Text style={styles.statLabel}>Engagement Sessions</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{attendanceStats.stats.avgAttendance}</Text>
                <Text style={styles.statLabel}>Avg. Engagement</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{attendanceStats.stats.attendanceRate}%</Text>
                <Text style={styles.statLabel}>Engagement Rate</Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.exportButton]}
                onPress={handleDownloadCSV}
              >
                <Ionicons name="download-outline" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Export Engagement Data</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.newReportButton]}
                onPress={handleNewReport}
              >
                <Ionicons name="add-circle-outline" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>Generate New Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.reportGenerationCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Engagement Report</Text>
            </View>
            
            <View style={styles.courseSelectionContainer}>
              <Text style={styles.selectionLabel}>Select a course:</Text>
              <TouchableOpacity 
                style={styles.courseSelector}
                onPress={() => setShowCourseModal(true)}
              >
                <Text style={styles.courseSelectorText}>
                  {selectedCourse ? selectedCourse.courseName : 'Choose a course'}
                </Text>
                <Ionicons name="chevron-down" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.generateReportButton, !selectedCourse && styles.disabledButton]}
              onPress={handleGenerateReport}
              disabled={!selectedCourse || isGenerating}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Generate Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
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

      <Modal
        visible={showCourseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCourseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="book" size={40} color="#218c4a" />
            </View>
            <Text style={styles.modalTitle}>Select Course</Text>
            <Text style={styles.modalMessage}>
              Choose a course to generate the engagement report
            </Text>

            <ScrollView style={styles.courseList}>
              {courses.map((course) => (
                <TouchableOpacity
                  key={course._id}
                  style={styles.courseItem}
                  onPress={() => handleCourseSelect(course)}
                >
                  <Text style={styles.courseName}>{course.courseName}</Text>
                  <Text style={styles.courseCode}>{course.courseCode}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => setShowCourseModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  reportGenerationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#218c4a',
    marginLeft: 12,
  },
  courseSelectionContainer: {
    marginBottom: 24,
  },
  selectionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  courseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#218c4a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#218c4a',
  },
  courseSelectorText: {
    fontSize: 16,
    color: '#fff',
  },
  generateReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#218c4a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  disabledButton: {
    backgroundColor: '#a0b1c5',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  reportContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    paddingBottom: 24,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  reportHeader: {
    marginBottom: 24,
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
  },
  reportCourse: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 4,
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f0f4f8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a4b8e',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
  },
  exportButton: {
    backgroundColor: '#34C759',
  },
  newReportButton: {
    backgroundColor: '#218c4a',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(33, 140, 74, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#666',
    lineHeight: 24,
  },
  courseList: {
    width: '100%',
    maxHeight: 300,
    marginBottom: 20,
  },
  courseItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  courseName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 14,
    color: '#666',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    width: '100%',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#218c4a',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 