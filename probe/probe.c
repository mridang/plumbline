/*
 * probe: plumbline's TLS prober, one small static binary on an empty image.
 *
 * It makes one TLS handshake per request, with OpenSSL (the library Node uses,
 * so cipher lists, signature algorithms and key groups mean exactly what the
 * checks expect), and says what the server answered. It runs in a container
 * because a Worker or a browser cannot open the connections the checks inspect.
 *
 *   POST /handshake       one handshake; the body is `key=value` lines
 *   POST /v1/handshakes   many handshakes, items separated by a `--` line; answers
 *                         {"results":[...]} in the same order
 *   POST /v1/starttls     the SMTP STARTTLS dialog of a mail server (port 25) and
 *                         what its certificate chain looked like
 *   POST /v1/http         one raw HTTP/1.1 exchange (headers exactly as sent, body
 *                         not decoded), optionally to a fixed address
 *   POST /v1/connect      whether a TCP connection to an address and port succeeds
 *   POST /v1/roots        the trusted roots, as a PEM bundle
 *   POST /v1/openssl      one `openssl s_client` run (a short list of flags) and what it printed
 *   GET  /healthz         "ok"
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

#define MAX_REQUEST 262144
#define MAX_CHILDREN 24
#define MAX_BATCH 128
#define WINDOW 8 /* handshakes of one batch at a time */
#define MAX_BODY (10L * 1024 * 1024)
#define MAX_HEADERS 24
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
  /* /v1/http */
  char ip[64], method[16], path[2048];
  int tls, nobody, nheaders;
  long maxbody;
  char headers[MAX_HEADERS][600];
  /* /v1/openssl */
  char servername[256], sess_out[96], sess_in[96];
  char flags[8][16];
  int nflags;
  unsigned char early[4096];
  size_t early_len;
  int has_early;
  unsigned char inputs[64][64];
  size_t input_len[64];
  int ninputs, delay, timeout;
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

/* How long a connection attempt may take, in milliseconds. */
static int connect_ms = STEP_SECONDS * 1000;

/* Waits for `fd` to be ready for `events`; false on timeout. */
int ready(int fd, short events) {
  struct pollfd p = {fd, events, 0};
  return poll(&p, 1, connect_ms) > 0;
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
      {NID_commonName, "CN"}, {NID_organizationName, "O"}, {NID_countryName, "C"}};
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
  fputs(",\"subjectaltname\":\"", out);
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
  fputs(",\"serialNumber\":", out);
  js(out, hex ? hex : "");
  OPENSSL_free(hex);
  BN_free(serial);
  fputs(",\"fingerprint256\":\"", out);
  X509_digest(cert, EVP_sha256(), md, &mdlen);
  for (unsigned i = 0; i < mdlen; i++) fprintf(out, "%s%02X", i ? ":" : "", md[i]);
  fputc('"', out);
  EVP_PKEY *key = X509_get0_pubkey(cert);
  int kind = key ? EVP_PKEY_base_id(key) : 0;
  fprintf(out, ",\"keyType\":\"%s\",\"bits\":%d",
          kind == EVP_PKEY_RSA ? "RSA" : kind == EVP_PKEY_EC ? "EC" : kind ? OBJ_nid2sn(kind) : "",
          key ? EVP_PKEY_bits(key) : 0);
  if (key && EVP_PKEY_base_id(key) == EVP_PKEY_EC) {
    char curve[64] = "";
    size_t n = 0;
    EVP_PKEY_get_utf8_string_param(key, "group", curve, sizeof curve, &n);
    fputs(",\"asn1Curve\":", out);
    js(out, curve);
  }
  fputs(",\"signatureAlgorithm\":", out);
  js(out, OBJ_nid2ln(X509_get_signature_nid(cert)));
  /* where the issuer's certificate and an OCSP answer can be had, as Node names them */
  AUTHORITY_INFO_ACCESS *aia = X509_get_ext_d2i(cert, NID_info_access, NULL, NULL);
  static const struct { int nid; const char *key; } methods[] = {{NID_ad_OCSP, "OCSP - URI"}, {NID_ad_ca_issuers, "CA Issuers - URI"}};
  fputs(",\"infoAccess\":{", out);
  int first_method = 1;
  for (int m = 0; m < 2; m++) {
    int first_url = 1;
    for (int i = 0; aia && i < sk_ACCESS_DESCRIPTION_num(aia); i++) {
      ACCESS_DESCRIPTION *ad = sk_ACCESS_DESCRIPTION_value(aia, i);
      if (OBJ_obj2nid(ad->method) != methods[m].nid || ad->location->type != GEN_URI) continue;
      const unsigned char *u = ASN1_STRING_get0_data(ad->location->d.uniformResourceIdentifier);
      int ulen = ASN1_STRING_length(ad->location->d.uniformResourceIdentifier);
      char url[512];
      snprintf(url, sizeof url, "%.*s", ulen < 511 ? ulen : 511, (const char *)u);
      if (first_url) {
        fprintf(out, "%s\"%s\":[", first_method ? "" : ",", methods[m].key);
        first_method = 0;
      } else fputc(',', out);
      js(out, url);
      first_url = 0;
    }
    if (!first_url) fputc(']', out);
  }
  fputc('}', out);
  AUTHORITY_INFO_ACCESS_free(aia);
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
  fputs(",\"standardName\":", out);
  js(out, SSL_CIPHER_standard_name(cipher));
  fprintf(out, "},\"authorized\":%s,\"authorizationError\":", verdict == X509_V_OK ? "true" : "false");
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

