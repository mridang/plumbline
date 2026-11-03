# TLS test fixtures

Throwaway certificates and keys for the TLS hint tests. They were generated once with the `openssl`
command line tool (OpenSSL 3.0) and are committed so the tests are deterministic and offline. They
protect nothing: never use them anywhere else.

- `ca.pem` / `ca.key`: self-signed EC P-256 test CA (`CN=Webhint Test CA`), valid for 100 years.
  `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout ca.key -out ca.pem -days 36500 -subj "/CN=Webhint Test CA" -sha256 -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"`
- Leaf certificates (`CN=localhost`) signed by that CA, each created with
  `openssl req -new -newkey <keyspec> -nodes -keyout X.key -out X.csr -subj "/CN=localhost"` followed by
  `openssl x509 -req -in X.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out X.pem -days 36500 -extfile <ext> -<digest>`:
  - `rsa3072`, `rsa2048`, `rsa1024`: RSA keys of that size, SHA-256, `san-ok.cnf` (SAN `localhost`, `127.0.0.1`, OCSP pointer).
  - `rsa3072-sha1`, `rsa3072-sha224`: RSA 3072 signed with SHA-1 and SHA-224 (`-sha1`, `-sha224`).
  - `ec256`, `ec-secp224`, `ec-secp256k1`: EC keys (`-newkey ec -pkeyopt ec_paramgen_curve:<curve>`).
  - `ed25519`: Ed25519 key (`-newkey ed25519`).
  - `rsa3072-noocsp`: RSA 3072 with `san-ok-noocsp.cnf` (no OCSP pointer).
  - `rsa3072-othername`: RSA 3072 with `san-other.cnf` (SAN `other.example.test` only, so the host name does not match).
- `dh2048.pem`: `openssl genpkey -genparam -algorithm DH -pkeyopt group:ffdhe2048 -out dh2048.pem`, used to make a test server offer DHE.
- `ca-rsa.pem` / `ca-rsa.key`: self-signed RSA 2048 test CA (`CN=Webhint Test RSA CA`), made like `ca.pem` with `-newkey rsa:2048`.
- `rsa-signed.pem` / `rsa-signed.key`: an EC P-256 leaf signed by `ca-rsa.pem` with SHA-256, so its signature algorithm is `sha256WithRSAEncryption`.
