/*
 * probe: plumbline's TLS prober, one small static binary on an empty image.
 *
 * It makes one TLS handshake per request, with OpenSSL (the library Node uses,
 * so cipher lists, signature algorithms and key groups mean exactly what the
 * checks expect), and says what the server answered. It runs in a container
 * because a Worker or a browser cannot open the connections the checks inspect.
 *
 *   POST /handshake   one handshake; the body is `key=value` lines
 *   GET  /healthz     "ok"
 *
 * It is only reachable from the Worker that owns it, and even so it only
 * connects to public addresses, checked on the address it actually connects
 * to, so a name that resolves to a private address, or changes between
 * lookups, cannot be used to reach the inside of a network. Each request is
 * served by its own short-lived process, which is given a few seconds to live.
 *
 * Request keys: host, port, starttls (smtp), min, max (TLSv1 .. TLSv1.3),
 * ciphers, sigalgs, curves (OpenSSL syntax), ocsp (1).
 */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <openssl/bn.h>
#include <openssl/ec.h>
#include <openssl/err.h>
#include <openssl/evp.h>
#include <openssl/objects.h>
#include <openssl/ssl.h>
#include <openssl/x509v3.h>
#include <poll.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <sys/wait.h>
#include <unistd.h>

#define MAX_REQUEST 8192
#define MAX_CHILDREN 32
#define STEP_SECONDS 6 /* one connect, read or write */
#define LIFE_SECONDS 14 /* the whole request */
#define CA_FILE "/etc/ssl/certs/ca-certificates.crt"

/* ---- what a request asks for ---------------------------------------- */

struct request {
  char host[256];
  int port;
  int smtp;
  char min[16], max[16];
  char ciphers[1100], sigalgs[220], curves[120];
  int ocsp;
};

/* ---- addresses ------------------------------------------------------- */

/* Whether an IPv4 address (host order) is one a probe may connect to. */
int public_v4(uint32_t a) {
  static const struct { uint32_t net, bits; } deny[] = {
      {0x00000000, 8},  {0x0a000000, 8},  {0x64400000, 10}, {0x7f000000, 8},
      {0xa9fe0000, 16}, {0xac100000, 12}, {0xc0000000, 24}, {0xc0000200, 24},
      {0xc0a80000, 16}, {0xc6120000, 15}, {0xc6336400, 24}, {0xcb007100, 24},
      {0xe0000000, 4},  {0xf0000000, 4},
  };
  for (unsigned i = 0; i < sizeof deny / sizeof deny[0]; i++) {
    uint32_t mask = deny[i].bits == 0 ? 0 : ~0u << (32 - deny[i].bits);
    if ((a & mask) == deny[i].net) return 0;
  }
  return 1;
}

/* Whether an IPv6 address is one a probe may connect to: global unicast only. */
int public_v6(const unsigned char *a) {
  static const unsigned char mapped[12] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff};
  if (memcmp(a, mapped, 12) == 0) {
    return public_v4((uint32_t)a[12] << 24 | a[13] << 16 | a[14] << 8 | a[15]);
  }
  if ((a[0] & 0xe0) != 0x20) return 0;                       /* not 2000::/3 */
  if (a[0] == 0x20 && a[1] == 0x01 && a[2] == 0x0d && a[3] == 0xb8) return 0; /* documentation */
  if (a[0] == 0x20 && a[1] == 0x02) return 0;                /* 6to4 */
  if (a[0] == 0x20 && a[1] == 0x01 && a[2] == 0 && a[3] == 0) return 0; /* Teredo */
  return 1;
}

/* Whether a socket address is one a probe may connect to. */
int public_addr(const struct sockaddr *sa) {
  if (sa->sa_family == AF_INET)
    return public_v4(ntohl(((const struct sockaddr_in *)sa)->sin_addr.s_addr));
  if (sa->sa_family == AF_INET6)
    return public_v6(((const struct sockaddr_in6 *)sa)->sin6_addr.s6_addr);
  return 0;
}

/* ---- output ---------------------------------------------------------- */

