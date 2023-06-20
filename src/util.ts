import got from 'got';

export async function unwrapUrl(url: string, forceHttps = true) {
  const reqUrl = new URL(url);
  if (forceHttps) reqUrl.protocol = 'https:';

  const results = {
    requested: reqUrl.href,
    final: '',
    status: -1,
    message: '',
  };

  return got(reqUrl, { 
    throwHttpErrors: false,
    followRedirect: true,
    method: 'HEAD'
  }).then(resp => {
    results.final = resp.url.toString();
    results.message = resp.statusMessage;
    results.status = resp.statusCode;
  }).catch(err => {
    const { options } = err;
    results.final = options?.url?.toString() ?? results.requested;
    results.message = err.message;
  }).then(() => results);
}
