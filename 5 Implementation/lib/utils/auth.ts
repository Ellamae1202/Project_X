import crypto from 'crypto';
import { User } from '../models/User';
import { connectDB } from '../db';
import { authenticateUser as apiAuthenticateUser } from '../api';

const API_CONFIG = {
  baseURL: 'http://192.168.68.131:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
};

export const generateUsername = (firstName: string, lastName: string, idNumber: string): string => {
  // Convert to lowercase and remove spaces
  const cleanFirstName = firstName.toLowerCase().replace(/\s+/g, '');
  const cleanLastName = lastName.toLowerCase().replace(/\s+/g, '');
  
  // Take first 3 letters of first name and last name
  const firstPart = cleanFirstName.substring(0, 3);
  const lastPart = cleanLastName.substring(0, 3);
  
  // Take last 4 digits of ID number
  const idPart = idNumber.slice(-4);
  
  return `${firstPart}${lastPart}${idPart}`;
};

export const generatePassword = (): string => {
  // Generate a random 8-character password
  return crypto.randomBytes(4).toString('hex');
};

export const generateInitialPassword = (firstName: string, lastName: string, idNumber: string): string => {
  // Create a password based on user information
  const cleanFirstName = firstName.toLowerCase().replace(/\s+/g, '');
  const cleanLastName = lastName.toLowerCase().replace(/\s+/g, '');
  const idPart = idNumber.slice(-4);
  
  return `${cleanFirstName.charAt(0)}${cleanLastName.charAt(0)}${idPart}@${Math.floor(Math.random() * 1000)}`;
};

export const authenticateUser = async (username: string, password: string) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/auth/login`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
    throw new Error('Authentication failed: Unknown error');
  }
}; 