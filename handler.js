const AWS = require('aws-sdk');
const S3 = new AWS.S3();
const url = require('url');

function getPath () {
  return new Promise((resolve, reject) => {
    let path = generatePath();
    isPathFree(path).then(isFree => {
        return isFree ? resolve(path) : resolve(getPath())
      });
  });
}

function isPathFree (path) {
  return S3.headObject(buildRedirect(path)).promise()
    .then(() => Promise.resolve(false))
    .catch(function (err) {
      if (err.code == 'NotFound') return Promise.resolve(true);
      else return Promise.reject(err);
    });
}

function buildRedirect (path, longUrl = false) {
  let redirect = {
    'Bucket': config.BUCKET,
    'Key': path
  }
  if (longUrl) redirect['WebsiteRedirectLocation'] = longUrl;
  return redirect;
}

function generatePath (path = '') {
  let characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let position = Math.floor(Math.random() * characters.length);
  let character = characters.charAt(position);
  if (path.length === 7) return path;
  return generatePath(path + character);
}

function saveRedirect (redirect) {
  return S3.putObject(redirect).promise()
    .then(() => Promise.resolve(redirect['Key']))
    .catch(() => Promise.reject({
      statusCode: 500,
      message: 'Error saving redirect'
    }));
}

function validate (longUrl) {
  if (longUrl === '') {
    return Promise.reject({
      statusCode: 400,
      message: 'URL is required'
    });
  }
  let parsedUrl = url.parse(longUrl);
  if (parsedUrl.protocol === null || parsedUrl.host === null) {
    return Promise.reject({
      statusCode: 400,
      message: 'URL is invalid'
    });
  }

  return Promise.resolve(longUrl);
}

function buildResponse(statusCode, message, path = false) {
  const body = { message };
  if (path) body['path'] = path;
  return {
    headers: { 'Access-Control-Allow-Origin': '*' },
    statusCode: statusCode,
    body: JSON.stringify(body)
  }
}

module.exports.urlShortener = (event, context, callback) => {
  let longUrl = JSON.parse(event.body).url || '';
  let response = '';
  validate(longUrl).then(() => getPath()).then(path => {
    response = buildResponse(200, 'success', path);
    return Promise.resolve(response);
  }).catch(err => {
    response = buildResponse(err.statusCode, err.message);
    return Promise.reject(response);
  }).then(response => {
    callback(null, response);
  });
};
