import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'takshashila_access_token';
const REFRESH_KEY = 'takshashila_refresh_token';

export const tokenStorage = {
  setTokens: async (access: string, refresh: string) => {
    await AsyncStorage.multiSet([
      [ACCESS_KEY, access],
      [REFRESH_KEY, refresh],
    ]);
  },

  getAccessToken: () => AsyncStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => AsyncStorage.getItem(REFRESH_KEY),

  clearTokens: async () => {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  },

  isExpired: (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = typeof payload.exp === 'number' ? payload.exp : 0;
      return Math.floor(Date.now() / 1000) >= exp;
    } catch {
      return true;
    }
  },
};