/* ---- raw HTTP and the other operations ------------------------------ */

/* Whether `s` is an IPv4 or IPv6 address literal. */
int is_ip(const char *s) {
  struct in6_addr a6;
  struct in_addr a4;
  return inet_pton(AF_INET, s, &a4) || inet_pton(AF_INET6, s, &a6);
}

/* Writes all of `data` to the connection, TLS or plain. */
int send_all(int fd, SSL *ssl, const char *data, size_t len) {
  while (len) {
    int n = ssl ? SSL_write(ssl, data, (int)len) : (int)write(fd, data, len);
    if (n <= 0) return 0;
    data += n;
    len -= (size_t)n;
  }
  return 1;
}

/* One HTTP/1.1 exchange, as the wire showed it: the status line, every header line in
 * order (duplicates kept), and the body bytes as sent (chunking and content coding are
 * left for the caller). The certificate is verified against `host`. */
void http_exchange(int fd, const struct request *r) {
  const char *why = NULL;
  int s = connect_public(r->ip[0] ? r->ip : r->host, r->port, &why);
  if (s < 0) fail(fd, why);
  SSL *ssl = NULL;
  if (r->tls) {
    SSL_CTX *ctx = SSL_CTX_new(TLS_client_method());
    if (!ctx) fail(fd, "TLS is not available");
    SSL_CTX_set_verify(ctx, SSL_VERIFY_PEER, NULL);
    SSL_CTX_load_verify_locations(ctx, CA_FILE, NULL);
    ssl = SSL_new(ctx);
    if (is_ip(r->host)) {
      X509_VERIFY_PARAM_set1_ip_asc(SSL_get0_param(ssl), r->host);
    } else {
      SSL_set_tlsext_host_name(ssl, r->host);
      SSL_set1_host(ssl, r->host);
    }
    SSL_set_fd(ssl, s);
    if (SSL_connect(ssl) != 1) {
      char message[200];
      long verdict = SSL_get_verify_result(ssl);
      unsigned long e = ERR_get_error();
      snprintf(message, sizeof message, "handshake failed: %s",
               verdict != X509_V_OK ? verify_error(verdict) : e ? ERR_reason_error_string(e) : "no answer");
      fail(fd, message);
    }
  }

  char *req = NULL;
  size_t reqlen = 0;
  FILE *q = open_memstream(&req, &reqlen);
  int standard = r->tls ? 443 : 80;
  if (r->port == standard) fprintf(q, "%s %s HTTP/1.1\r\nHost: %s\r\n", r->method, r->path, r->host);
  else fprintf(q, "%s %s HTTP/1.1\r\nHost: %s:%d\r\n", r->method, r->path, r->host, r->port);
  for (int i = 0; i < r->nheaders; i++) fprintf(q, "%s\r\n", r->headers[i]);
  fputs("Connection: close\r\n\r\n", q);
  fclose(q);
  if (!send_all(s, ssl, req, reqlen)) fail(fd, "the request could not be sent");

  long maxbody = r->maxbody > 0 && r->maxbody < MAX_BODY ? r->maxbody : MAX_BODY;
  size_t limit = (size_t)maxbody + 65536;
  size_t cap = 65536, used = 0;
  char *buf = malloc(cap + 1);
  long split_at = -1; /* an offset: the buffer moves when it grows */
  int truncated = 0;
  for (;;) {
    if (used + 16384 > cap) {
      if (cap >= limit) { truncated = 1; break; }
      cap *= 2;
      buf = realloc(buf, cap + 1);
    }
    int n = ssl ? SSL_read(ssl, buf + used, 16384) : (int)read(s, buf + used, 16384);
    if (n <= 0) break;
    used += (size_t)n;
    buf[used] = 0;
    if (split_at < 0) {
      char *found = memmem(buf, used, "\r\n\r\n", 4);
      if (found) split_at = found - buf;
    }
    if (split_at >= 0 && r->nobody) break;
  }
  if (split_at < 0) fail(fd, "no complete response");
  char *split = buf + split_at;

  /* the status line */
  char *line_end = memmem(buf, (size_t)(split - buf) + 2, "\r\n", 2);
  char version[16] = "", text[160] = "";
  int status = 0;
  *line_end = 0;
  sscanf(buf, "%15s %d", version, &status);
  const char *reason = strchr(buf, ' ');
  reason = reason ? strchr(reason + 1, ' ') : NULL;
  if (reason) snprintf(text, sizeof text, "%s", reason + 1);

  char *out_buf = NULL;
  size_t out_len = 0;
  FILE *out = open_memstream(&out_buf, &out_len);
  fputs("{\"httpVersion\":", out);
  js(out, version);
  fprintf(out, ",\"status\":%d,\"statusText\":", status);
  js(out, text);
  fputs(",\"headers\":[", out);
  char *p = line_end + 2;
  int first = 1;
  while (p < split + 2) {
    char *eol = memmem(p, (size_t)(split + 2 - p), "\r\n", 2);
    if (!eol) break;
    *eol = 0;
    char *colon = strchr(p, ':');
    if (colon) {
      *colon = 0;
      char *value = colon + 1;
      while (*value == ' ' || *value == '\t') value++;
      fputs(first ? "[" : ",[", out);
      js(out, p);
      fputc(',', out);
      js(out, value);
      fputc(']', out);
      first = 0;
    }
    p = eol + 2;
  }
  fputs("],\"body\":", out);
  unsigned char *body = (unsigned char *)split + 4;
  size_t have = used - (size_t)((char *)body - buf);
  if (r->nobody) have = 0;
  if (have > (size_t)maxbody) { have = (size_t)maxbody; truncated = 1; }
  b64(out, body, have);
  fprintf(out, ",\"truncated\":%s}", truncated ? "true" : "false");
  fclose(out);
  reply(fd, 200, "application/json", out_buf, out_len);
}

