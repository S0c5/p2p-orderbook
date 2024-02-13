import assert from 'assert';

export class OrderBook {
  constructor() {
    this.orders = new Map();
    this.bids = new Map();
    this.asks = new Map();
  }

  /**
   * @typedef {import('./models.js').OrderLimit} OrderLimit
   *   
   * @description Execute an order in the orderbook
   * 
   * @param {OrderLimit} order 
   */
  #matchAsk(id, qty, limit_price = null) {
    let remain_qty = qty;
    let fills = [];

    for (const [_price, orders] of Object.entries(this.asks)) {
      let ask_price = +_price;

      if (orders.length == 0) {
        continue;
      }
      
      if (limit_price && limit_price < ask_price) {
        break;
      }

      if (remain_qty == 0) break;

      let { filled_qty, fill } = this.processQueue(orders, remain_qty, id, 'Bid');
      remain_qty -= filled_qty;
      fills = fills.concat(fill);
    }

    return {
      remain_qty,
      fills,
    };
  }

  /**
   * 
   * @param {*} ordersId 
   * @param {*} remain_qty 
   * @param {*} id 
   * @param {*} side 
   */
  processQueue(ordersId, remain_qty, id, taker_side) {
    const fill = [];
    let filled_qty = 0;
    let filled_ids = [];

    for (const [index, orderId] of Object.entries(ordersId)) {
      const order = this.orders[orderId];
      if (remain_qty == 0) break;

      if (remain_qty >= order.remain_qty) {
        fill.push({
          order_1: id,
          order_2: order.id,
          qty: order.remain_qty,
          price: order.price,
          taker_side,
          total_fill: true,
        })

        filled_qty += order.remain_qty;
        remain_qty -= order.remain_qty;

        order.remain_qty = 0;
      } else { 
        fill.push({
          order_1: id,
          order_2: order.id,
          qty: remain_qty,
          price: order.price,
          taker_side,
          total_fill: false,
        });
        order.remain_qty -= remain_qty;
        filled_qty += remain_qty;
        remain_qty = 0;
      }
      filled_ids.push(index);
    }

    filled_ids.map(index => ordersId.splice(index, 1));

    return {
      fill,
      filled_qty
    };
  }

  /**
   * @typedef {import('./models.js').OrderLimit} OrderLimit
   *   
   * @description Execute an order in the orderbook
   * 
   * @param {OrderLimit} order 
   */
  #matchBid(id, qty, limit_price = null){
    let remain_qty = qty;
    let fills = [];

    for (const [_price, orders] of Array.from(Object.entries(this.bids)).reverse()) {
      let bid_price = +_price;
      if (orders.length == 0) {
        continue;
      }
      
      if (limit_price && limit_price > bid_price) {
        break;
      }
      if (remain_qty == 0) break;
      let { filled_qty, fill } = this.processQueue(orders, remain_qty, id, 'Ask');
      remain_qty -= filled_qty;
      fills = fills.concat(fill);
    }

    return {
      remain_qty,
      fills,
    };
  }
  
  /**
   * @typedef {import('./models.js').OrderLimit} OrderLimit
   *   
   * @description Execute an order in the orderbook
   * 
   * @param {OrderLimit} order 
   */
  limit(order) {
    this.orders[order.id] = order;
    let fills, remain_qty;

    if (order.side == 'Ask') {
      ({ fills, remain_qty } = this.#matchBid(order.id, order.qty, order.price));

      assert(remain_qty >= 0, 'wrong remaining qty');

      if (remain_qty > 0) {
        if (!this.asks[order.price]) this.asks[order.price] =[];
        this.asks[order.price].push(order.id);
      }

      if (fills.length == 0) return {
        type: 'Placed',
        id: order.id,
      }

      if (fills.length > 0) return {
        type: remain_qty == 0 ? 'Filled' : 'PartialFilled',
        fills,
      }

    } else if (order.side == 'Bid') {
      ({ fills, remain_qty } = this.#matchAsk(order.id, order.qty, order.price));

      assert(remain_qty >= 0, 'wrong remaining qty');

      if (remain_qty > 0) {
        if (!this.bids[order.price]) this.bids[order.price] =[];
        this.bids[order.price].push(order.id);
      }
    }

    if (fills.length == 0) return {
      type: 'Placed',
      id: order.id,
    }

    if (fills.length > 0) return {
      type: remain_qty == 0 ? 'Filled' : 'PartialFilled',
      fills,
    }
  }


  /**
   * @typedef {import('./models.js').OrderLimit} OrderLimit
   *   
   * @description Execute an order in the orderbook
   * 
   * @param {OrderMarket} order 
   */
  market(order) {
    let fills, remain_qty;

    if (order.side == 'Ask') {
      ({ fills, remain_qty } = this.#matchBid(order.id, order.qty));

    } else if (order.side == 'Bid') {
      ({ fills, remain_qty } = this.#matchAsk(order.id, order.qty));
    }

    if (fills.length == 0) return {
      type: 'Unfilled',
      id: order.id,
    }

    if (fills.length > 0) return {
      type: remain_qty == 0 ? 'Filled' : 'PartialFilled',
      fills,
    }
  }

  /**
   * @typedef {import('./models.js').OrderMarket} OrderMarket
   * @typedef {import('./models.js').OrderLimit} OrderLimit
   *   
   * @description Execute an order in the orderbook
   * 
   * @param {OrderLimit | OrderMarket} order 
   */
  exec(order) {
    if (order.type == 'Limit') {
      return this.limit(order);
    } else if (order.type == 'Market'){
      return this.market(order);
    }
  }

  depth(max_10) { 
    return {
      asks: Object.entries(this.asks).map(([price, orders]) => [+price, orders.reduce((p, id) => p + this.orders[id].remain_qty, 0)]),
      bids: Object.entries(this.bids).map(([price, orders]) => [+price, orders.reduce((p, id) => p + this.orders[id].remain_qty, 0)])
    }
  }
}