/* Writes `s` as a JSON string. */
void js(FILE *out, const char *s) {
  fputc('"', out);
  for (; *s; s++) {
    unsigned char c = (unsigned char)*s;
    if (c == '"' || c == '\\') fprintf(out, "\\%c", c);
    else if (c < 0x20) fprintf(out, "\\u%04x", c);
    else fputc(c, out);
  }
  fputc('"', out);
}

/* Writes `len` bytes as a base64 JSON string. */
void b64(FILE *out, const unsigned char *p, size_t len) {
  static const char t[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  fputc('"', out);
  for (size_t i = 0; i < len; i += 3) {
    uint32_t v = p[i] << 16 | (i + 1 < len ? p[i + 1] << 8 : 0) | (i + 2 < len ? p[i + 2] : 0);
    fputc(t[v >> 18 & 63], out);
    fputc(t[v >> 12 & 63], out);
    fputc(i + 1 < len ? t[v >> 6 & 63] : '=', out);
    fputc(i + 2 < len ? t[v & 63] : '=', out);
  }
  fputc('"', out);
}

/* Sends a complete response and ends the process. */
void reply(int fd, int status, const char *type, const char *body, size_t len) {
  char head[160];
  int n = snprintf(head, sizeof head,
                   "HTTP/1.1 %d X\r\nContent-Type: %s\r\nContent-Length: %zu\r\nConnection: close\r\n\r\n",
                   status, type, len);
  if (write(fd, head, n) < 0 || write(fd, body, len) < 0) _exit(1);
  _exit(0);
}

/* Sends `{"error": ...}` with status 502 and ends the process. */
void fail(int fd, const char *message) {
  char *buf = NULL;
  size_t len = 0;
  FILE *out = open_memstream(&buf, &len);
  fputs("{\"error\":", out);
  js(out, message);
  fputc('}', out);
  fclose(out);
  reply(fd, 502, "application/json", buf, len);
}

/* ---- the connection -------------------------------------------------- */

/* Waits for `fd` to be ready for `events`; false on timeout. */
int ready(int fd, short events) {
  struct pollfd p = {fd, events, 0};
  return poll(&p, 1, STEP_SECONDS * 1000) > 0;
}

/* Connects to a public address of `host`; -1 and a message in `*why` on failure. */
int connect_public(const char *host, int port, const char **why) {
  struct addrinfo hints = {0}, *list = NULL;
  char service[8];
  hints.ai_socktype = SOCK_STREAM;
  snprintf(service, sizeof service, "%d", port);
  if (getaddrinfo(host, service, &hints, &list) != 0) {
    *why = "the name does not resolve";
    return -1;
  }
  int fd = -1;
  *why = "not a public address";
  for (struct addrinfo *a = list; a && fd < 0; a = a->ai_next) {
    if (!public_addr(a->ai_addr)) continue;
    int s = socket(a->ai_family, SOCK_STREAM | SOCK_NONBLOCK, 0);
    if (s < 0) continue;
    *why = "the connection failed";
    if (connect(s, a->ai_addr, a->ai_addrlen) < 0 && errno == EINPROGRESS && ready(s, POLLOUT)) {
      int err = 0;
      socklen_t n = sizeof err;
      getsockopt(s, SOL_SOCKET, SO_ERROR, &err, &n);
      if (err == 0) fd = s;
    } 
    if (fd < 0) close(s);
  }
  freeaddrinfo(list);
  if (fd >= 0) {
    struct timeval tv = {STEP_SECONDS, 0};
    int blocking = fcntl(fd, F_GETFL) & ~O_NONBLOCK;
    fcntl(fd, F_SETFL, blocking);
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);
  }
  return fd;
}

/* Reads one SMTP reply (possibly several lines) and returns its code, or 0. */
int smtp_reply(int fd, char *text, size_t size) {
  size_t used = 0;
  for (;;) {
    char c;
    if (read(fd, &c, 1) != 1) return 0;
    if (used + 1 < size) text[used++] = c;
    if (c == '\n') {
      size_t start = used;
      while (start > 1 && text[start - 2] != '\n') start--;
      text[used] = 0;
      if (used - start + 1 >= 4 && text[start - 1 + 3] != '-') return atoi(text + start - 1);
    }
  }
}

