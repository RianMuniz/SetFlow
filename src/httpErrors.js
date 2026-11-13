function createError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function sendError(response, status, code, message) {
  response.status(status).json({
    error: {
      code,
      message
    }
  });
}

module.exports = {
  createError,
  sendError
};
