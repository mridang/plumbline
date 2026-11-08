# The whole prober is one small static binary on an empty image: about a
# megabyte, no shell, no package manager, nothing else to start or to attack.
#
# OpenSSL is built here from its release tarball (pinned by hash) with
# everything the prober does not use switched off: no engines, no legacy
# provider, no DTLS, no compression, none of the ciphers and hashes a TLS
# client never offers. CAMELLIA, ARIA, SEED and IDEA stay, because the checks
# rate them and a server that still accepts them has to be seen. What is left is the TLS client, the certificate code
# and the key exchanges the checks need to see, including the weak ones
# (old protocol versions, old suites) a server may still accept.
FROM alpine:3.20 AS build
RUN apk add --no-cache build-base perl linux-headers upx ca-certificates curl zlib-dev zlib-static
WORKDIR /build
ARG OPENSSL=3.3.2
ARG OPENSSL_SHA256=2e8a40b01979afe8be0bbfb3de5dc1c6709fedb46d6c89c10da114ab5fc3d281
RUN curl -fsSL -o openssl.tar.gz \
      "https://github.com/openssl/openssl/releases/download/openssl-${OPENSSL}/openssl-${OPENSSL}.tar.gz" \
 && echo "${OPENSSL_SHA256}  openssl.tar.gz" | sha256sum -c - \
 && tar xzf openssl.tar.gz \
 && cd "openssl-${OPENSSL}" \
 && ./config --prefix=/opt/openssl --libdir=lib -Os -static \
      no-shared no-tests no-docs no-engine no-dso no-legacy zlib \
      no-dtls no-sctp no-ssl3 no-ui-console no-afalgeng no-quic \
      no-srp no-psk no-cms no-ct no-ts no-cmp no-http no-rfc3779 no-ec2m \
      no-ocb no-siv no-rc5 no-bf no-cast \
      no-sm2 no-sm3 no-sm4 no-whirlpool no-mdc2 no-rmd160 no-blake2 no-argon2 \
      no-scrypt no-srtp no-gost no-nextprotoneg no-uplink no-deprecated \
      enable-weak-ssl-ciphers \
 && make -j"$(nproc)" build_libs \
 && make -j"$(nproc)" build_programs \
 && make install_dev \
 && strip apps/openssl && cp apps/openssl /opt/openssl/openssl-bin

WORKDIR /src
COPY probe.c .
# The self-test runs in every build, so a broken prober never becomes an image.
RUN gcc -Os -DSELFTEST -I/opt/openssl/include -o selftest probe.c \
      /opt/openssl/lib/libssl.a /opt/openssl/lib/libcrypto.a -lz && ./selftest
RUN gcc -Os -static -fno-asynchronous-unwind-tables -ffunction-sections -fdata-sections \
      -Wl,--gc-sections -I/opt/openssl/include -s -o probe probe.c \
      /opt/openssl/lib/libssl.a /opt/openssl/lib/libcrypto.a -lz \
 && upx --best --lzma -q probe \
 && upx --best --lzma -q /opt/openssl/openssl-bin \
 && mkdir /tmpdir && chmod 1777 /tmpdir

FROM scratch
# The trusted roots the certificate chain is judged against.
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /src/probe /probe
COPY --from=build /opt/openssl/openssl-bin /openssl
COPY --from=build /tmpdir /tmp
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/probe"]