/* Runs the SMTP dialog up to the point the handshake can begin. */
const char *smtp_starttls(int fd) {
  char text[2048];
  static const char ehlo[] = "EHLO probe.invalid\r\n", start[] = "STARTTLS\r\n";
  if (smtp_reply(fd, text, sizeof text) != 220) return "no SMTP greeting";
  if (write(fd, ehlo, sizeof ehlo - 1) < 0 || smtp_reply(fd, text, sizeof text) != 250)
    return "EHLO refused";
  for (char *p = text; *p; p++) *p = toupper((unsigned char)*p);
  if (!strstr(text, "STARTTLS")) return "STARTTLS is not offered";
  if (write(fd, start, sizeof start - 1) < 0 || smtp_reply(fd, text, sizeof text) != 220)
    return "STARTTLS refused";
  return NULL;
}

/* ---- the handshake --------------------------------------------------- */

/* The TLS version constant for a name, or 0 for none. */
int version_of(const char *name) {
  if (!strcmp(name, "TLSv1")) return TLS1_VERSION;
  if (!strcmp(name, "TLSv1.1")) return TLS1_1_VERSION;
  if (!strcmp(name, "TLSv1.2")) return TLS1_2_VERSION;
  if (!strcmp(name, "TLSv1.3")) return TLS1_3_VERSION;
  return 0;
}

/* The name Node gives a verification failure. */
const char *verify_error(long code) {
  switch (code) {
    case X509_V_ERR_UNABLE_TO_GET_ISSUER_CERT_LOCALLY: return "UNABLE_TO_GET_ISSUER_CERT_LOCALLY";
    case X509_V_ERR_UNABLE_TO_VERIFY_LEAF_SIGNATURE: return "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    case X509_V_ERR_DEPTH_ZERO_SELF_SIGNED_CERT: return "DEPTH_ZERO_SELF_SIGNED_CERT";
    case X509_V_ERR_SELF_SIGNED_CERT_IN_CHAIN: return "SELF_SIGNED_CERT_IN_CHAIN";
    case X509_V_ERR_CERT_HAS_EXPIRED: return "CERT_HAS_EXPIRED";
    case X509_V_ERR_CERT_NOT_YET_VALID: return "CERT_NOT_YET_VALID";
    case X509_V_ERR_CERT_REVOKED: return "CERT_REVOKED";
    case X509_V_ERR_INVALID_PURPOSE: return "INVALID_PURPOSE";
    default: return X509_verify_cert_error_string(code);
  }
}

/* Writes a certificate's name as `{"CN":..,"O":..,"C":..}`. */
void name_json(FILE *out, X509_NAME *name) {
  static const struct { int nid; const char *key; } parts[] = {
      {NID_commonName, "common_name"}, {NID_organizationName, "organization"}, {NID_countryName, "country"}};
  int first = 1;
  fputc('{', out);
  for (int i = 0; i < 3; i++) {
    int at = X509_NAME_get_index_by_NID(name, parts[i].nid, -1);
    if (at < 0) continue;
    unsigned char *text = NULL;
    if (ASN1_STRING_to_UTF8(&text, X509_NAME_ENTRY_get_data(X509_NAME_get_entry(name, at))) < 0) continue;
    fprintf(out, "%s\"%s\":", first ? "" : ",", parts[i].key);
    js(out, (char *)text);
    OPENSSL_free(text);
    first = 0;
  }
  fputc('}', out);
}

/* Writes a time as Node does: "Jan  1 00:00:00 2026 GMT". */
void time_json(FILE *out, const ASN1_TIME *t) {
  BIO *bio = BIO_new(BIO_s_mem());
  char *text = NULL;
  ASN1_TIME_print(bio, t);
  long n = BIO_get_mem_data(bio, &text);
  char copy[64];
  snprintf(copy, sizeof copy, "%.*s", (int)(n < 63 ? n : 63), text);
  js(out, copy);
  BIO_free(bio);
}