/* Whether a TCP connection to the address succeeds. */
void connect_probe(int fd, const struct request *r) {
  const char *why = NULL;
  if (r->timeout >= 500 && r->timeout <= 10000) connect_ms = r->timeout;
  int s = connect_public(r->host, r->port, &why);
  if (s >= 0) close(s);
  const char *answer = s >= 0 ? "{\"reachable\":true}" : "{\"reachable\":false}";
  reply(fd, 200, "application/json", answer, strlen(answer));
}

/* The SMTP STARTTLS dialog and the handshake that follows it, as the mail checks read them. */
void starttls_probe(int fd, const struct request *r) {
  const char *why = NULL;
  char *buf = NULL;
  size_t len = 0;
  FILE *out = open_memstream(&buf, &len);
  int s = connect_public(r->host, 25, &why);
  if (s < 0) {
    fputs("{\"reachable\":false,\"starttls\":false,\"tlsVersion\":null,\"trusted\":false,"
          "\"trustError\":null,\"hostnameMatches\":false,\"certificates\":[],\"error\":", out);
    js(out, why);
    fputc('}', out);
    fclose(out);
    reply(fd, 200, "application/json", buf, len);
  }
  why = smtp_starttls(s);
  if (why != NULL) {
    int reached = strcmp(why, "no SMTP greeting") != 0;
    fprintf(out, "{\"reachable\":%s,\"starttls\":false,\"tlsVersion\":null,\"trusted\":false,"
                 "\"trustError\":null,\"hostnameMatches\":false,\"certificates\":[],\"error\":",
            reached ? "true" : "false");
    if (reached && strstr(why, "STARTTLS")) fputs("null", out); else js(out, why);
    fputc('}', out);
    fclose(out);
    reply(fd, 200, "application/json", buf, len);
  }
  SSL_CTX *ctx = SSL_CTX_new(TLS_client_method());
  SSL_CTX_set_security_level(ctx, 0);
  SSL_CTX_set_verify(ctx, SSL_VERIFY_NONE, NULL);
  SSL_CTX_load_verify_locations(ctx, CA_FILE, NULL);
  SSL *ssl = SSL_new(ctx);
  if (!is_ip(r->host)) SSL_set_tlsext_host_name(ssl, r->host);
  SSL_set_fd(ssl, s);
  if (SSL_connect(ssl) != 1) {
    char message[200];
    unsigned long e = ERR_get_error();
    snprintf(message, sizeof message, "handshake failed: %s", e ? ERR_reason_error_string(e) : "no answer");
    fputs("{\"reachable\":true,\"starttls\":true,\"tlsVersion\":null,\"trusted\":false,"
          "\"trustError\":null,\"hostnameMatches\":false,\"certificates\":[],\"error\":", out);
    js(out, message);
    fputc('}', out);
    fclose(out);
    reply(fd, 200, "application/json", buf, len);
  }
  long verdict = SSL_get_verify_result(ssl);
  STACK_OF(X509) *chain = SSL_get_peer_cert_chain(ssl);
  X509 *leaf = SSL_get1_peer_certificate(ssl);
  int named = leaf && (is_ip(r->host) ? X509_check_ip_asc(leaf, r->host, 0) : X509_check_host(leaf, r->host, 0, 0, NULL)) == 1;
  fputs("{\"reachable\":true,\"starttls\":true,\"tlsVersion\":", out);
  js(out, SSL_get_version(ssl));
  fprintf(out, ",\"trusted\":%s,\"trustError\":", verdict == X509_V_OK ? "true" : "false");
  if (verdict == X509_V_OK) fputs("null", out); else js(out, verify_error(verdict));
  fprintf(out, ",\"hostnameMatches\":%s,\"certificates\":[", named ? "true" : "false");
  for (int i = 0; chain && i < sk_X509_num(chain); i++) {
    unsigned char *der = NULL;
    int n = i2d_X509(sk_X509_value(chain, i), &der);
    if (i) fputc(',', out);
    b64(out, der, n > 0 ? (size_t)n : 0);
    OPENSSL_free(der);
  }
  fputs("],\"error\":null}", out);
  fclose(out);
  reply(fd, 200, "application/json", buf, len);
}

