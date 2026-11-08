# @mridang/plumbline-docker

An HTTP server that scans a URL with every [plumbline](../hints/README.md) check, with a real Chromium, and answers with the findings as JSON. It lets a project in any language run the checks from its end-to-end tests without a Node toolchain.

The package is private and never published to npm. It is shipped only as the Docker image `mridang/plumbline`, multi-arch (`linux/amd64` and `linux/arm64`) and released in lockstep with the npm packages. The scan itself is the one in [`@mridang/plumbline`](../cli/README.md), so it runs every check, TLS, DNS and mail included.

## Run

```sh
docker run --rm -p 8080:8080 mridang/plumbline
```

| Endpoint       | What                                                                             |
| -------------- | -------------------------------------------------------------------------------- |
| `GET /healthz` | `{ "status": "ok" }`; a readiness probe, handy as a Testcontainers wait strategy |
| `GET /hints`   | The catalogue: every shipped hint with its id, category and groups               |
| `POST /scan`   | Scans `{ "url": "https://example.com/" }` and answers with the report            |
| `POST /run`    | Scans the same body with no browser and streams the checks as JSON lines         |

```sh
curl -s localhost:8080/scan -d '{"url":"https://example.com/"}'
```

```json
{
  "url": "https://example.com/",
  "scannedAt": "2026-10-23T12:00:00.000Z",
  "scannerVersion": "1.2.3",
  "summary": {
    "error": 2,
    "warning": 5,
    "hint": 1,
    "information": 0,
    "total": 8
  },
  "findings": [
    {
      "hintId": "extra/csp",
      "category": "security",
      "groups": ["owasp", "security-headers"],
      "severity": "error",
      "message": "…",
      "resource": "https://example.com/",
      "location": { "line": 12, "column": 3 },
      "codeSnippet": "…",
      "documentation": [{ "link": "https://…", "text": "…" }]
    }
  ]
}
```

Pass `"hints": ["csp", "hsts"]` to run only some hints (bare ids, no `extra/` prefix); every hint runs by default. A body that is not JSON, or a `url` that is not http(s), is answered with `400`; a scan that fails with `500` and the reason in `detail`.

To keep a report, mount a directory and start the image with `OUTPUT_DIR` set (or pass `"out"` in the request body). The scan then also writes `<site>.json` and the HTML report `<site>.html` from [`@mridang/webhint-formatter-plumbline`](../formatter/README.md) there, and the answer says where under `saved`:

```sh
docker run --rm -p 8080:8080 -e OUTPUT_DIR=/reports -v "$PWD/reports:/reports" mridang/plumbline
```

| Variable        | Default             | What                                     |
| --------------- | ------------------- | ---------------------------------------- |
| `PORT`          | `8080`              | The port the server listens on           |
| `HOST`          | `0.0.0.0`           | The address the server binds             |
| `OUTPUT_DIR`    | unset               | Where every scan also writes its reports |
| `CHROMIUM_PATH` | `/usr/bin/chromium` | The browser the scan drives              |

## Streaming scan

`POST /run` is the streaming scan, as the Node command line runs it. It needs no Chromium: the page is fetched with Node, and the TLS, certificate, DNS and mail checks run for real. It answers with `application/x-ndjson`, one JSON object per line:

| Line                                                 | When                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `{"type":"ready","finalUrl","status","hints":[...]}` | The page was fetched; `hints` describes every check that will run |
| `{"type":"done","outcome":{...}}`                    | One check finished: `passed`, `warned`, `failed` or `skipped`     |
| `{"type":"unreachable","detail":"..."}`              | The page could not be fetched, or the address was refused         |
| `{"type":"end"}`                                     | The scan is over; always the last line                            |

The server fetches whatever address it is given, so every fetch and name lookup is kept on the public internet: private, loopback, link-local (the cloud metadata address included) and other reserved addresses are refused on the address actually connected to and on every redirect, and only the default ports and 80, 443, 8080 and 8443 are allowed. The `openssl` programs the TLS checks run are not covered by that guard; run the image where it cannot reach a private network.

```sh
docker buildx bake local    # plumbline:local
docker run --rm -p 8080:8080 plumbline:local
curl -sN localhost:8080/run -d '{"url":"https://example.com/"}'
```

## Build the image

The `Dockerfile` and `docker-bake.hcl` are at the repository root:

```sh
docker buildx bake local    # native arch, loaded into the local daemon as plumbline:local
docker buildx bake          # linux/amd64 and linux/arm64 to dist/plumbline-multi.tar
docker run --rm -p 8080:8080 plumbline:local
```

Releases run `docker buildx bake release`, driven by semantic-release, which pushes the multi-arch image with the version tags.

## Development

Commands run from the repository root through devbox:

```sh
devbox run -- npm run build
devbox run -- npx jest --coverage=false packages/docker
devbox run -- npx eslint packages/docker
devbox run -- node packages/docker/dist/server.js   # the server without Docker, on port 8080
```

## Licence

Apache-2.0
