/**
 * @packageDocumentation
 *
 * `#tls` under Node: Node's own module (see
 * `imports` in package.json).
 */

export {
  checkServerIdentity,
  connect,
  rootCertificates,
  TLSSocket,
  type ConnectionOptions,
  type DetailedPeerCertificate,
  type PeerCertificate,
} from 'node:tls';
export { default } from 'node:tls';