/* ---- openssl s_client, for the checks that read its output ----------- */

/* The first public address of `host` as text (IPv6 in brackets), or NULL. */
const char *public_address(const char *host, char *text, size_t size) {
  struct addrinfo hints = {0}, *list = NULL;
  hints.ai_socktype = SOCK_STREAM;
  if (getaddrinfo(host, NULL, &hints, &list) != 0) return NULL;
  const char *found = NULL;
  for (struct addrinfo *a = list; a && !found; a = a->ai_next) {
    if (!public_addr(a->ai_addr)) continue;
    char plain[INET6_ADDRSTRLEN];
    if (a->ai_family == AF_INET) {
      inet_ntop(AF_INET, &((struct sockaddr_in *)a->ai_addr)->sin_addr, plain, sizeof plain);
      snprintf(text, size, "%s", plain);
    } else {
      inet_ntop(AF_INET6, &((struct sockaddr_in6 *)a->ai_addr)->sin6_addr, plain, sizeof plain);
      snprintf(text, size, "[%s]", plain);
    }
    found = text;
  }
  freeaddrinfo(list);
  return found;
}

/* A growing buffer of what a program printed, capped. */
struct capture { char *data; size_t used, cap; };

void capture_add(struct capture *c, const char *chunk, size_t n) {
  if (c->used + n > 1024 * 1024) n = c->used < 1024 * 1024 ? 1024 * 1024 - c->used : 0;
  if (c->used + n + 1 > c->cap) {
    c->cap = (c->used + n + 1) * 2;
    c->data = realloc(c->data, c->cap);
  }
  memcpy(c->data + c->used, chunk, n);
  c->used += n;
}

/* The flags `s_client` may be given besides the ones this builds itself. */
int flag_ok(const char *f) {
  static const char *allowed[] = {"-tls1_2", "-tls1_3", "-comp", "-trace", "-state", NULL};
  for (int i = 0; allowed[i]; i++) if (!strcmp(f, allowed[i])) return 1;
  return 0;
}

/* Whether a session name is made of letters, digits and underscores only. */
int name_ok(const char *s) {
  if (!*s) return 1;
  for (; *s; s++) if (!isalnum((unsigned char)*s) && *s != '_') return 0;
  return 1;
}

