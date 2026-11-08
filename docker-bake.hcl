// Docker Bake configuration for the plumbline scan server image.
//
// Usage:
//   docker buildx bake               # builds both linux/amd64 + linux/arm64 to an OCI tarball
//   docker buildx bake local         # builds native arch only, loads into the local docker daemon
//   docker buildx bake amd64         # builds linux/amd64 only, loads
//   docker buildx bake arm64         # builds linux/arm64 only, loads (uses QEMU on non-arm64 hosts)
//   docker buildx bake push          # builds both arches, pushes the manifest to REGISTRY
//   docker buildx bake release       # CI: push the multi-arch image. Driven by
//                                    # @mridang/semantic-release-oci in bake mode, which injects
//                                    # the resolved version tags via `--set "image.tags=..."`.

variable "REGISTRY" {
  default = ""
}

variable "TAG" {
  default = "latest"
}

variable "IMAGE_NAME" {
  default = "plumbline"
}

function "image" {
  params = [tag]
  result = REGISTRY == "" ? "${IMAGE_NAME}:${tag}" : "${REGISTRY}/${IMAGE_NAME}:${tag}"
}

group "default" {
  targets = ["multi"]
}

target "_common" {
  context    = "."
  dockerfile = "Dockerfile"
  # Stamp the image with the version being built so the report's
  # `scannerVersion` matches the published tag.
  args = {
    SCANNER_VERSION = TAG
  }
}

# --- Release group ----------------------------------------------------------
# Unlike the sibling Rust images there are no per-arch binaries to export, so
# the release group has one target. semantic-release-oci runs
# `docker buildx bake release` and injects the version tags into `image`.

group "release" {
  targets = ["image"]
}

target "image" {
  inherits  = ["_common"]
  target    = "runtime"
  platforms = ["linux/amd64", "linux/arm64"]
  tags      = [image(TAG)]
  output    = ["type=registry"]
}

target "multi" {
  inherits  = ["_common"]
  target    = "runtime"
  platforms = ["linux/amd64", "linux/arm64"]
  tags      = [image(TAG)]
  output    = ["type=oci,dest=./dist/plumbline-multi.tar"]
}

target "push" {
  inherits  = ["_common"]
  target    = "runtime"
  platforms = ["linux/amd64", "linux/arm64"]
  tags      = [image(TAG)]
  output    = ["type=registry"]
}

target "local" {
  inherits = ["_common"]
  target   = "runtime"
  tags     = [image("local")]
  output   = ["type=docker"]
}

target "amd64" {
  inherits  = ["_common"]
  target    = "runtime"
  platforms = ["linux/amd64"]
  tags      = [image("amd64")]
  output    = ["type=docker"]
}

target "arm64" {
  inherits  = ["_common"]
  target    = "runtime"
  platforms = ["linux/arm64"]
  tags      = [image("arm64")]
  output    = ["type=docker"]
}
