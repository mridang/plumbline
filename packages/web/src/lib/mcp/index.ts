/**
 * @packageDocumentation
 *
 * Public surface of the lib/mcp package.
 */
export type { JsonType, JsonSchema } from './json-schema';
export {
  NOT_BLANK,
  CHECKED_KEYWORDS,
  ANNOTATION_KEYWORDS,
  isJsonObject,
  PROBLEMS_SHOWN,
  validateJson,
  unsupportedKeywords,
} from './json-schema';
export type {
  ReplyId,
  ProtocolMessage,
  ProtocolRefusal,
  RefusalSpec,
  ParsedMessage,
} from './protocol';
export {
  MODERN_VERSION,
  LEGACY_VERSIONS,
  SUPPORTED_VERSIONS,
  ERROR_PARSE,
  ERROR_INVALID_REQUEST,
  ERROR_METHOD_NOT_FOUND,
  ERROR_INVALID_PARAMS,
  ERROR_INTERNAL,
  ERROR_HEADER_MISMATCH,
  ERROR_UNSUPPORTED_VERSION,
  negotiateLegacyVersion,
  isPlainObject,
  replyIdOf,
  RpcError,
  isNotification,
  declaredVersion,
  isModernRequest,
  errorBody,
  protocolRefusal,
  withoutId,
  parseMessage,
  headerVersion,
  checkBatch,
  checkRequestHeaders,
  decodeHeaderValue,
  parseAllowedOrigins,
  isAllowedOrigin,
} from './protocol';
export type {
  JsonRpcMessage,
  JsonRpcErrorBody,
  JsonRpcResponse,
  CacheHint,
  McpMethod,
  McpServerOptions,
} from './server';
export { McpServer } from './server';
export {
  stringArg,
  stringListArg,
  numberArg,
  limitArg,
  offsetArg,
  canonicalArguments,
  textArg,
} from './tool-args';
export {
  UnknownToolError,
  InvalidToolArgumentsError,
  BackendFailureError,
} from './tool-errors';