/* Runs `openssl s_client` against a public address and answers what it printed. */
void openssl_exec(int fd, const struct request *r) {
  char ip[80];
  if (!(r->port == 443 || r->port == 25) || !r->host[0] || !only(r->host, ".-:") ||
      !only(r->servername, ".-") || !name_ok(r->sess_out) || !name_ok(r->sess_in))
    reply(fd, 400, "text/plain", "bad request", 11);
  for (int i = 0; i < r->nflags; i++) if (!flag_ok(r->flags[i])) reply(fd, 400, "text/plain", "bad flag", 8);
  if (!public_address(r->host, ip, sizeof ip)) fail(fd, "not a public address");

  char connect[128], out_file[160] = "", in_file[160] = "", early_file[64] = "";
  snprintf(connect, sizeof connect, "%s:%d", ip, r->port);
  if (r->sess_out[0]) snprintf(out_file, sizeof out_file, "/tmp/s-%s.pem", r->sess_out);
  if (r->sess_in[0]) snprintf(in_file, sizeof in_file, "/tmp/s-%s.pem", r->sess_in);
  if (r->has_early) {
    snprintf(early_file, sizeof early_file, "/tmp/e-%d.txt", (int)getpid());
    FILE *e = fopen(early_file, "w");
    if (e) { fwrite(r->early, 1, r->early_len, e); fclose(e); }
  }

  signal(SIGCHLD, SIG_DFL); /* this process waits for its own child */
  int in[2], out[2], err[2];
  if (pipe(in) < 0 || pipe(out) < 0 || pipe(err) < 0) fail(fd, "no pipes");
  pid_t pid = fork();
  if (pid == 0) {
    dup2(in[0], 0); dup2(out[1], 1); dup2(err[1], 2);
    close(in[1]); close(out[0]); close(err[0]);
    char *argv[40];
    int n = 0;
    argv[n++] = "openssl"; argv[n++] = "s_client";
    argv[n++] = "-CAfile"; argv[n++] = CA_FILE;
    argv[n++] = "-connect"; argv[n++] = connect;
    if (r->servername[0]) { argv[n++] = "-servername"; argv[n++] = (char *)r->servername; }
    if (r->smtp) { argv[n++] = "-starttls"; argv[n++] = "smtp"; }
    for (int i = 0; i < r->nflags; i++) argv[n++] = (char *)r->flags[i];
    if (out_file[0]) { argv[n++] = "-sess_out"; argv[n++] = out_file; }
    if (in_file[0]) { argv[n++] = "-sess_in"; argv[n++] = in_file; }
    if (early_file[0]) { argv[n++] = "-early_data"; argv[n++] = early_file; }
    argv[n] = NULL;
    execv("/openssl", argv);
    _exit(127);
  }
  close(in[0]); close(out[1]); close(err[1]);
  struct capture so = {0}, se = {0};
  int next = 0, stdin_open = 1;
  int timeout_ms = r->timeout > 0 && r->timeout <= 40000 ? r->timeout : 15000;
  struct timeval start, now;
  gettimeofday(&start, NULL);
  long next_write = 0;
  int status = 0, exited = 0;
  while (!exited) {
    gettimeofday(&now, NULL);
    long elapsed = (now.tv_sec - start.tv_sec) * 1000 + (now.tv_usec - start.tv_usec) / 1000;
    if (elapsed >= timeout_ms) { kill(pid, SIGKILL); break; }
    if (stdin_open && elapsed >= next_write) {
      if (next < r->ninputs) {
        if (r->input_len[next] && write(in[1], r->inputs[next], r->input_len[next]) < 0) { /* it has gone */ }
        next++;
        next_write = elapsed + (r->delay > 0 && r->delay <= 2000 ? r->delay : 0);
      } else {
        close(in[1]);
        stdin_open = 0;
      }
      continue;
    }
    struct pollfd p[2] = {{out[0], POLLIN, 0}, {err[0], POLLIN, 0}};
    long wait = stdin_open ? next_write - elapsed : timeout_ms - elapsed;
    if (wait > timeout_ms - elapsed) wait = timeout_ms - elapsed;
    if (wait < 0) wait = 0;
    poll(p, 2, (int)(wait > 100 ? 100 : wait));
    char chunk[4096];
    for (int i = 0; i < 2; i++) {
      if (p[i].revents & (POLLIN | POLLHUP)) {
        ssize_t got = read(i ? err[0] : out[0], chunk, sizeof chunk);
        if (got > 0) capture_add(i ? &se : &so, chunk, (size_t)got);
      }
    }
    if (waitpid(pid, &status, WNOHANG) == pid) exited = 1;
  }
  if (!exited) waitpid(pid, &status, 0);
  for (int i = 0; i < 2; i++) {
    char chunk[4096];
    ssize_t got;
    while ((got = read(i ? err[0] : out[0], chunk, sizeof chunk)) > 0) capture_add(i ? &se : &so, chunk, (size_t)got);
  }
  if (early_file[0]) unlink(early_file);

  char *buf = NULL;
  size_t len = 0;
  FILE *res = open_memstream(&buf, &len);
  fputs("{\"stdout\":", res);
  b64(res, (unsigned char *)(so.data ? so.data : ""), so.used);
  fputs(",\"stderr\":", res);
  b64(res, (unsigned char *)(se.data ? se.data : ""), se.used);
  if (WIFEXITED(status)) fprintf(res, ",\"code\":%d", WEXITSTATUS(status)); else fputs(",\"code\":null", res);
  fputs(",\"files\":{}}", res);
  fclose(res);
  reply(fd, 200, "application/json", buf, len);
}

