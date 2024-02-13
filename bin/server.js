#!/usr/bin/env node

import { OrderLimit, OrderMarket, P2POrderBook } from "../src/index.js";
import prompts from "prompts";
import parserArgs from 'yargs/yargs';

const args = parserArgs(process.argv.slice(2))
    .usage('Usage: $0 [options]')
    .example('$0 -g http://localhost:30001 -i alice -p BTCUSD')
    .alias('g', 'grape')
    .alias('i', 'id')
    .alias('p', 'pair')
    .demandOption(['g', 'i', 'p'])
    .help('h')
    .alias('h', 'help')
    .epilog('OpenSourced 2023')
    .parse();

const server = new P2POrderBook({
  grape_uri: args.grape,
  pub_server_port: Math.ceil(Math.random() * 1000 + 1000),
  id: args.id,
  wait_for_server_timeout: 10000,
});

console.log('==== TRADING TERMINAL =====');
console.log('==== created by s0c5  =====');

console.log('> Connecting to satellital networks... ')
await server.start();
console.log(`> 🛰️ You are online as ${server.is_server ? 'Server' : 'Client'} `)

function printEvents(event) {
  console.log('===== RESULT ====');

  if (event.type === 'Unfilled') {
    console.log('> Market order not collided.')
  }

  if (event.type === 'Placed') {
    console.log(`> Limit ${event.id} order placed`)
  }

  if (event.type === 'Filled') {
    console.log(`> Order ${event.id} Filled.`)

    event.fills.map(x => {
      console.log(`🔥 Collided with ${x.order_2} for ${x.qty} units at $${x.price}`);
    })
  }

  console.log('===== FINISHED ====');
}

server.on('order_executed', ({ events }) => {
  printEvents(events);
})

while(true) {
  const { operation } = await prompts({ 
    name: 'operation',
    type: 'select',
    message: ">",
    choices: ['Limit', 'Market', 'Orderbook', 'Exit']
  });

  switch (operation) {
    case 0: 
      console.log('> Tell me about your operation.')
      const orderLimit = await prompts([
        {
          name: 'side',
          message: 'Side',
          type: 'select',
          choices: ['Ask', 'Bid'],
        },
        { 
          type: 'number',
          name: 'price',
          message: 'Price'
        },
        {
          type: 'number',
          name: 'qty',
          message: 'Qty',
        }
      ]);

      console.log('> Executing operation...');

      server.exec(new OrderLimit({
        ...orderLimit,
        pair: args.pair,
        side: orderLimit.side == 0 ? 'Ask' : 'Bid'
      }));
      
      break;
    case 1: 
      const orderMarket = await prompts([
        {
          name: 'side',
          message: 'Side',
          type: 'select',
          choices: ['Ask', 'Bid'],
        },
        {
          type: 'number',
          name: 'qty',
          message: 'Qty',
        }
      ]);

      server.exec(new OrderMarket({
        ...orderMarket,
        pair: args.pair,
        side: orderMarket.side == 0 ? 'Ask' : 'Bid'
      }));
      break;
    case 2: 

      const state = server.getOrderBook(args.pair);
      console.log("\n\n >Bids =====");
      state.bids.map(([price, qty]) => {
        console.log(`$${price} => ${qty}`);
      });
      console.log("\n\n  >Asks =====");
      state.asks.map(([price, qty]) => {
        console.log(`$${price} => ${qty}`);
      });
      break;
    case 3:
      process.exit(0);
  } 

  
}