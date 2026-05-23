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

module.exports = {
  SuccessResponse,
  PaginatedResponse,
  ErrorResponse
};
