// The Node module `#tls` stands for (see `imports` in package.json).
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
