class ApiResponse {
  constructor(success, data = null, message = '') {
    this.success = success;
    if (data) this.data = data;
    if (message) this.message = message;
  }
}

class SuccessResponse extends ApiResponse {
  constructor(data, message = 'Success') {
    super(true, data, message);
  }
}

class PaginatedResponse extends SuccessResponse {
  constructor(data, page, limit, total, message = 'Success') {
    super(data, message);
    this.pagination = {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Math.ceil(total / limit)
    };
  }
}

class ErrorResponse extends ApiResponse {
  constructor(message = 'Error', statusCode = 500, errors = null) {
    super(false, null, message);
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
  }
}

/**
 * Sends a service result shaped { ok, status, message, ...data } (the
 * convention of services/leadLifecycle.js, workTimer.js, corrections.js...)
 * as { success, message?, ...data }.
 */
function sendResult(res, result, successStatus = 200) {
  const { ok, status, message, ...data } = result;
  if (!ok) return res.status(status).json({ success: false, message });
  return res.status(successStatus).json({ success: true, ...(message ? { message } : {}), ...data });
}

module.exports = {
  SuccessResponse,
  PaginatedResponse,
  ErrorResponse,
  sendResult
};
