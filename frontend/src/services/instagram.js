import api from './api';

export const instagramService = {
    // Get Instagram OAuth URL
    async getAuthUrl() {
        return await api.get('/instagram/auth');
    },

    // Get connected Instagram profile
    async getProfile() {
        return await api.get('/instagram/profile');
    },

    // Get Instagram media
    async getMedia() {
        return await api.get('/instagram/media');
    },

    // Disconnect Instagram
    async disconnect() {
        return await api.delete('/instagram/disconnect');
    }
};

export const automationService = {
    // Create scheduled post
    async createScheduledPost(postData) {
        return await api.post('/automation', postData);
    },

    // Get all scheduled posts
    async getScheduledPosts() {
        return await api.get('/automation');
    },

    // Update scheduled post
    async updateScheduledPost(id, postData) {
        return await api.put(`/automation/${id}`, postData);
    },

    // Delete scheduled post
    async deleteScheduledPost(id) {
        return await api.delete(`/automation/${id}`);
    },

    // Publish post now
    async publishNow(id) {
        return await api.post(`/automation/${id}/publish`);
    }
};

export const analyticsService = {
    // Get analytics overview
    async getOverview() {
        return await api.get('/analytics/overview');
    },

    // Sync Instagram insights
    async syncInsights() {
        return await api.post('/analytics/sync');
    },

    // Get historical insights
    async getInsights(days = 30) {
        return await api.get(`/analytics/insights?days=${days}`);
    }
};

export const authService = {
    // Register user
    async register(userData) {
        const response = await api.post('/auth/register', userData);
        if (response.token) {
            localStorage.setItem('creatorhub_token', response.token);
        }
        return response;
    },

    // Login user
    async login(credentials) {
        const response = await api.post('/auth/login', credentials);
        if (response.token) {
            localStorage.setItem('creatorhub_token', response.token);
        }
        return response;
    },

    // Logout
    logout() {
        localStorage.removeItem('creatorhub_token');
        window.location.href = '/login';
    },

    // Check if logged in
    isAuthenticated() {
        return !!localStorage.getItem('creatorhub_token');
    }
};