/* The trusted roots, as the PEM bundle the chains are judged against. */
void roots_reply(int fd) {
  FILE *f = fopen(CA_FILE, "r");
  if (!f) reply(fd, 500, "text/plain", "no roots", 8);
  char *buf = NULL;
  size_t len = 0;
  FILE *out = open_memstream(&buf, &len);
  char chunk[4096];
  size_t got;
  while ((got = fread(chunk, 1, sizeof chunk, f)) > 0) fwrite(chunk, 1, got, out);
  fclose(f);
  fclose(out);
  reply(fd, 200, "text/plain", buf, len);
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

/* Decodes standard base64 into `out` (at most `size` bytes); the length, or -1 when it is not base64. */
long unb64(const char *in, unsigned char *out, size_t size) {
  static signed char table[256];
  static int ready;
  if (!ready) {
    memset(table, -1, sizeof table);
    const char *a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (int i = 0; i < 64; i++) table[(unsigned char)a[i]] = (signed char)i;
    ready = 1;
  }
  size_t n = 0;
  uint32_t acc = 0;
  int bits = 0;
  for (; *in && *in != '='; in++) {
    signed char v = table[(unsigned char)*in];
    if (v < 0) return -1;
    acc = acc << 6 | (uint32_t)v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (n >= size) return -1;
      out[n++] = (unsigned char)(acc >> bits & 0xff);
    }
  }
  return (long)n;
}

/* Reads the `key=value` lines of one item; false when anything is not a key we know. */
int parse_item(char *body, struct request *r) {
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
    else if (!strcmp(line, "ip")) ok = take(r->ip, sizeof r->ip, value);
    else if (!strcmp(line, "method")) ok = take(r->method, sizeof r->method, value);
    else if (!strcmp(line, "path")) ok = take(r->path, sizeof r->path, value);
    else if (!strcmp(line, "tls")) r->tls = !strcmp(value, "1");
    else if (!strcmp(line, "nobody")) r->nobody = !strcmp(value, "1");
    else if (!strcmp(line, "maxbody")) r->maxbody = atol(value);
    else if (!strcmp(line, "servername")) ok = take(r->servername, sizeof r->servername, value);
    else if (!strcmp(line, "sess_out")) ok = take(r->sess_out, sizeof r->sess_out, value);
    else if (!strcmp(line, "sess_in")) ok = take(r->sess_in, sizeof r->sess_in, value);
    else if (!strcmp(line, "flag")) {
      ok = r->nflags < 8 && take(r->flags[r->nflags], sizeof r->flags[0], value);
      r->nflags++;
    } else if (!strcmp(line, "early_data")) {
      long n = unb64(value, r->early, sizeof r->early);
      ok = n >= 0;
      r->early_len = n >= 0 ? (size_t)n : 0;
      r->has_early = 1;
    } else if (!strcmp(line, "input")) {
      long n = r->ninputs < 64 ? unb64(value, r->inputs[r->ninputs], sizeof r->inputs[0]) : -1;
      ok = n >= 0;
      if (ok) r->input_len[r->ninputs++] = (size_t)n;
    } else if (!strcmp(line, "delay")) r->delay = atoi(value);
    else if (!strcmp(line, "timeout")) r->timeout = atoi(value);
    else if (!strcmp(line, "header")) {
      ok = r->nheaders < MAX_HEADERS && take(r->headers[r->nheaders], sizeof r->headers[0], value);
      r->nheaders++;
    } else return 0;
    if (!ok) return 0;
  }
  return 1;
}

/* A handshake: the host, TLS on 443 or STARTTLS on 25, and cipher, signature and group lists. */
int valid_handshake(const struct request *r) {
  return r->host[0] && only(r->host, ".-:") && (r->port == 443 || r->port == 25) &&
         only(r->min, ".") && only(r->max, ".") && only(r->ciphers, ":+!@=_.-") &&
         only(r->sigalgs, ":+_.-") && only(r->curves, ":_.-") && (!r->smtp || r->port == 25);
}

/* Reads and checks a handshake item. */
int parse(char *body, struct request *r) { return parse_item(body, r) && valid_handshake(r); }

/* The ports an HTTP exchange or a connection test may use. */
int allowed_port(int port) {
  return port == 25 || port == 53 || port == 80 || port == 443 || port == 8080 || port == 8443;
}

/* Whether a header line is `Name: value` with a name made of token characters. */
int header_ok(const char *line) {
  const char *colon = strchr(line, ':');
  if (!colon || colon == line) return 0;
  for (const char *c = line; c < colon; c++)
    if (!isalnum((unsigned char)*c) && !strchr("!#$%&'*+-.^_`|~", *c)) return 0;
  return 1;
}

