import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator, 
  Dimensions,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { authenticateUser, resetPassword } from '../lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const [fontsLoaded] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  React.useEffect(() => {
    console.log('Font loading status:', fontsLoaded);
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [userData, setUserData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isNavigating = useRef(false);

  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const showNotification = (title: string, message: string, type: 'success' | 'error', data?: any) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setUserData(data);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    if (modalType === 'success' && userData) {
      switch (userData.role) {
        case 'admin':
          router.push('/admin-dashboard');
          break;
        case 'lecturer':
          router.push(`/lecturer-dashboard?id=${userData._id}`);
          break;
        case 'student':
          router.push(`/student-dashboard?id=${userData._id}`);
          break;
      }
    }
  };

  const handleLogin = async () => {
    if (isLoading || isNavigating.current) return;
    
    try {
      setIsLoading(true);
      const response = await authenticateUser(username, password);
      
      if (response.success) {
        setUserData(response.user);
        setModalTitle('Success');
        setModalMessage('Login successful!');
        setModalType('success');
        setShowModal(true);
        isNavigating.current = true;
      } else {
        setModalTitle('Error');
        setModalMessage(response.error || 'Invalid credentials');
        setModalType('error');
        setShowModal(true);
      }
    } catch (error) {
      setModalTitle('Error');
      setModalMessage('An error occurred during login');
      setModalType('error');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!email || !username) {
      showNotification('Error', 'Please enter both email and username', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('Error', 'Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showNotification('Error', 'Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      setIsResettingPassword(true);
      await resetPassword(email, username, newPassword);
      showNotification('Success', 'Password reset successful!', 'success');
      setShowForgotPasswordModal(false);
      setEmail('');
      setUsername('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Failed to reset password', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.backgroundPattern}>
        <View style={styles.patternCircle1} />
        <View style={styles.patternCircle2} />
        <View style={styles.patternCircle3} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <View style={styles.logoContainer}>
          
          <Text style={styles.logoTitle}>ATTENDANCE TRACKER</Text>
        </View>
        
        <View style={styles.card}>
          {modalMessage ? <Text style={styles.errorText}>{modalMessage}</Text> : null}
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>USERNAME</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="person-outline" 
                size={20} 
                color="#1a4b8e" 
                style={styles.inputIcon} 
              />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                autoCapitalize="none"
                placeholderTextColor="#aaa"
                editable={!isLoading}
              />
            </View>
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#1a4b8e" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry={!showPassword}
                placeholderTextColor="#aaa"
                editable={!isLoading}
              />
              <TouchableOpacity 
                style={styles.passwordToggle}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="#218c4a" 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.disabledButton]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>LOG IN</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.forgotPasswordContainer}
            onPress={handleForgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.modalIconContainer,
              modalType === 'success' ? styles.successIcon : styles.errorIcon
            ]}>
              <Ionicons
                name={modalType === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={40}
                color="#fff"
              />
            </View>
            <Text style={[
              styles.modalTitle,
              modalType === 'success' ? styles.successTitle : styles.errorTitle
            ]}>
              {modalTitle}
            </Text>
            <Text style={styles.modalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                modalType === 'success' ? styles.successButton : styles.errorButton
              ]}
              onPress={handleModalClose}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showForgotPasswordModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowForgotPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <Text style={styles.modalSubtitle}>Enter your email, username, and new password</Text>
            </View>
            
            <View style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>EMAIL</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#1a4b8e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#aaa"
                    editable={!isResettingPassword}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>USERNAME</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#1a4b8e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter your username"
                    autoCapitalize="none"
                    placeholderTextColor="#aaa"
                    editable={!isResettingPassword}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#1a4b8e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    secureTextEntry
                    placeholderTextColor="#aaa"
                    editable={!isResettingPassword}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#1a4b8e" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    secureTextEntry
                    placeholderTextColor="#aaa"
                    editable={!isResettingPassword}
                  />
                </View>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowForgotPasswordModal(false);
                  setEmail('');
                  setUsername('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                disabled={isResettingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleResetPassword}
                disabled={isResettingPassword}
                activeOpacity={0.8}
              >
                {isResettingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Reset Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    zIndex: -1,
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
    top: '35%',
    left: '25%',
  },
  accentBar: {
    height: 90,
    backgroundColor: '#218c4a',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 18,
    zIndex: 2,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 10,
    marginTop: -45,
  },
  logoText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#218c4a',
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 18,
    marginTop: 10,
  },
  inputContainer: {
    marginBottom: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#218c4a',
    marginBottom: 2,
    marginLeft: 8,
    letterSpacing: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#218c4a',
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    height: 50,
  },
  inputIcon: {
    marginRight: 8,
    color: '#218c4a',
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#218c4a',
    backgroundColor: 'transparent',
  },
  passwordToggle: {
    padding: 6,
  },
  loginButton: {
    backgroundColor: '#218c4a',
    height: 50,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  disabledButton: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    color: '#218c4a',
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.8,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  footerText: {
    color: '#218c4a',
    fontSize: 12,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(33, 140, 74, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalForm: {
    width: '100%',
    marginBottom: 16,
  },
  modalIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  successIcon: {
    backgroundColor: '#34C759',
  },
  errorIcon: {
    backgroundColor: '#FF3B30',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
    color: '#218c4a',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#218c4a',
    textAlign: 'center',
    marginBottom: 14,
    opacity: 0.7,
  },
  successTitle: {
    color: '#34C759',
  },
  errorTitle: {
    color: '#FF3B30',
  },
  modalMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 18,
    color: '#218c4a',
    lineHeight: 22,
    opacity: 0.8,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 26,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  successButton: {
    backgroundColor: '#34C759',
  },
  errorButton: {
    backgroundColor: '#FF3B30',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },
  cancelButton: {
    backgroundColor: '#e9fbe5',
    flex: 1,
    marginRight: 8,
  },
  submitButton: {
    backgroundColor: '#218c4a',
    flex: 1,
  },
  cancelButtonText: {
    color: '#218c4a',
    fontSize: 15,
    fontWeight: 'bold',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
}); 