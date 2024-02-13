# P2P Orderbook

## Overview
This project is a peer-to-peer (p2p) orderbook implemented in js. The orderbook facilitates decentralized trading by allowing users to submit buy and sell orders directly to each other without the need for a centralized exchange.

## Features
- **Decentralized Trading**: Users can submit buy and sell orders directly to each other.
- **Order Matching**: The orderbook matches buy and sell orders based on price and quantity.
- **Peer-to-Peer Communication**: Uses a p2p network for order broadcasting and order matching.


## How it works

The order-book state is shared among the p2p peers. to avoid to create multiple connection between peers there is a central websockets server that broadcast messages to all peers in order to update the orderbook, if a peer doesn't found a orderbook server it becomes the server. Later peers who wants to trade discover the "Current" server using grenache-nodejs-link (the powerfull DHT).



## Run 

1. Install grape
```
  npm i -g grenache-grape
```

2. Start grape

```
  grape --dp 20001 --aph 30001 --bn '127.0.0.1:20002'
  grape --dp 20002 --aph 40001 --bn '127.0.0.1:20001'
```

3. Install dependencies
```
$ npm install 
```

4. Enjoy the P2P trading 🚀

```
  node /bin/server.js -g http://localhost:30001 -i Alice --p BTCUSD
```

## Test

```bash
$  npm test

```

# To Do

[ ] If a server dies, a client can become a new server and announce this change to other clients.
[ ] when client connects it must sync state with server.


# Limitations

1. The state could not be warranted :(.

