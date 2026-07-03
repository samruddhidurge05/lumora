import { backendFetch } from '../utils/api';

export const loginApi = (email, password) => backendFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const registerApi = (data) => backendFetch('/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const getMeApi = () => backendFetch('/auth/me');