/* Writes the facts of one certificate. */
void cert_json(FILE *out, X509 *cert) {
  unsigned char md[EVP_MAX_MD_SIZE];
  unsigned int mdlen = 0;
  fputs("{\"subject\":", out);
  name_json(out, X509_get_subject_name(cert));
  fputs(",\"issuer\":", out);
  name_json(out, X509_get_issuer_name(cert));
  fputs(",\"subject_alt_names\":\"", out);
  GENERAL_NAMES *names = X509_get_ext_d2i(cert, NID_subject_alt_name, NULL, NULL);
  int first = 1;
  for (int i = 0; names && i < sk_GENERAL_NAME_num(names); i++) {
    GENERAL_NAME *g = sk_GENERAL_NAME_value(names, i);
    if (g->type != GEN_DNS) continue;
    const unsigned char *d = ASN1_STRING_get0_data(g->d.dNSName);
    fprintf(out, "%sDNS:", first ? "" : ", ");
    for (int k = 0; k < ASN1_STRING_length(g->d.dNSName); k++)
      if (isalnum(d[k]) || strchr(".-*_", d[k])) fputc(d[k], out);
    first = 0;
  }
  GENERAL_NAMES_free(names);
  fputs("\",\"valid_from\":", out);
  time_json(out, X509_get0_notBefore(cert));
  fputs(",\"valid_to\":", out);
  time_json(out, X509_get0_notAfter(cert));
  BIGNUM *serial = ASN1_INTEGER_to_BN(X509_get_serialNumber(cert), NULL);
  char *hex = serial ? BN_bn2hex(serial) : NULL;
  fputs(",\"serial_number\":", out);
  js(out, hex ? hex : "");
  OPENSSL_free(hex);
  BN_free(serial);
  fputs(",\"fingerprint256\":\"", out);
  X509_digest(cert, EVP_sha256(), md, &mdlen);
  for (unsigned i = 0; i < mdlen; i++) fprintf(out, "%s%02X", i ? ":" : "", md[i]);
  fputc('"', out);
  EVP_PKEY *key = X509_get0_pubkey(cert);
  int kind = key ? EVP_PKEY_base_id(key) : 0;
  fprintf(out, ",\"key_type\":\"%s\",\"bits\":%d",
          kind == EVP_PKEY_RSA ? "RSA" : kind == EVP_PKEY_EC ? "EC" : kind ? OBJ_nid2sn(kind) : "",
          key ? EVP_PKEY_bits(key) : 0);
  if (key && EVP_PKEY_base_id(key) == EVP_PKEY_EC) {
    char curve[64] = "";
    size_t n = 0;
    EVP_PKEY_get_utf8_string_param(key, "group", curve, sizeof curve, &n);
    fputs(",\"asn1_curve\":", out);
    js(out, curve);
  }
  fputs(",\"signature_algorithm\":", out);
  js(out, OBJ_nid2ln(X509_get_signature_nid(cert)));
  fputc('}', out);
}

