const responseHelper = {
  success(res, data, message = 'Success', statusCode = 200) {
    const response = { success: true, message };
    if (data !== undefined) {
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        Object.assign(response, data);
      } else {
        response.data = data;
      }
    }
    return res.status(statusCode).json(response);
  },

  error(res, message, error = null, statusCode = 500) {
    const response = {
      success: false,
      message
    };
    if (error && process.env.NODE_ENV !== 'production') {
      response.error = typeof error === 'string' ? error : error.message;
      response.stack = error.stack;
    } else if (error) {
      response.error = typeof error === 'string' ? error : error.message;
    }
    return res.status(statusCode).json(response);
  },

  created(res, data, message = 'Created successfully') {
    return this.success(res, data, message, 201);
  },

  badRequest(res, message, error = null) {
    return this.error(res, message, error, 400);
  },

  notFound(res, message = 'Resource not found') {
    return this.error(res, message, null, 404);
  },

  unauthorized(res, message = 'Not authorized') {
    return this.error(res, message, null, 401);
  }
};

module.exports = responseHelper;
