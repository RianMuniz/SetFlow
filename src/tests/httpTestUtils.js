const http = require('http');
const { createAuthApp } = require('../authHttp');

function parseJson(body) {
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    return null;
  }
}

function request({ port, method, path, body, headers = {} }) {
  return new Promise((resolve, reject) => {
    const requestBody = body !== undefined ? JSON.stringify(body) : undefined;
    const requestHeaders = Object.assign({}, headers);

    if (requestBody !== undefined) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(requestBody);
    }

    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: requestHeaders }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: responseBody, json: parseJson(responseBody) });
      });
    });

    req.on('error', reject);
    if (requestBody !== undefined) {
      req.write(requestBody);
    }
    req.end();
  });
}

function extractCookieValue(setCookieHeader, cookieName) {
  const setCookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

  for (const cookie of setCookies) {
    if (cookie && cookie.startsWith(`${cookieName}=`)) {
      const end = cookie.indexOf(';');
      return end === -1 ? cookie : cookie.slice(0, end);
    }
  }

  return null;
}

async function withServer(app, callback) {
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    await callback({ port });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

module.exports = { createAuthApp, request, extractCookieValue, withServer };