/* An HTTP exchange: the method, the path, the headers and where to connect. */
int valid_http(const struct request *r) {
  if (!r->host[0] || !only(r->host, ".-:") || (r->ip[0] && !only(r->ip, ".:"))) return 0;
  if (!(r->port == 80 || r->port == 443 || r->port == 8080 || r->port == 8443)) return 0;
  if (!r->method[0] || !only(r->method, "")) return 0;
  if (r->path[0] != '/' || strchr(r->path, ' ')) return 0;
  if (r->nheaders > MAX_HEADERS) return 0;
  for (int i = 0; i < r->nheaders; i++) {
    if (!header_ok(r->headers[i])) return 0;
    if (!strncasecmp(r->headers[i], "host:", 5) || !strncasecmp(r->headers[i], "connection:", 11) ||
        !strncasecmp(r->headers[i], "content-length:", 15) || !strncasecmp(r->headers[i], "transfer-encoding:", 18))
      return 0;
  }
  return 1;
}

/* A connection test: an address or name, and a port from the short list. */
int valid_connect(const struct request *r) {
  return r->host[0] && only(r->host, ".-:") && allowed_port(r->port);
}

/* Runs the handshakes of a batch, WINDOW at a time (a new one starts as soon as one ends),
 * each in its own process, and answers {"results":[...]} in order. A bad item is an error
 * entry, not a failed batch. */
