import pino from 'pino';
import pinoPretty from 'pino-pretty';

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

// In dev, use pino-pretty as a transform stream to avoid thread-stream workers
const prettyStream = isProd
  ? undefined
  : pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: true,
    });

export const logger = pino({ level }, prettyStream as pino.DestinationStream | undefined);
