import { Readable } from 'stream';
import { EventEmitter } from 'events';
import { HIGH_WATER_MARK, delay, makeTransformer } from './utils.js';
import { OrderBookRegistry } from './registry.js';
import debug from 'debug';
import Link from 'grenache-nodejs-link';
import WS from 'grenache-nodejs-ws';

const log = debug('orderbook-service');
const CHANNEL = 'p2p-orderbook';

export class P2POrderBook extends EventEmitter {
  #link;
  #peer_sub;
  #peer_pub;
  #peer_pub_port = 3000;
  #service_pub;
  #service_sub;

  #wait_for_server_timeout = 20_000;

  #orderBook = new OrderBookRegistry();
  #announce = null;
  is_server = false;
  
  /**
   * 
   * @param {Object} ops 
   * @param {string} ops.grape_uri
   * @param {number} ops.pub_server_port
   * @param {string} ops.id
   * @param {number} ops.wait_for_server_timeout
   */
  constructor(ops) {
    super();

    this.#link  = new Link({
      grape: ops.grape_uri,
    });

    this.#wait_for_server_timeout = ops.wait_for_server_timeout || 20_000;
    this.is_server = ops.is_server;    
    this.#peer_pub_port = ops.pub_server_port || 3001;    
    this.id = ops.id;

    this.orderQueue = new Readable({
      objectMode: true,
      highWaterMark: HIGH_WATER_MARK,
      read() {}
    });

    this.orderQueue
      .pipe(this.createCollider())
      .pipe(this.createAnouncer());

  }

  async start() {
    if (this.#announce) return;
    this.#link.start();
    let foundServer = await this.#connectToServer();

    if (!foundServer) {
      this.is_server = true;
      this.#peer_pub = new WS.PeerPub(this.#link);
      this.#peer_pub.init();
      this.#service_pub = this.#peer_pub.transport('server');
      this.#announce = setInterval(() => {
        if (this.is_server) this.#link.announce(CHANNEL, this.#peer_pub_port, {});
      }, 1000);

      this.#service_pub.listen(this.#peer_pub_port);
      this.#service_pub.socket.on('connection', (ws) => {
        ws.on('message', (message) => {
          this.#onCmd(message);
          this.#service_pub.pub(message);
        });
      });
    }

    return delay(1000);
  }

  async #connectToServer() {
    let tries = this.#wait_for_server_timeout / 1000;
    let dest = false;

    while (tries--) {
      dest = await new Promise((r, e) => {
          this.#link.lookup(CHANNEL, {}, (err, dest) => {
            if(err && err.message == "ERR_GRAPE_LOOKUP_EMPTY") {
              return r(false);
            }
            if (err) {
              return e(err);
            }
            r(dest && dest);
          });
      });
      if (dest) break;
      await delay(1000);
    }
    
    if (!dest) return false;

    this.#peer_sub = new WS.PeerSub(this.#link);
    this.#service_sub = this.#peer_sub.transport(dest);
    this.#service_sub.sub();
    this.#service_sub.on('message', (message) => {
      this.#onCmd.bind(this)(message);
    });

    return true;
  }


  #onCmd(cmdStr) {
    const { cmd, args, from } = JSON.parse(cmdStr);
    if (from === this.id ) return ;
    switch(cmd) {
      case 'ORDER':
        this.exec(args.order)
    }
  }
  
  #sendCmd(cmd, args) {
    const cmdStr = JSON.stringify({ cmd, args, from: this.id });
    if (this.is_server) {
      this.#service_pub.pub(cmdStr);
    } else {
      this.#service_sub.socket.send(cmdStr);
    }
  }

  stop() {
    if (!this.#announce) return;
    clearInterval(this.#announce);
    this.#link.stop();
    this.#service_pub.stop();
  }

  createCollider() {
    return makeTransformer(({ order }, _, next) => {
      const orderBook = this.#orderBook.getOrCreate(order.pair);
      let events = orderBook.exec(order);
      this.emit('order_executed', { events });
      next(null, { order })
    });
  }

  createAnouncer() {
    return makeTransformer(({ order }, _, next) => {
      if(order.status == 'TO_ANNOUNCE') this.#sendCmd('ORDER', { order: {
        ...order,
        status: 'TO_UPDATE'
      }});

      next(null)
    }); 
  }

  getOrderBook(pair) {
    return this.#orderBook.getOrCreate(pair).depth(10_000);
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
    this.orderQueue.push({ order });
  }
}