/* Makes the handshake and writes what it showed as JSON. */
void handshake(int fd, const struct request *r) {
  const char *why = NULL;
  int s = connect_public(r->host, r->port, &why);
  if (s < 0) fail(fd, why);
  if (r->smtp && (why = smtp_starttls(s)) != NULL) fail(fd, why);

  SSL_CTX *ctx = SSL_CTX_new(TLS_client_method());
  if (!ctx) fail(fd, "TLS is not available");
  SSL_CTX_set_security_level(ctx, 0); /* the point is to see what the server accepts */
  SSL_CTX_set_min_proto_version(ctx, version_of(r->min) ? version_of(r->min) : TLS1_VERSION);
  SSL_CTX_set_max_proto_version(ctx, version_of(r->max) ? version_of(r->max) : TLS1_3_VERSION);
  if (r->ciphers[0] && SSL_CTX_set_cipher_list(ctx, r->ciphers) != 1) fail(fd, "no cipher suite to offer");
  if (r->sigalgs[0] && SSL_CTX_set1_sigalgs_list(ctx, r->sigalgs) != 1) fail(fd, "no signature algorithm to offer");
  if (r->curves[0] && SSL_CTX_set1_groups_list(ctx, r->curves) != 1) fail(fd, "no key group to offer");
  SSL_CTX_set_verify(ctx, SSL_VERIFY_NONE, NULL); /* judged below, so the chain is reported either way */
  SSL_CTX_load_verify_locations(ctx, CA_FILE, NULL);

  SSL *ssl = SSL_new(ctx);
  struct in6_addr probe6;
  struct in_addr probe4;
  if (!inet_pton(AF_INET, r->host, &probe4) && !inet_pton(AF_INET6, r->host, &probe6))
    SSL_set_tlsext_host_name(ssl, r->host);
  if (r->ocsp) SSL_set_tlsext_status_type(ssl, TLSEXT_STATUSTYPE_ocsp);
  SSL_set_fd(ssl, s);
  if (SSL_connect(ssl) != 1) {
    char message[200];
    unsigned long e = ERR_get_error();
    snprintf(message, sizeof message, "handshake failed: %s", e ? ERR_reason_error_string(e) : "no answer");
    fail(fd, message);
  }

  char *buf = NULL;
  size_t len = 0;
  FILE *out = open_memstream(&buf, &len);
  const SSL_CIPHER *cipher = SSL_get_current_cipher(ssl);
  long verdict = SSL_get_verify_result(ssl);
  fputs("{\"protocol\":", out);
  js(out, SSL_get_version(ssl));
  fputs(",\"cipher\":{\"name\":", out);
  js(out, SSL_CIPHER_get_name(cipher));
  fputs(",\"standard_name\":", out);
  js(out, SSL_CIPHER_standard_name(cipher));
  fprintf(out, "},\"authorized\":%s,\"authorization_error\":", verdict == X509_V_OK ? "true" : "false");
  if (verdict == X509_V_OK) fputs("null", out); else js(out, verify_error(verdict));

  EVP_PKEY *tmp = NULL;
  fputs(",\"ephemeral\":", out);
  if (SSL_get_peer_tmp_key(ssl, &tmp) == 1 && tmp) {
    int type = EVP_PKEY_base_id(tmp);
    if (type == EVP_PKEY_DH) {
      fprintf(out, "{\"type\":\"DH\",\"size\":%d}", EVP_PKEY_bits(tmp));
    } else {
      /* Node names the curve as OpenSSL's command line does. */
      const char *group = SSL_get0_group_name(ssl);
      if (!group) group = "";
      if (!strcmp(group, "secp256r1")) group = "prime256v1";
      if (!strcmp(group, "x25519")) group = "X25519";
      if (!strcmp(group, "x448")) group = "X448";
      fprintf(out, "{\"type\":\"ECDH\",\"size\":%d,\"name\":", EVP_PKEY_bits(tmp));
      js(out, group);
      fputc('}', out);
    }
    EVP_PKEY_free(tmp);
  } else {
    fputs("null", out);
  }

  STACK_OF(X509) *chain = SSL_get_peer_cert_chain(ssl);
  int count = chain ? sk_X509_num(chain) : 0;
  fputs(",\"chain\":[", out);
  for (int i = 0; i < count; i++) {
    unsigned char *der = NULL;
    int n = i2d_X509(sk_X509_value(chain, i), &der);
    if (i) fputc(',', out);
    b64(out, der, n > 0 ? n : 0);
    OPENSSL_free(der);
  }
  fputs("],\"certificates\":[", out);
  for (int i = 0; i < count; i++) {
    if (i) fputc(',', out);
    cert_json(out, sk_X509_value(chain, i));
  }
  const unsigned char *ocsp = NULL;
  long ocsp_len = r->ocsp ? SSL_get_tlsext_status_ocsp_resp(ssl, &ocsp) : -1;
  fputs("],\"ocsp\":", out);
  if (ocsp && ocsp_len > 0) b64(out, ocsp, ocsp_len); else fputs("null", out);
  fprintf(out, ",\"compression\":%s}", SSL_get_current_compression(ssl) ? "true" : "false");
  fclose(out);
  reply(fd, 200, "application/json", buf, len);
}

/* ---- requests -------------------------------------------------------- */

/* Copies `value` into `dst` when it is no longer than `size` and has no control characters. */
int take(char *dst, size_t size, const char *value) {
  size_t n = strlen(value);
  if (n >= size) return 0;
  for (size_t i = 0; i < n; i++)
    if ((unsigned char)value[i] < 0x20 || value[i] == 0x7f) return 0;
  memcpy(dst, value, n + 1);
  return 1;
}

