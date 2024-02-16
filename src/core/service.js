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

  #lookup_timeout_s = 20_000;

  #orderBook = new OrderBookRegistry();
  #announce_interval = null;
  is_server = false;
  
  /**
   * 
   * @param {Object} ops 
   * @param {string} ops.grape_uri
   * @param {number} ops.pub_server_port
   * @param {string} ops.id
   * @param {number} ops.lookup_timeout_s
   */
  constructor(ops) {
    super();

    this.#link  = new Link({
      grape: ops.grape_uri,
    });

    this.#lookup_timeout_s = ops.lookup_timeout_s || 30;
    this.is_server = ops.is_server;    
    this.#peer_pub_port = ops.pub_server_port || 3001;    
    this.id = ops.id;

    this.order_queue = new Readable({
      objectMode: true,
      highWaterMark: HIGH_WATER_MARK,
      read() {}
    });

    this.order_queue
      .pipe(this.#createCollider())
      .pipe(this.#createAnouncer());

  }

  async start() {
    if (this.#announce_interval) return;
    this.#link.start();
    
    return Promise.all([
      this.#startServer(),
      this.#connectToServer(),
    ])
  }


  async #announcer() {
    this.#link.announce(CHANNEL, this.#peer_pub_port)
  }

  async #startServer() {
    this.#peer_pub = new WS.PeerPub(this.#link);
    this.#peer_pub.init();
    this.#service_pub = this.#peer_pub.transport('server');
    this.#announce_interval = setInterval(() => this.#announcer(), 5_000);
    this.#service_pub.listen(this.#peer_pub_port);
    this.#announcer();
    this.#service_pub.socket.on('connection', (ws) => {
      //broadcast to all clients
      ws.on('message', (message) => {
        this.#onCmd(message);
        this.#service_pub.pub(message);
      });
    });
  }

  async #connectToServer(died_servers = []) {
    let tries = this.#lookup_timeout_s;
    let dest = null;

    while (tries--) {
      dest = await new Promise((r, e) => {
          this.#link.lookup(CHANNEL, {}, (err, dest) => {
            if (err && err.message == "ERR_GRAPE_LOOKUP_EMPTY") return r(null);
            if (err) return e(err);
            r(dest);
          });
      });
      if (dest) break;
      await delay(1_000);
    }

    if (!dest) return false;
    const [ dest_host ] = dest.filter(x => !died_servers.includes(x));
    if (dest_host.split(':')[1] == this.#peer_pub_port) return false;
    if (!dest_host) {
      // if not available servers retry
      setTimeout(() => this.#connectToServer(), this.#lookup_timeout_s * 1000);
      return false;
    }

    this.#peer_sub = new WS.PeerSub(this.#link, {});
    this.#service_sub = this.#peer_sub.transport(dest_host);
    this.#service_sub.sub();
    this.#service_sub.on('message', m => {
      this.#onCmd(m);
      this.#service_pub.pub(m);
    });

    this.#service_sub.socket.on('close', () => {
      console.log('closed at', this.id, 'looking for other serveer');
      this.#connectToServer(died_servers.concat(dest_host));
    });

    return new Promise(r => this.#service_sub.socket.on('open', _ => r(true)));
  }


  #onCmd(cmdStr) {
    const { cmd, args, from } = JSON.parse(cmdStr);
    if (from === this.id) return;
    switch(cmd) {
      case 'ORDER':
        this.exec(args.order)
    }
  }
  
  #sendCmd(cmd, args) {
    const cmdStr = JSON.stringify({ cmd, args, from: this.id });
    this.#service_pub.pub(cmdStr);
    if (this.#service_sub?.isActive()) this.#service_sub.socket.send(cmdStr);
  }

  async stop() {
    if (!this.#announce_interval) return;
    clearInterval(this.#announce_interval);
    this.#link.stop();
    await new Promise(r => this.#service_pub.socket.close(r));
    this.#service_sub?.isActive() && this.#service_sub?._stop();
  }

  getPeersConnected() {
    return this.#service_pub?.socket.clients.size;
  }

  #createCollider() {
    return makeTransformer(({ order }, _, next) => {
      const orderBook = this.#orderBook.getOrCreate(order.pair);
      let events = orderBook.exec(order);
      this.emit('order_executed', { events });
      next(null, { order })
    });
  }

  #createAnouncer() {
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
    this.order_queue.push({ order });
  }
}