void batch(int fd, char *body) {
  char *items[MAX_BATCH];
  int count = 0;
  for (char *p = body; p && count < MAX_BATCH;) {
    items[count++] = p;
    char *sep = strstr(p, "\n--\n");
    if (sep) { *sep = 0; p = sep + 4; } else p = NULL;
  }
  signal(SIGCHLD, SIG_DFL);
  int rd[MAX_BATCH];
  pid_t pids[MAX_BATCH];
  char *answers[MAX_BATCH];
  size_t used[MAX_BATCH];
  for (int i = 0; i < count; i++) { rd[i] = -1; pids[i] = 0; answers[i] = NULL; used[i] = 0; }
  int started = 0, running = 0, finished = 0;
  while (finished < count) {
    while (started < count && running < WINDOW) {
      int p[2], i = started++;
      if (pipe(p) < 0) { finished++; continue; }
      pid_t pid = fork();
      if (pid == 0) {
        close(p[0]);
        alarm(LIFE_SECONDS);
        struct request r;
        if (!parse(items[i], &r)) reply(p[1], 400, "text/plain", "bad item", 8);
        handshake(p[1], &r);
      }
      close(p[1]);
      if (pid < 0) { close(p[0]); finished++; continue; }
      rd[i] = p[0];
      pids[i] = pid;
      answers[i] = malloc(65536);
      running++;
    }
    struct pollfd polls[MAX_BATCH];
    int which[MAX_BATCH], n = 0;
    for (int i = 0; i < started; i++)
      if (rd[i] >= 0) { polls[n].fd = rd[i]; polls[n].events = POLLIN; polls[n].revents = 0; which[n++] = i; }
    if (n == 0) continue;
    poll(polls, (nfds_t)n, 1000);
    for (int k = 0; k < n; k++) {
      if (!(polls[k].revents & (POLLIN | POLLHUP))) continue;
      int i = which[k];
      ssize_t got = used[i] < 65535 ? read(rd[i], answers[i] + used[i], 65535 - used[i]) : 0;
      if (got > 0) { used[i] += (size_t)got; continue; }
      close(rd[i]);
      rd[i] = -1;
      waitpid(pids[i], NULL, 0);
      answers[i][used[i]] = 0;
      running--;
      finished++;
    }
  }
  char *buf = NULL;
  size_t len = 0;
  FILE *out = open_memstream(&buf, &len);
  fputs("{\"results\":[", out);
  for (int i = 0; i < count; i++) {
    if (i) fputc(',', out);
    char *json = answers[i] ? strstr(answers[i], "\r\n\r\n") : NULL;
    if (json && (!strncmp(answers[i], "HTTP/1.1 200", 12) || !strncmp(answers[i], "HTTP/1.1 502", 12))) fputs(json + 4, out);
    else fputs("{\"error\":\"no answer\"}", out);
    free(answers[i]);
  }
  fputs("]}", out);
  fclose(out);
  reply(fd, 200, "application/json", buf, len);
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
  int post = !strncmp(in, "POST ", 5);
  if (!post) reply(fd, 404, "text/plain", "not found", 9);
  if (want > (size_t)(in + used - body)) reply(fd, 400, "text/plain", "short body", 10);
  body[want] = 0;
  struct request r;
  if (!strncmp(in, "POST /handshake ", 16)) {
    if (!parse(body, &r)) reply(fd, 400, "text/plain", "bad request", 11);
    handshake(fd, &r);
  }
  if (!strncmp(in, "POST /v1/handshakes ", 20)) {
    alarm(120);
    batch(fd, body);
  }
  if (!strncmp(in, "POST /v1/starttls ", 18)) {
    if (!parse_item(body, &r) || !r.host[0] || !only(r.host, ".-:")) reply(fd, 400, "text/plain", "bad request", 11);
    starttls_probe(fd, &r);
  }
  if (!strncmp(in, "POST /v1/connect ", 17)) {
    if (!parse_item(body, &r) || !valid_connect(&r)) reply(fd, 400, "text/plain", "bad request", 11);
    connect_probe(fd, &r);
  }
  if (!strncmp(in, "POST /v1/roots ", 15)) roots_reply(fd);
  if (!strncmp(in, "POST /v1/openssl ", 17)) {
    alarm(60);
    if (!parse_item(body, &r)) reply(fd, 400, "text/plain", "bad request", 11);
    openssl_exec(fd, &r);
  }
  if (!strncmp(in, "POST /v1/http ", 14)) {
    alarm(40);
    if (!parse_item(body, &r) || !valid_http(&r)) reply(fd, 400, "text/plain", "bad request", 11);
    http_exchange(fd, &r);
  }
  reply(fd, 404, "text/plain", "not found", 9);
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

  char fetch[] = "host=example.com\nport=443\ntls=1\nmethod=GET\npath=/robots.txt\nheader=Accept: */*\nheader=User-Agent: x\nmaxbody=1000\n";
  CHECK(parse_item(fetch, &r) && valid_http(&r) && r.tls && r.nheaders == 2 && r.maxbody == 1000);
  char fetch_ip[] = "host=example.com\nip=2606:4700::1111\nport=443\ntls=1\nmethod=GET\npath=/\n";
  CHECK(parse_item(fetch_ip, &r) && valid_http(&r) && !strcmp(r.ip, "2606:4700::1111"));
  char fetch_port[] = "host=example.com\nport=22\nmethod=GET\npath=/\n";
  CHECK(parse_item(fetch_port, &r) && !valid_http(&r));
  char fetch_method[] = "host=example.com\nport=80\nmethod=GET /x\npath=/\n";
  CHECK(parse_item(fetch_method, &r) && !valid_http(&r));
  char fetch_path[] = "host=example.com\nport=80\nmethod=GET\npath=x\n";
  CHECK(parse_item(fetch_path, &r) && !valid_http(&r));
  char fetch_space[] = "host=example.com\nport=80\nmethod=GET\npath=/a b\n";
  CHECK(parse_item(fetch_space, &r) && !valid_http(&r));
  char fetch_host_header[] = "host=example.com\nport=80\nmethod=GET\npath=/\nheader=Host: evil\n";
  CHECK(parse_item(fetch_host_header, &r) && !valid_http(&r));
  char fetch_bad_header[] = "host=example.com\nport=80\nmethod=GET\npath=/\nheader=no colon\n";
  CHECK(parse_item(fetch_bad_header, &r) && !valid_http(&r));
  char fetch_name[] = "host=example.com\nport=80\nmethod=GET\npath=/\nheader=Bad Name: x\n";
  CHECK(parse_item(fetch_name, &r) && !valid_http(&r));
  char probe_connect[] = "host=2606:4700:4700::1111\nport=53\n";
  CHECK(parse_item(probe_connect, &r) && valid_connect(&r));
  char probe_connect_port[] = "host=1.1.1.1\nport=22\n";
  CHECK(parse_item(probe_connect_port, &r) && !valid_connect(&r));
  CHECK(is_ip("1.2.3.4") && is_ip("::1") && !is_ip("example.com"));
  char sclient[] = "host=example.com\nport=443\nservername=example.com\nflag=-tls1_3\nsess_out=abc_1\ninput=UQo=\ninput=\ndelay=500\ntimeout=30000\nearly_data=R0VUIC8=\n";
  CHECK(parse_item(sclient, &r) && r.nflags == 1 && r.ninputs == 2 && r.input_len[0] == 2 && r.input_len[1] == 0);
  CHECK(r.has_early && r.early_len == 5 && !memcmp(r.early, "GET /", 5) && r.delay == 500 && r.timeout == 30000);
  CHECK(flag_ok("-tls1_2") && flag_ok("-trace") && !flag_ok("-cert") && !flag_ok("-connect") && !flag_ok("-key"));
  CHECK(name_ok("abc_1") && !name_ok("../x") && !name_ok("a b") && name_ok(""));
  unsigned char decoded[8];
  CHECK(unb64("YWI=", decoded, sizeof decoded) == 2 && decoded[0] == 'a' && decoded[1] == 'b');
  CHECK(unb64("!!!!", decoded, sizeof decoded) == -1 && unb64("YWJjZGVmZ2hp", decoded, 4) == -1);

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
