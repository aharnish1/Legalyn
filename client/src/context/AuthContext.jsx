import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const baseURL = import.meta.env.VITE_API_BASE_URL ;

  const authInterceptor = (config) => {
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  };

  const errorInterceptor = (error) => {
    if (error.response?.status === 401 && token) {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
    return Promise.reject(error);
  };

  const makeClient = (timeout) => {
    const client = axios.create({ baseURL, timeout });
    client.interceptors.request.use(authInterceptor);
    client.interceptors.response.use(r => r, errorInterceptor);
    return client;
  };

  const api = makeClient(120000);
  const aiApi = makeClient(120000);
  const uploadApi = makeClient(180000);
  const fastApi = makeClient(15000);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const { data } = await api.get('/auth/profile');
          setUser(data);
        } catch (error) {
          console.error('Session expired, please login again');
          setToken(null);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!data.token) {
      throw new Error('No token received');
    }
    setUser(data);
    setToken(data.token);
    localStorage.setItem('token', data.token);
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    if (!data.token) {
      throw new Error('No token received');
    }
    setUser(data);
    setToken(data.token);
    localStorage.setItem('token', data.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, api, aiApi, uploadApi, fastApi }}>
      {children}
    </AuthContext.Provider>
  );
};
