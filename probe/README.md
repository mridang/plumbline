# plumbline probe

The part of a scan that needs real sockets: one small static binary (about 2 MB on an empty
image) built on OpenSSL. The Worker runs every check; it asks the probe only for what a Worker
cannot do itself: TLS handshakes with chosen versions, ciphers, signature algorithms and key
groups, STARTTLS on mail servers, TCP connections to chosen addresses and ports, and HTTP
exchanges whose headers must arrive exactly as the site sent them (a Worker's `fetch` drops
`Alt-Svc` and decodes `Content-Encoding`).

The probe only connects to public addresses, checked on the address it actually connects to,
and only on a short list of ports. Every request is served by its own short-lived process.

## Protocol, version 1

Requests are `POST` with a body of `key=value` lines (no JSON, so nothing needs parsing but
lines). Answers are JSON. A refused or failed item answers `{"error": "..."}`.

| Path                  | Body keys                                                                                                                                                 | Answer                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /healthz`        |                                                                                                                                                           | `ok`                                                                                                                                                                       |
| `POST /handshake`     | `host`, `port` (443 or 25), `starttls=smtp`, `min`, `max` (`TLSv1`..`TLSv1.3`), `ciphers`, `sigalgs`, `curves` (OpenSSL syntax), `ocsp=1`                 | `protocol`, `cipher{name,standardName}`, `authorized`, `authorizationError`, `ephemeral`, `chain[]` (DER, base64, leaf first), `certificates[]`, `ocsp`, `compression`     |
| `POST /v1/handshakes` | up to 128 handshake items, separated by a line holding only `--`                                                                                          | `{"results":[...]}`, one entry for each item, in order                                                                                                                     |
| `POST /v1/starttls`   | `host` (port 25 is implied)                                                                                                                               | `reachable`, `starttls`, `tlsVersion`, `trusted`, `trustError`, `hostnameMatches`, `certificates[]` (DER, base64), `error`                                                 |
| `POST /v1/connect`    | `host`, `port` (25, 53, 80, 443, 8080, 8443)                                                                                                              | `{"reachable": true}` or `false`                                                                                                                                           |
| `POST /v1/http`       | `host`, `port` (80, 443, 8080, 8443), `tls=1`, `ip` (connect here, send `host`), `method`, `path`, `header=Name: value` (up to 24), `nobody=1`, `maxbody` | `httpVersion`, `status`, `statusText`, `headers[[name,value]]` in order with duplicates, `body` (base64, as sent: chunking and content coding are not undone), `truncated` |

`/v1/http` sends HTTP/1.1 with `Connection: close`, verifies the certificate against `host`, and
never follows a redirect. It refuses `Host`, `Connection`, `Content-Length` and
`Transfer-Encoding` headers; the probe writes those itself.

## Build and test

`docker build probe` builds OpenSSL from its pinned release tarball with everything the probe
does not use switched off, runs the self-test (`-DSELFTEST`) and then builds the static binary.
