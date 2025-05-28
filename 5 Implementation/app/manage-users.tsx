import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Animated, PanResponder, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { User, getUsers, createUser, updateUser, deleteUser } from '../lib/api';
import { API_CONFIG } from '../config';
import Alert from './components/Alert';

SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get('window');

// Role card component
interface RoleCardProps {
  role: string;
  count: number;
  onPress: () => void;
  iconName: keyof typeof Ionicons.glyphMap;
}

const RoleCard: React.FC<RoleCardProps> = ({ role, count, onPress, iconName }) => (
  <TouchableOpacity 
    style={styles.roleCard} 
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={[styles.roleCardLeftBorder, role === 'admin' ? styles.adminBorder : role === 'lecturer' ? styles.lecturerBorder : styles.studentBorder]} />
    <View style={styles.roleCardContent}>
      <View style={styles.roleCardHeader}>
        <View style={[styles.roleIconContainer, role === 'admin' ? styles.adminIconContainer : role === 'lecturer' ? styles.lecturerIconContainer : styles.studentIconContainer]}>
          <Ionicons name={iconName} size={28} color="#fff" />
        </View>
        <View style={styles.roleInfo}>
          <Text style={styles.roleTitle}>{role.charAt(0).toUpperCase() + role.slice(1)}s</Text>
          <Text style={styles.roleSubtitle}>User Management</Text>
        </View>
      </View>
      <Text style={styles.roleDescription}>Manage {role} accounts and permissions</Text>
      <View style={styles.roleFooter}>
        <Text style={styles.roleActionText}>View Details</Text>
        <Ionicons name="arrow-forward" size={20} color="#1a4b8e" />
      </View>
    </View>
  </TouchableOpacity>
);

// User list modal component
interface UserListModalProps {
  visible: boolean;
  onClose: () => void;
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  role: string;
}