/* Whether every character of `s` is in `allowed` or alphanumeric. */
int only(const char *s, const char *allowed) {
  for (; *s; s++)
    if (!isalnum((unsigned char)*s) && !strchr(allowed, *s)) return 0;
  return 1;
}

/* Reads the `key=value` lines of a body; false when anything is not valid. */
int parse(char *body, struct request *r) {
  memset(r, 0, sizeof *r);
  for (char *line = strtok(body, "\n"); line; line = strtok(NULL, "\n")) {
    char *eq = strchr(line, '=');
    if (!eq) return 0;
    *eq = 0;
    char *value = eq + 1;
    size_t n = strlen(value);
    if (n && value[n - 1] == '\r') value[n - 1] = 0;
    int ok = 1;
    if (!strcmp(line, "host")) ok = take(r->host, sizeof r->host, value);
    else if (!strcmp(line, "port")) r->port = atoi(value);
    else if (!strcmp(line, "starttls")) r->smtp = !strcmp(value, "smtp");
    else if (!strcmp(line, "min")) ok = take(r->min, sizeof r->min, value);
    else if (!strcmp(line, "max")) ok = take(r->max, sizeof r->max, value);
    else if (!strcmp(line, "ciphers")) ok = take(r->ciphers, sizeof r->ciphers, value);
    else if (!strcmp(line, "sigalgs")) ok = take(r->sigalgs, sizeof r->sigalgs, value);
    else if (!strcmp(line, "curves")) ok = take(r->curves, sizeof r->curves, value);
    else if (!strcmp(line, "ocsp")) r->ocsp = !strcmp(value, "1");
    else return 0;
    if (!ok) return 0;
  }
  return r->host[0] && only(r->host, ".-:") && (r->port == 443 || r->port == 25) &&
         only(r->min, ".") && only(r->max, ".") && only(r->ciphers, ":+!@=_.-") &&
         only(r->sigalgs, ":+_.-") && only(r->curves, ":_.-") && (!r->smtp || r->port == 25);
}

/* Serves the connection `fd`, in its own process, and never returns. */
void serve(int fd) {
  static char in[MAX_REQUEST + 1];
  size_t used = 0;
  char *end = NULL;
  alarm(LIFE_SECONDS);
  struct timeval tv = {STEP_SECONDS, 0};
  setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
  while (!end && used < MAX_REQUEST) {
    ssize_t n = read(fd, in + used, MAX_REQUEST - used);
    if (n <= 0) _exit(1);
    used += n;
    in[used] = 0;
    end = strstr(in, "\r\n\r\n");
  }
  if (!end) reply(fd, 431, "text/plain", "too large", 9);
  *end = 0;
  char *body = end + 4;
  char *length = strcasestr(in, "content-length:");
  size_t want = length ? (size_t)atoi(length + 15) : 0;
  while ((size_t)(in + used - body) < want && used < MAX_REQUEST) {
    ssize_t n = read(fd, in + used, MAX_REQUEST - used);
    if (n <= 0) break;
    used += n;
  }
  in[used] = 0;
  if (!strncmp(in, "GET /healthz ", 13)) reply(fd, 200, "text/plain", "ok", 2);
  if (strncmp(in, "POST /handshake ", 16) != 0) reply(fd, 404, "text/plain", "not found", 9);
  if (want > (size_t)(in + used - body)) reply(fd, 400, "text/plain", "short body", 10);
  body[want] = 0;
  struct request r;
  if (!parse(body, &r)) reply(fd, 400, "text/plain", "bad request", 11);
  handshake(fd, &r);
}

#ifndef SELFTEST

static volatile sig_atomic_t children;

/* Counts the children that ended. */
void reaped(int sig) {
  (void)sig;
  while (waitpid(-1, NULL, WNOHANG) > 0) children--;
}

