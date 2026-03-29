import { Dimensions } from 'react-native';

export const { width: SCREEN_W } = Dimensions.get('window');
export const API_BASE = 'http://192.168.102.244:8000';
export const SIDEBAR_W = 300;
export const getToday = () => new Date().toISOString().split('T')[0];
