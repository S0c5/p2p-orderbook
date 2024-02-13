import { delay } from '../src/core/utils.js';
import { OrderLimit, P2POrderBook } from '../src/index.js';
import { createGrapes} from './fixtures/grapes.js';
import assert from 'assert';

describe('P2P service', () => {
  const pair = 'BTCUSD';
  const grapes = createGrapes();
  // if not servers found in 2000 it becomse the server
  const serviceA = new P2POrderBook({
    grape_uri: 'http://127.0.0.1:30001',
    id: 'A',
    pub_server_port: 4002,
    wait_for_server_timeout: 2000,
  })

  const serviceB = new P2POrderBook({
    grape_uri: 'http://127.0.0.1:30001',
    id: 'B',
    pub_server_port: 4003,
    // wait_for_server_timeout: 2000,
  })

  const serviceC = new P2POrderBook({
    grape_uri: 'http://127.0.0.1:30001',
    id: 'C',
    pub_server_port: 4004,
  })

  const serviceD = new P2POrderBook({
    grape_uri: 'http://127.0.0.1:30001',
    id: 'D',
    pub_server_port: 4005,
  });

  before(async () => {

    await new Promise(r => grapes.start(() => r()));

    await Promise.all([
      serviceA.start(),
      serviceB.start(),
      serviceC.start(),
      serviceD.start(),
    ]);
  });

  it('I can publish a limit order and it is distributed among all the instances', async () => {
    


    []
    serviceA.exec(new OrderLimit({
      price: 5,
      id: 10,
      qty: 10,
      pair,
      side: 'Ask'
    }));


    serviceA.exec(new OrderLimit({
      price: 5,
      id: 10,
      qty: 10,
      pair,
      side: 'Ask'
    }));
  
    await delay(1000);
    [serviceA, serviceB, serviceC, serviceD].map(service => {
      assert(service.getOrderBook(pair).asks[0][0] == 5);
      assert(service.getOrderBook(pair).asks[0][1] == 20);
    });
  });
});