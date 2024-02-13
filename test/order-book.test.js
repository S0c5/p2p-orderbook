import { OrderBook } from '../src/core/orderbook.js';
import assert from 'assert';
import { OrderLimit, OrderMarket } from '../src/index.js';

function assertObj(order, match) {
  Object.entries(match).map(([field, value]) => {
    assert(order[field] == value, `Object.${field} not match with ${value}. ${order[field]}`);
  });
}

describe('Simple-orderbook', () => {
  const pair = 'BTCUSD';

  it('I can create a Limit order', () => {
    let book = new OrderBook();
    let eventAsk = book.exec({
      id: 1,
      pair,
      price: 2,
      qty: 1000,
      side: 'Ask',
      type: 'Limit'
    });

    assert(eventAsk.type == 'Placed');
    assert(eventAsk.id == 1);

    let eventBid = book.exec({
      id: 2,
      pair,
      price: 1,
      qty: 1000,
      side: 'Bid',
      type: 'Limit'
    });

    assert(eventBid.type == 'Placed');
    assert(eventBid.id == 2);
  })

  it('If ask price is lower than bid it must collide', () => {
    let book = new OrderBook();

    let eventBid = book.exec({
      id: 1,
      pair: 'USDT',
      price: 10,
      qty: 1000,
      side: 'Bid',
      type: 'Limit'
    });
    assert(eventBid.type == 'Placed', 'wrong event');
    assert(eventBid.id == 1, 'wrong id');


    let eventAsk = book.exec({
      id: 2,
      pair: 'USDT',
      price: 9,
      qty: 1000,
      side: 'Ask',
      type: 'Limit'
    });

    assert(eventAsk.type = 'Filled', 'wrong event')

    const [ fill ] = eventAsk.fills;

    assert(fill.order_2 == 1);
    assert(fill.order_1 == 2);
    assert(fill.qty = 1000);
    assert(fill.price = 9);
    assert(fill.taker_side = 'Ask');
  });

  it('If a limit bid price is higher than ask it must collide', () => {
    let book = new OrderBook();

    let eventAsk = book.exec({
      id: 2,
      pair,
      price: 10,
      qty: 1000,
      side: 'Ask',
      type: 'Limit'
    });

    assert(eventAsk.type == 'Placed', 'wrong event');
    assert(eventAsk.id == 2, 'wrong id');

    let eventBid = book.exec({
      id: 1,
      pair: 'USDT',
      price: 11,
      qty: 1000,
      side: 'Bid',
      type: 'Limit'
    });

    assert(eventBid.type = 'Filled', 'wrong event')
    const [ fill ] = eventBid.fills;

    assert(fill.order_2 == 2);
    assert(fill.order_1 == 1);
    assert(fill.qty = 1000);
    assert(fill.price = 10);
    assert(fill.taker_side = 'Bid');
  });

  it("I can send a Market ask order and if its not any order it must return unfilled", () => {
    let book = new OrderBook();

    let eventAsk = book.exec({
      id: 4,
      pair,
      qty: 1000,
      side: 'Ask',
      type: 'Market'
    });

    assert(eventAsk.type == 'Unfilled');
    assert(eventAsk.id == 4);
  });

  it('If there is a ask limit order and I execute a bid Market order it must collide', () => {
    let book = new OrderBook();

    let eventAsk = book.exec(new OrderLimit({
      id: 1,
      pair,
      qty: 1_000,
      price: 10,
      side: 'Ask',
      type: 'Limit'
    }));

    assert(eventAsk.type == 'Placed');
    assert(eventAsk.id == 1);

    let eventMarketBid = book.exec(new OrderMarket({
      id: 4,
      pair,
      qty: 2_000,
      side: 'Bid',
      type: 'Market'
    }));

    const [ fill ] = eventMarketBid.fills;

    assert(eventMarketBid.type == 'PartialFilled');
    assert(fill.order_1 == 4);
    assert(fill.order_2 == 1);
    assert(fill.price == 10);
    assert(fill.qty == 1_000);
    assert(fill.total_fill == true);
  });

  it('If there is a ask limit order and I execute a bid Market with a higher qty order it must collide and a second market order must be unfilled', () => {
    let book = new OrderBook();

    let eventAsk = book.exec(new OrderLimit({
      id: 1,
      pair,
      qty: 1_000,
      price: 10,
      side: 'Ask',
      type: 'Limit'
    }));

    assert(eventAsk.type == 'Placed');
    assert(eventAsk.id == 1);

    let eventMarketBid = book.exec(new OrderMarket({
      id: 4,
      pair,
      qty: 2_000,
      side: 'Bid',
      type: 'Market'
    }));

    const [ fill ] = eventMarketBid.fills;

    assert(eventMarketBid.type == 'PartialFilled');
    assert(fill.order_1 == 4);
    assert(fill.order_2 == 1);
    assert(fill.price == 10);
    assert(fill.qty == 1_000);
    assert(fill.total_fill == true);

    let eventMarketBidTwo = book.exec(new OrderMarket({
      id: 5,
      pair,
      qty: 2_000,
      side: 'Bid',
      type: 'Market'
    }));


    assert(eventMarketBidTwo.type == 'Unfilled');
    assert(eventMarketBidTwo.id == 5);
  });

  it('With multiple limit ask orders, Market order must collide to full fill all of them', () => {
    const book = new OrderBook();
    const orders = [[1, 100, 10], [2, 100, 20], [3, 100, 30]];

    orders.map(([id, qty, price]) => {
      book.exec(new OrderLimit({
        id,
        pair,
        qty,
        price,
        side: 'Ask',
        type: 'Limit'
      }));  
    });


    let eventMarketBid = book.exec(new OrderMarket({
      id: 4,
      pair,
      qty: 300,
      side: 'Bid',
      type: 'Market'
    }));


    orders.map(([id, qty, price], index) => {
      assertObj(eventMarketBid.fills[index], {
        price: price,
        order_2: id,
        qty: qty,
      })
    })


    const eventMarketBidUnfilled = book.exec(new OrderMarket({
      id: 4,
      pair,
      qty: 300,
      side: 'Bid',
      type: 'Market'
    }));

    assert(eventMarketBidUnfilled.type == 'Unfilled');
  });
});