const UserListModal: React.FC<UserListModalProps> = ({ visible, onClose, users, onEdit, onDelete, role }) => {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(50);

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    `${user.idNumber} ${user.firstName} ${user.lastName} ${user.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Get current users for pagination
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setIsDeleting(userToDelete._id);
      setError(null);
      await onDelete(userToDelete._id);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
    } catch (error) {
      console.error('Delete error:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setUserToDelete(null);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.userListModalContent]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalTitle}>{role.charAt(0).toUpperCase() + role.slice(1)}s</Text>
                  <Text style={styles.modalSubtitle}>Manage user accounts</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#1a4b8e" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search" size={20} color="#1a4b8e" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by ID, name, or email..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor="#999"
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                    <Ionicons name="close-circle" size={20} color="#1a4b8e" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.userStats}>
              <View style={styles.statsContent}>
                <Ionicons name="people" size={20} color="#1a4b8e" />
                <Text style={styles.statsText}>
                  Showing {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users
                </Text>
              </View>
            </View>
            
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color="#dc3545" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <ScrollView style={styles.userList} showsVerticalScrollIndicator={false}>
              {currentUsers.map((user, index) => (
                <View key={`${role}-${user._id || `temp-${index}`}`} style={styles.userCard}>
                  <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>
                      {(user.firstName?.[0] || '')}{(user.lastName?.[0] || '')}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {user.firstName || ''} {user.lastName || ''}
                    </Text>
                    <Text style={styles.userId}>{user.idNumber || ''}</Text>
                    <Text style={styles.userEmail}>{user.email || ''}</Text>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => onEdit(user)}
                    >
                      <Ionicons name="pencil" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton, isDeleting === user._id && styles.disabledButton]}
                      onPress={() => handleDeleteClick(user)}
                      disabled={isDeleting === user._id}
                    >
                      {isDeleting === user._id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name="trash" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.paginationContainer}>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
                onPress={handlePrevPage}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? "#ccc" : "#1a4b8e"} />
              </TouchableOpacity>
              <Text style={styles.paginationText}>
                Page {currentPage} of {totalPages}
              </Text>
              <TouchableOpacity
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
                onPress={handleNextPage}
                disabled={currentPage === totalPages}
              >
                <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? "#ccc" : "#1a4b8e"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={handleDeleteCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={styles.confirmModalIcon}>
              <Ionicons name="warning" size={48} color="#F44336" />
            </View>
            <Text style={styles.confirmModalTitle}>Confirm Delete</Text>
            <Text style={styles.confirmModalText}>
              Are you sure you want to delete {userToDelete?.firstName} {userToDelete?.lastName}?
            </Text>
            <Text style={styles.confirmModalWarning}>
              This action cannot be undone.
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalCancelButton]}
                onPress={handleDeleteCancel}
              >
                <Text style={styles.confirmModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalButton, styles.confirmModalDeleteButton]}
                onPress={handleDeleteConfirm}
                disabled={isDeleting === userToDelete?._id}
              >
                {isDeleting === userToDelete?._id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmModalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default function ManageUsers() {
  const [fontsLoaded] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showUserListModal, setShowUserListModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    idNumber: '',
    employeeId: '',
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    role: 'student',
    password: '',
  });
  const [alert, setAlert] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'success';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'error'
  });
  const [drawerHeight] = useState(new Animated.Value(0));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const screenHeight = Dimensions.get('window').height;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 5;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) { // Only allow dragging down
        drawerHeight.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100) {
        closeDrawer();
      } else {
        Animated.spring(drawerHeight, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.spring(drawerHeight, {
      toValue: screenHeight * 0.9,
      useNativeDriver: false,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerHeight, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsDrawerOpen(false);
      setFormData({
        idNumber: '',
        employeeId: '',
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        role: 'student',
        password: '',
      });
      setSelectedUser(null);
    });
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setError(null);
    setFormData({
      idNumber: '',
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      role: 'student',
      password: '',
    });
    openDrawer();
  };

  const handleEditUser = async (user: User) => {
    try {
      setIsLoading(true);
      setError(null);
      
      setFormData({
        idNumber: user.idNumber,
        employeeId: user.employeeId || '',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        role: user.role,
        password: '',
      });
      
      setSelectedUser(user);
      openDrawer();
    } catch (error) {
      console.error('Error preparing user edit:', error);
      setError(error instanceof Error ? error.message : 'Failed to prepare user edit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await deleteUser(userId);
      setUsers(users.filter(user => user._id !== userId));
      setShowUserListModal(false);
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Debug logs
      console.log('Form Data:', formData);
      console.log('Current role:', formData.role);
      console.log('EmployeeId:', formData.role !== 'student' ? formData.employeeId : 'N/A');
      console.log('All Users by role:', {
        admins: users.filter(u => u.role === 'admin').length,
        lecturers: users.filter(u => u.role === 'lecturer').length,
        students: users.filter(u => u.role === 'student').length,
      });

      // Validate required fields
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.username || !formData.role) {
        setAlert({
          visible: true,
          title: 'Missing Information',
          message: 'Please fill in all required fields',
          type: 'warning'
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setAlert({
          visible: true,
          title: 'Invalid Email',
          message: 'Please enter a valid email address',
          type: 'warning'
        });
        return;
      }

      // Check if email already exists
      const existingUser = users.find(user => 
        user.email && formData.email && 
        user.email.toLowerCase() === formData.email.toLowerCase() && 
        user._id !== selectedUser?._id
      );
      if (existingUser) {
        setAlert({
          visible: true,
          title: 'Email Exists',
          message: 'This email address is already registered',
          type: 'error'
        });
        return;
      }

      // Check if username already exists
      const existingUsername = users.find(user => 
        user.username && formData.username && 
        user.username.toLowerCase() === formData.username.toLowerCase() && 
        user._id !== selectedUser?._id
      );
      if (existingUsername) {
        setAlert({
          visible: true,
          title: 'Username Exists',
          message: 'This username is already taken',
          type: 'error'
        });
        return;
      }

      // Check if idNumber already exists
      const existingIdNumber = users.find(user => 
        user.idNumber && formData.idNumber && 
        user.idNumber === formData.idNumber && 
        user._id !== selectedUser?._id
      );
      if (existingIdNumber) {
        setAlert({
          visible: true,
          title: 'ID Number Exists',
          message: 'This ID number is already registered',
          type: 'error'
        });
        return;
      }

      // Generate a random password if not provided
      const passwordToUse = formData.password && formData.password.trim() !== '' ? formData.password : Math.random().toString(36).slice(-8);

      if (selectedUser) {
        // Update existing user
        const updatePayload: {
          idNumber: string;
          firstName: string;
          lastName: string;
          email: string;
          username: string;
          role: string;
          password?: string;
        } = {
          idNumber: formData.idNumber,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          username: formData.username,
          role: formData.role,
        };
        // Only include password if user entered a new one
        if (formData.password && formData.password.trim() !== '') {
          updatePayload.password = formData.password;
        }
        const updatedUser = await updateUser(selectedUser._id, updatePayload);
        setUsers(users.map(u => u._id === updatedUser._id ? updatedUser : u));
        setAlert({
          visible: true,
          title: 'Success',
          message: 'User updated successfully',
          type: 'success'
        });
      } else {
        // Create new user with entered or generated password
        const newUser = await createUser({
          ...formData,
          password: passwordToUse,
        });
        setUsers([...users, newUser]);

              // Email sending process removed
      console.log('Skipping email sending - credential details:', {
        username: formData.username,
        password: passwordToUse,
        role: formData.role
      });

        setAlert({
          visible: true,
          title: 'Success',
          message: 'User created successfully',
          type: 'success'
        });
      }

      // Refresh the user list
      await fetchUsers();

      // Reset form and close modal
      setShowModal(false);
      setSelectedUser(null);
      setFormData({
        idNumber: '',
        employeeId: '',
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        role: 'student',
        password: '',
      });
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setAlert({
        visible: true,
        title: 'Error',
        message: error instanceof Error ? error.message : 'An error occurred',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleRoleCardPress = (role: string) => {
    setSelectedRole(role);
    setShowUserListModal(true);
  };

  const getUsersByRole = (role: string) => {
    return users.filter(user => user.role === role);
  };

  const renderDrawer = () => (
    <Animated.View
      style={[
        styles.drawer,
        {
          height: drawerHeight,
        },
      ]}
    >
      <View style={styles.drawerHeader} {...panResponder.panHandlers}>
        <View style={styles.drawerHandle} />
        <Text style={styles.drawerTitle}>
          {selectedUser ? 'Edit User' : 'Add New User'}
        </Text>
        <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#002147" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.drawerContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={24} color="#1a73e8" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>ID Number</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="card-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.idNumber}
                onChangeText={(text) => setFormData({ ...formData, idNumber: text })}
                placeholder="Enter ID number"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          {(formData.role === 'lecturer' || formData.role === 'admin') && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Employee ID {formData.role === 'lecturer' ? '(Required for lecturers)' : '(Required for admins)'}</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="briefcase-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.employeeId}
                  onChangeText={(text) => setFormData({ ...formData, employeeId: text })}
                  placeholder="Enter employee ID"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          )}

          <View style={styles.nameContainer}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>First Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.firstName}
                  onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                  placeholder="Enter first name"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.lastName}
                  onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                  placeholder="Enter last name"
                  placeholderTextColor="#999"
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={24} color="#1a73e8" />
            <Text style={styles.sectionTitle}>Account Information</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Enter email"
                keyboardType="email-address"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="at-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                placeholder="Enter username"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Field - always visible */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password {selectedUser ? '(leave blank to keep current)' : ''}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.password || ''}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                placeholder={selectedUser ? 'Enter new password or leave blank' : 'Enter password'}
                placeholderTextColor="#999"
                autoCapitalize="none"
                secureTextEntry
              />
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-outline" size={24} color="#1a73e8" />
            <Text style={styles.sectionTitle}>Role</Text>
          </View>
          <View style={styles.roleContainer}>
            {['student', 'lecturer', 'admin'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton,
                  formData.role === role && styles.roleButtonSelected,
                ]}
                onPress={() => setFormData({ ...formData, role })}
              >
                <View style={[
                  styles.roleIconContainer,
                  formData.role === role && styles.roleIconContainerSelected,
                  role === 'admin' ? styles.adminIconContainer : role === 'lecturer' ? styles.lecturerIconContainer : styles.studentIconContainer
                ]}>
                  <Ionicons
                    name={
                      role === 'admin' ? 'shield-checkmark' :
                      role === 'lecturer' ? 'school' : 'people'
                    }
                    size={24}
                    color={formData.role === role ? '#fff' : '#666'}
                  />
                </View>
                <Text
                  style={[
                    styles.roleButtonText,
                    formData.role === role && styles.roleButtonTextSelected,
                  ]}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.drawerButtons}>
          <TouchableOpacity
            style={[styles.drawerButton, styles.cancelButton]}
            onPress={closeDrawer}
          >
            <Ionicons name="close" size={20} color="#666" style={styles.buttonIcon} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drawerButton, styles.saveButton]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );

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

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          flexGrow: 1,
          paddingBottom: 100,
          minHeight: '100%'
        }} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.accentBar} />
        <View style={styles.headerTitleOnlyContainer}>
          <View style={styles.headerTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logoTitle}>ATTENDANCE TRACKER</Text>
              <Text style={styles.logoSubtitle}>Manage Users</Text>
            </View>
          </View>
        </View>

        <View style={styles.contentCentered}>
          <TouchableOpacity style={styles.addButtonDashboard} onPress={handleAddUser}>
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.addButtonTextDashboard}>Add User</Text>
          </TouchableOpacity>

          <View style={styles.statsContainerCentered}>
            <RoleCard
              role="admin"
              count={getUsersByRole('admin').length}
              onPress={() => handleRoleCardPress('admin')}
              iconName="shield-checkmark"
            />
            <RoleCard
              role="lecturer"
              count={getUsersByRole('lecturer').length}
              onPress={() => handleRoleCardPress('lecturer')}
              iconName="school"
            />
            <RoleCard
              role="student"
              count={getUsersByRole('student').length}
              onPress={() => handleRoleCardPress('student')}
              iconName="people"
            />
          </View>
        </View>
      </ScrollView>

      <UserListModal
        visible={showUserListModal}
        onClose={() => setShowUserListModal(false)}
        users={selectedRole ? getUsersByRole(selectedRole) : []}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
        role={selectedRole || ''}
      />

      {isDrawerOpen && (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={closeDrawer}
          />
          {renderDrawer()}
        </View>
      )}

      <Alert
        visible={alert.visible}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onClose={() => setAlert({ ...alert, visible: false })}
      />

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/admin-dashboard')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="home" size={24} color="#666" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="people" size={24} color="#218c4a" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/manage-courses')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="book" size={24} color="#666" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/reports')}
          activeOpacity={0.7}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="bar-chart" size={24} color="#666" />
          </View>
        </TouchableOpacity>
      </View>
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
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  addButtonDashboard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#218c4a',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    width: '90%',
  },
  addButtonTextDashboard: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statsContainerCentered: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  roleCard: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  roleCardLeftBorder: {
    width: 6,
  },
  adminBorder: {
    backgroundColor: '#218c4a',
  },
  lecturerBorder: {
    backgroundColor: '#34C759',
  },
  studentBorder: {
    backgroundColor: '#FF9500',
  },
  roleCardContent: {
    flex: 1,
    padding: 20,
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  adminIconContainer: {
    backgroundColor: '#218c4a',
  },
  lecturerIconContainer: {
    backgroundColor: '#34C759',
  },
  studentIconContainer: {
    backgroundColor: '#FF9500',
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  roleDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  roleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  roleActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#218c4a',
    marginRight: 8,
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
    paddingBottom: 80,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 140, 74, 0.1)',
  },
  drawerHandle: {
    position: 'absolute',
    top: 8,
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#218c4a',
  },
  drawerContent: {
    padding: 20,
    paddingBottom: 100,
  },
  formSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#218c4a',
    marginLeft: 12,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#218c4a',
    marginBottom: 12,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
  },
  roleButtonSelected: {
    backgroundColor: '#218c4a',
    borderColor: '#218c4a',
  },
  roleIconContainerSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  roleButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  roleButtonTextSelected: {
    color: '#fff',
  },
  drawerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingBottom: 20,
    position: 'relative',
    zIndex: 1,
  },
  drawerButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
  },
  saveButton: {
    backgroundColor: '#218c4a',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
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
    maxHeight: '90%',
  },
  userListModalContent: {
    padding: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33, 140, 74, 0.1)',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalTitleContainer: {
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#218c4a',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    padding: 8,
  },
  searchContainer: {
    padding: 16,
    paddingTop: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
    elevation: 2,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  clearSearchButton: {
    padding: 5,
  },
  userStats: {
    padding: 16,
    paddingTop: 0,
  },
  statsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  userList: {
    maxHeight: '80%',
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
    elevation: 2,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 140, 74, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#218c4a',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  userId: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#218c4a',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  disabledButton: {
    opacity: 0.5,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33, 140, 74, 0.1)',
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#218c4a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 140, 74, 0.1)',
    marginHorizontal: 8,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  confirmModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmModalIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmModalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmModalWarning: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  confirmModalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  confirmModalCancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: 'rgba(33, 140, 74, 0.2)',
  },
  confirmModalDeleteButton: {
    backgroundColor: '#F44336',
  },
  confirmModalCancelText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmModalDeleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
}); 