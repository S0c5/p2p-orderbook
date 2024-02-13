import { Transform } from 'stream';
import debug from 'debug';

const log = debug('Orderbook');
export const HIGH_WATER_MARK = 10_000;

/**
 * @typedef {import('./models').OrderLimit} OrderLimit
 * @typedef {import('./models').OrderMarket} OrderMarket
 * 
 * OrderChunk
 * 
 * @typedef {Object} OrderChunk
 * @property {OrderLimit|OrderMarket} order
 * @property {Object} event
 */

class OrderError extends Error {
  code = null;
  constructor(code, error) {
    super();
    ([this.code, this.error] = [code, error]);
  }
}

export class CustomTransform extends Transform {
  constructor(
    transform
  ) {
    super({
      objectMode: true,
      highWaterMark: HIGH_WATER_MARK,
      transform: async (chunk, encode, cb) => {
        if (chunk.error) return cb(null, chunk);

        try {
          await transform.bind(this)(chunk, encode, (err, after) => {
            log(`Transform.cb() => Next ${'='.repeat(50)}\n`, { before: chunk, after, err }, '='.repeat(50));
            cb(err, after);
          });
        } catch (err) {
          log(`Transform.cb() => Error ${'='.repeat(50)}`, { err }, '='.repeat(50));
          console.error('ERRROR_AT_TRANSFORMER', err);
          cb(null, { error: new OrderError(chunk.order, err), ...chunk });
        }
      }
    });
  }
}
/**
 * Callback for transformer chunks
 *
 * @callback ChunkTransformer
 * @param {OrderChunk} chunk
 * @param {OrderChunk} encode
 * @param {Function} cb
 */


/**
 * 
 * @param {ChunkTransformer} fn 
 * @returns {CustomTransform}
 */
export function makeTransformer(fn) {
  return new CustomTransform(fn);
}


export const delay = (x) => new Promise(r => setTimeout(r, x)) ;