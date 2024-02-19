import assert from 'assert';
import { generateRandomId } from './utils.js';

export class OrderBase {
  status = 'TO_ANNOUNCE';
  id;
  pair;
  side;
  qty;

  constructor(data = {}) {
    Object.assign(this, data);
    this.id = +(data.id || generateRandomId());
    assert(this.id, 'define an id');
    assert(this.pair, 'define a pair');
    assert(this.qty > 0, 'qty should be greater than 0');
    assert(['Bid', 'Ask'].includes(this.side), 'side should be or Bid | Ask');
  }
}

export class OrderLimit extends OrderBase {
  
  
  /**
   * 
   * @param {OrderLimit} data 
   */
  constructor(data) {
    super(data)
    this.type = 'Limit';
    /**
     * @type {number}
     */
    this.price = data.price;
    /**
     * @type {number}
     */
    this.qty = data.qty;
    /**
     * @type {"Ask" | "Bid"}
     */
    this.side = data.side;
    this.remain_qty = this.qty;
    assert(this.type == 'Limit', 'limit order must have limit type');
    assert(this.remain_qty >= 0, 'remaining_qty must be greater than 0');
    assert(this.price > 0, 'price should be defined');
  }
}

export class OrderMarket extends OrderBase {
  type  = 'Market';
  remain_qty  = 0;

  /**
   * 
   * @param {OrderMarket} data 
   */
  constructor(data) {
    super(data)

    this.remain_qty = this.qty;
    assert(this.qty > 0, 'Market orders nust have a qty > 0');
    assert(this.type == 'Market', 'limit order must have limit type');
  }
}