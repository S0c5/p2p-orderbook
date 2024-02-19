import { OrderBook } from "./orderbook.js";

export class OrderBookRegistry {
  #registry = new Map();

  /**
   * 
   * 
   * @param {String} pair 
   * @returns {OrderBook}
   */
  getOrCreate(pair) {
    if (!this.#registry.has(pair)) {
      this.#registry.set(pair, new OrderBook());
    }
    return this.#registry.get(pair);
  }


  dump() {
    return Array.from(this.#registry.values())
      .map(b => b.dump())
      .reduce((p, n) => p.concat(n), []);
  }

  /**
   * 
   * @param {String} pair 
   */
  remove(pair) {
    this.#registry.delete(pair);
  }
}