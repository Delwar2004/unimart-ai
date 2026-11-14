const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Standard HTTP client for API requests with auto Authorization header
 */
export const apiClient = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  // Retrieve token from localStorage if present
  const token = localStorage.getItem('unimart_token');

  // Handle headers: if body is FormData, do not set Content-Type so browser sets boundary automatically
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = result?.message || `Request failed with status ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.data = result;
      throw error;
    }

    return result;
  } catch (error) {
    console.error(`[API Client Error] ${endpoint}:`, error.message);
    throw error;
  }
};

/**
 * System Health Service
 */
export const checkHealth = async () => {
  return await apiClient('/health');
};

/**
 * Authentication Services
 */
export const authService = {
  register: (userData) =>
    apiClient('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  verifyEmail: (token) =>
    apiClient(`/auth/verify-email/${token}`, {
      method: 'GET',
    }),

  login: (credentials) =>
    apiClient('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getMe: () =>
    apiClient('/auth/me', {
      method: 'GET',
    }),

  forgotPassword: (email) =>
    apiClient('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token, password) =>
    apiClient(`/auth/reset-password/${token}`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};

/**
 * User & Profile Services
 */
export const userService = {
  getOwnProfile: () =>
    apiClient('/users/profile', {
      method: 'GET',
    }),

  updateOwnProfile: (profileData) =>
    apiClient('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  uploadAvatar: (formData) =>
    apiClient('/users/profile/avatar', {
      method: 'PUT',
      body: formData,
    }),

  getPublicProfile: (userId) =>
    apiClient(`/users/${userId}`, {
      method: 'GET',
    }),
};

/**
 * Category Services
 */
export const categoryService = {
  getCategories: () =>
    apiClient('/categories', {
      method: 'GET',
    }),
};

/**
 * Product & Listing Services
 */
export const productService = {
  getProducts: (params = {}) => {
    let query = '';
    if (typeof params === 'string') {
      query = params.startsWith('?') ? params : `?${params}`;
    } else {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          searchParams.append(key, val);
        }
      });
      const str = searchParams.toString();
      query = str ? `?${str}` : '';
    }
    return apiClient(`/products${query}`, {
      method: 'GET',
    });
  },

  getProductById: (id) =>
    apiClient(`/products/${id}`, {
      method: 'GET',
    }),

  createProduct: (formData) =>
    apiClient('/products', {
      method: 'POST',
      body: formData,
    }),

  updateProduct: (id, formData) =>
    apiClient(`/products/${id}`, {
      method: 'PUT',
      body: formData,
    }),

  updateProductStatus: (id, status) =>
    apiClient(`/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteProduct: (id) =>
    apiClient(`/products/${id}`, {
      method: 'DELETE',
    }),
};

/**
 * Wishlist Services
 */
export const wishlistService = {
  getWishlist: () =>
    apiClient('/wishlist', {
      method: 'GET',
    }),

  addToWishlist: (productId) =>
    apiClient(`/wishlist/${productId}`, {
      method: 'POST',
    }),

  removeFromWishlist: (productId) =>
    apiClient(`/wishlist/${productId}`, {
      method: 'DELETE',
    }),

  checkWishlist: (productId) =>
    apiClient(`/wishlist/check/${productId}`, {
      method: 'GET',
    }),
};

/**
 * Notification Services
 */
export const notificationService = {
  getNotifications: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const str = searchParams.toString();
    return apiClient(`/notifications${str ? `?${str}` : ''}`, {
      method: 'GET',
    });
  },

  getUnreadCount: () =>
    apiClient('/notifications/unread-count', {
      method: 'GET',
    }),

  markAsRead: (id) =>
    apiClient(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllAsRead: () =>
    apiClient('/notifications/read-all', {
      method: 'PATCH',
    }),

  deleteNotification: (id) =>
    apiClient(`/notifications/${id}`, {
      method: 'DELETE',
    }),
};

const toQuery = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, val);
    }
  });
  const str = searchParams.toString();
  return str ? `?${str}` : '';
};

/**
 * Conversation and message services
 */