int main(void) {
  const char *port = getenv("PORT");
  struct sockaddr_in6 addr = {0};
  int on = 1, off = 0;
  signal(SIGCHLD, reaped);
  signal(SIGPIPE, SIG_IGN);
  int listener = socket(AF_INET6, SOCK_STREAM, 0);
  setsockopt(listener, SOL_SOCKET, SO_REUSEADDR, &on, sizeof on);
  setsockopt(listener, IPPROTO_IPV6, IPV6_V6ONLY, &off, sizeof off);
  addr.sin6_family = AF_INET6;
  addr.sin6_addr = in6addr_any;
  addr.sin6_port = htons(port ? atoi(port) : 8080);
  if (bind(listener, (struct sockaddr *)&addr, sizeof addr) < 0 || listen(listener, 64) < 0) {
    perror("probe");
    return 1;
  }
  for (;;) {
    int fd = accept(listener, NULL, NULL);
    if (fd < 0) continue;
    if (children >= MAX_CHILDREN) {
      static const char busy[] = "HTTP/1.1 503 X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
      if (write(fd, busy, sizeof busy - 1) < 0) { /* the client is gone */ }
      close(fd);
      continue;
    }
    children++;
    pid_t pid = fork();
    if (pid == 0) {
      close(listener);
      serve(fd);
    }
    if (pid < 0) children--;
    close(fd);
  }
}

#else /* SELFTEST: `cc -DSELFTEST probe.c -lssl -lcrypto && ./a.out` */

static int failures;
#define CHECK(cond) do { if (!(cond)) { fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #cond); failures++; } } while (0)

static int v4(const char *text) { struct in_addr a; inet_pton(AF_INET, text, &a); return public_v4(ntohl(a.s_addr)); }
static int v6(const char *text) { struct in6_addr a; inet_pton(AF_INET6, text, &a); return public_v6(a.s6_addr); }

int main(void) {
  CHECK(v4("93.184.216.34") && v4("1.1.1.1"));
  CHECK(!v4("127.0.0.1") && !v4("10.1.2.3") && !v4("172.16.0.1") && !v4("172.31.255.255"));
  CHECK(v4("172.32.0.1") && !v4("192.168.1.1") && !v4("169.254.169.254"));
  CHECK(!v4("100.64.0.1") && !v4("198.18.0.1") && !v4("0.0.0.0") && !v4("224.0.0.1") && !v4("255.255.255.255"));
  CHECK(v6("2606:4700:4700::1111") && !v6("::1") && !v6("fe80::1") && !v6("fc00::1") && !v6("::"));
  CHECK(!v6("::ffff:10.0.0.1") && v6("::ffff:93.184.216.34"));
  CHECK(!v6("64:ff9b::a00:1") && !v6("2001:db8::1") && !v6("2002::1") && !v6("2001::1"));

  char body[] = "host=example.com\nport=443\nmin=TLSv1.2\nciphers=ECDHE-RSA-AES128-GCM-SHA256:@SECLEVEL=0\nocsp=1\n";
  struct request r;
  CHECK(parse(body, &r) && r.port == 443 && r.ocsp && !strcmp(r.min, "TLSv1.2"));
  char mail[] = "host=mx.example.com\nport=25\nstarttls=smtp\n";
  CHECK(parse(mail, &r) && r.smtp);
  char odd_port[] = "host=example.com\nport=22\n";
  CHECK(!parse(odd_port, &r));
  char starttls_443[] = "host=example.com\nport=443\nstarttls=smtp\n";
  CHECK(!parse(starttls_443, &r));
  char shell[] = "host=example.com;ls\nport=443\n";
  CHECK(!parse(shell, &r));
  char unknown[] = "host=example.com\nport=443\nextra=1\n";
  CHECK(!parse(unknown, &r));
  char bad_cipher[] = "host=example.com\nport=443\nciphers=A B\n";
  CHECK(!parse(bad_cipher, &r));
  char no_host[] = "port=443\n";
  CHECK(!parse(no_host, &r));

  char *buf = NULL; size_t len = 0;
  FILE *out = open_memstream(&buf, &len);
  js(out, "a\"b\\c\n"); b64(out, (const unsigned char *)"ab", 2);
  fclose(out);
  CHECK(!strcmp(buf, "\"a\\\"b\\\\c\\u000a\"\"YWI=\""));
  CHECK(version_of("TLSv1.3") == TLS1_3_VERSION && version_of("SSLv3") == 0);
  CHECK(!strcmp(verify_error(X509_V_ERR_CERT_HAS_EXPIRED), "CERT_HAS_EXPIRED"));
  if (failures == 0) puts("ok");
  return failures != 0;
}

#endif