export const conversationService = {
  getConversations: (params = {}) =>
    apiClient(`/conversations${toQuery(params)}`, {
      method: 'GET',
    }),

  createConversation: (data) =>
    apiClient('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getConversation: (id) =>
    apiClient(`/conversations/${id}`, {
      method: 'GET',
    }),

  getMessages: (conversationId, params = {}) =>
    apiClient(`/conversations/${conversationId}/messages${toQuery(params)}`, {
      method: 'GET',
    }),

  sendMessage: (conversationId, data) =>
    apiClient(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markConversationRead: (conversationId) =>
    apiClient(`/conversations/${conversationId}/read`, {
      method: 'PATCH',
    }),

  getUnreadMessageCount: () =>
    apiClient('/messages/unread-count', {
      method: 'GET',
    }),
};

/**
 * Buy request services
 */
export const buyRequestService = {
  create: (data) =>
    apiClient('/buy-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSent: (params = {}) =>
    apiClient(`/buy-requests/sent${toQuery(params)}`, {
      method: 'GET',
    }),

  getReceived: (params = {}) =>
    apiClient(`/buy-requests/received${toQuery(params)}`, {
      method: 'GET',
    }),

  getById: (id) =>
    apiClient(`/buy-requests/${id}`, {
      method: 'GET',
    }),

  cancel: (id) =>
    apiClient(`/buy-requests/${id}/cancel`, {
      method: 'PATCH',
    }),

  accept: (id) =>
    apiClient(`/buy-requests/${id}/accept`, {
      method: 'PATCH',
    }),

  reject: (id) =>
    apiClient(`/buy-requests/${id}/reject`, {
      method: 'PATCH',
    }),
};

/**
 * Offer services
 */
export const offerService = {
  create: (data) =>
    apiClient('/offers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getSent: (params = {}) =>
    apiClient(`/offers/sent${toQuery(params)}`, {
      method: 'GET',
    }),

  getReceived: (params = {}) =>
    apiClient(`/offers/received${toQuery(params)}`, {
      method: 'GET',
    }),

  getById: (id) =>
    apiClient(`/offers/${id}`, {
      method: 'GET',
    }),

  accept: (id) =>
    apiClient(`/offers/${id}/accept`, {
      method: 'PATCH',
    }),

  reject: (id) =>
    apiClient(`/offers/${id}/reject`, {
      method: 'PATCH',
    }),

  cancel: (id) =>
    apiClient(`/offers/${id}/cancel`, {
      method: 'PATCH',
    }),
};

/**
 * Transaction services
 */
export const transactionService = {
  getTransactions: (params = {}) =>
    apiClient(`/transactions${toQuery(params)}`, {
      method: 'GET',
    }),

  getTransaction: (id) =>
    apiClient(`/transactions/${id}`, {
      method: 'GET',
    }),

  confirmTransaction: (id) =>
    apiClient(`/transactions/${id}/confirm`, {
      method: 'PATCH',
    }),

  cancelTransaction: (id, data = {}) =>
    apiClient(`/transactions/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export const exchangeRequestService = {
  create: (data) => apiClient('/exchange-requests', { method: 'POST', body: JSON.stringify(data) }),
  getSent: (params = {}) => apiClient(`/exchange-requests/sent${toQuery(params)}`, { method: 'GET' }),
  getReceived: (params = {}) => apiClient(`/exchange-requests/received${toQuery(params)}`, { method: 'GET' }),
  getById: (id) => apiClient(`/exchange-requests/${id}`, { method: 'GET' }),
  accept: (id) => apiClient(`/exchange-requests/${id}/accept`, { method: 'PATCH' }),
  reject: (id) => apiClient(`/exchange-requests/${id}/reject`, { method: 'PATCH' }),
  cancel: (id) => apiClient(`/exchange-requests/${id}/cancel`, { method: 'PATCH' }),
  confirmTransaction: (id) => apiClient(`/exchange-transactions/${id}/confirm`, { method: 'PATCH' }),
  cancelTransaction: (id, data = {}) =>
    apiClient(`/exchange-transactions/${id}/cancel`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const wantedPostService = {
  create: (data) => apiClient('/wanted-posts', { method: 'POST', body: JSON.stringify(data) }),
  getAll: (params = {}) => apiClient(`/wanted-posts${toQuery(params)}`, { method: 'GET' }),
  getById: (id) => apiClient(`/wanted-posts/${id}`, { method: 'GET' }),
  update: (id, data) => apiClient(`/wanted-posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    apiClient(`/wanted-posts/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => apiClient(`/wanted-posts/${id}`, { method: 'DELETE' }),
  contact: (id) => apiClient(`/wanted-posts/${id}/contact`, { method: 'POST' }),
};

export const reviewService = {
  create: (data) => apiClient('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getProductReviews: (productId, params = {}) => apiClient(`/reviews/product/${productId}${toQuery(params)}`, { method: 'GET' }),
  getUserReviews: (userId, params = {}) => apiClient(`/reviews/user/${userId}${toQuery(params)}`, { method: 'GET' }),
  getMyReviews: (params = {}) => apiClient(`/reviews/my${toQuery(params)}`, { method: 'GET' }),
  checkEligibility: (transactionId) => apiClient(`/reviews/eligible/${transactionId}`, { method: 'GET' }),
  update: (id, data) => apiClient(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiClient(`/reviews/${id}`, { method: 'DELETE' }),
};

export const reportService = {
  create: (data) => apiClient('/reports', { method: 'POST', body: JSON.stringify(data) }),
  getMyReports: (params = {}) => apiClient(`/reports/my${toQuery(params)}`, { method: 'GET' }),
  getById: (id) => apiClient(`/reports/${id}`, { method: 'GET' }),
  delete: (id) => apiClient(`/reports/${id}`, { method: 'DELETE' }),
};

export const giveawayRequestService = {
  create: (data) => apiClient('/giveaway-requests', { method: 'POST', body: JSON.stringify(data) }),
  getSent: (params = {}) => apiClient(`/giveaway-requests/sent${toQuery(params)}`, { method: 'GET' }),
  getReceived: (params = {}) => apiClient(`/giveaway-requests/received${toQuery(params)}`, { method: 'GET' }),
  getById: (id) => apiClient(`/giveaway-requests/${id}`, { method: 'GET' }),
  accept: (id) => apiClient(`/giveaway-requests/${id}/accept`, { method: 'PATCH' }),
  reject: (id) => apiClient(`/giveaway-requests/${id}/reject`, { method: 'PATCH' }),
  cancel: (id) => apiClient(`/giveaway-requests/${id}/cancel`, { method: 'PATCH' }),
};

export const adminService = {
  getAnalyticsOverview: (params = {}) => apiClient(`/admin/analytics/overview${toQuery(params)}`, { method: 'GET' }),
  getReports: (params = {}) => apiClient(`/admin/reports${toQuery(params)}`, { method: 'GET' }),
  getReportById: (id) => apiClient(`/admin/reports/${id}`, { method: 'GET' }),
  resolveReport: (id, data = {}) =>
    apiClient(`/admin/reports/${id}/resolve`, { method: 'PATCH', body: JSON.stringify(data) }),
  dismissReport: (id, data = {}) =>
    apiClient(`/admin/reports/${id}/dismiss`, { method: 'PATCH', body: JSON.stringify(data) }),
  moderateTarget: (targetType, targetId, data = {}) =>
    apiClient(`/admin/moderate/${targetType}/${targetId}`, { method: 'POST', body: JSON.stringify(data) }),
};

export const aiService = {
  generateDescription: (data) =>
    apiClient('/ai/product-description', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  suggestCategory: (data) =>
    apiClient('/ai/suggest-category', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  interpretSearchQuery: (data) =>
    apiClient('/ai/search-query', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getRecommendations: (params = {}) =>
    apiClient(`/ai/recommendations${toQuery(params)}`, {
      method: 'GET',
    }),
  askAssistant: (data) =>
    apiClient('/ai/assistant', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  estimatePrice: (data) =>
    apiClient('/ai/estimate-price', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  classifyProductImage: (formData) =>
    apiClient('/ai/classify-product-image', {
      method: 'POST',
      body: formData,
    }),
};
