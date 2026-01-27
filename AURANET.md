# AURANET v1
## 1. Introduction
AURANET is a decentralized, gossip-based mesh protocol designed for high-latency, offline-first environments. It utilizes a Dual-Layer Ledger and Proof-of-Work (PoW) to facilitate secure messaging without centralized servers or stable internet access.

## 2. Entities

### User
User is a person, that holds its X25519 keypair. Using this keypair, he can send direct messages to another users.

X25519 public key is address at the same time

### Channel
Channel is a broadcast entity, that can only send broadcast messages. Channel also has its own Ed25519 keypair. 

Channel owns by some person or maybe more. Everyone, who has private key can send broadcast messages. 

Ed25519 public key is address at the same time

### Message
Message is a main entity in AURANET. Every message stores in Ledger. Every message has unique SHA256 hash, so modified message in-the-middle will be ANOTHER message, so BLACKHOLE attacks is not possible.

Every message has PoW that sender calculated. The difficulty of PoW defines TTL and available Ledger levels

Every message has TTL and assigned Ledger.

### Broadcast Message
Broadcast message is a message, that sent by some channel.

Broadcast messages are public and non encrypted by protocol. Everyone can read broadcast messages

### Direct Messages
Direct message is a message, that sent by some User to another User.

Direct message is fully encrypted, anonymous and end-to-end.

### Node
Node is an abstract Ledger holder. Node can connect to another nodes, sync their Ledgers and send Messages. 

It can be anything, but we suppose only 2 types:
* Local Node
* Global Node

### Local Node
As name suppose, Local Nodes are local. That means, that they cannot connect to another Local Nodes by internet, only local protocols allowed (like BLE, Wi-Fi, etc.)

But still, Local Nodes can connect to another Local Nodes to sync their Ledgers and send Messages.

Local Nodes must store both Local Ledger and Global Ledger

Local Nodes also can connect to Global Nodes via internet to sync their Global Ledger and send Messages.
Only Global Ledger is allowed.

### Global Node
Global Nodes is some remote servers or teapots, that has static IP addresses. They are stores only Global Ledger. They sync Ledger with both Local and another Global Nodes.

### Ledger
Ledger stores messages in structure, combined from Merkle-Tree and Hash-Set:

Every message appends to its corresponding bucket (1 of 1024). Bucket index defined by this: `bucket = message.hash[first 8 bytes as long] % 1024`

Every bucket has hash, calculated from concatenation of every entry, sorted by hash ASC.

1024 buckets forms static Merkle-Tree for easy sync. It doesn't require full tree rebuild after append, only one branch. 

## 3. Structures
> Every binary structure or packet is in **Big-Endian**

### Message
Message is main structure in AURANET.

Every message has its own hash, that calculated just by hashing (SHA256) whole message (from start to end).
Also, the same way PoW is calculated using Argon2 (Later)

Every message has common structure:
```
[flags(1)] [time(5)] <body> [nonce(4)]
```

`flags` is one byte for short, but useful information:
```
0-1(2) bits - message_type
2(1) bit - private broadcast (reserved)
3(1) bit - global
4-7 bits - reserved
```

`time` is UTC UNIX time (ms) of when message was sent, packed in 5 bytes:
First 4 bytes contains seconds and the last one contains milliseconds.
For example:
```
2025-12-22T12:31:43.604Z is a 1766406703604 ms since Unix Epoch

1766406703604 ms / 1000 = 1766406703 sec
1766406703 will be value of first 4 bytes: 0x69493A2F

1766406703604 ms % 1000 = 604 ms
Since we can't represent every ms using 256(2^8) values, precision will be 4 ms per value, so:
604 ms / 4 = 151 = 0x97
Last byte will be 0x97

So our time will be 0x69493A2F97
```

`none` is 4 random bytes, calculated to pass PoW (Proof-Of-Work)

PoW is a way to ease network and prevent massive spam.

PoW utilizes Argon2 to prevent ASIC and mining. It's hashing whole message, including nonce.

The amount of leading zero bits in hash is work strength or later `pow`

`pow` is really important metric, that defines message TTL (time-to-live) and Ledger layer 

Then, `body` based on `message_type`. Described below.

### `0x00`: **DIRECT** message
```
[senderpub(32)] [filter(1)] <content> [integrity(4)]
```

`senderpub` is 32 bytes of sender's X25519 public key, xored by receiver's X25519 public key.
By xoring, we can ensure, that unless we know receiver, no one can extract sender's public key.
Used later in X25519 `shared_secret` extraction.

`filter` is first byte of receiver's public key hash (SHA256). Made just for ease network by fewer attempts to decode message (x256)

`shared_secret` is secret, that extracted using X25519.
`secret_key` is per-message ephemeral 32-bytes key derived from `shared_secret` using HKDF (alg = SHA256, salt = null, info = "AURA" in UTF-8 + `time` in 5 bytes)

`content` is main body of message. Contains any data. Encrypted using ChaCha20 (IV = [12], key = `secret_key`)

`integrity` is first 4 bytes of SHA256 HMAC, calculated from whole message, except `nonce` and `integrity` itself (from `flags` to `content`). Uses `secret_key`

### `0x01`: **BROADCAST** message
```
[senderpub(32)] <content> [sign(64)]
```

`senderpub` is 32 bytes of broadcast channel's Ed25519 public key, not encrypted or xored.

`content` is main body of message. Contains any data. Also, not encrypted

`sign` is 64 bytes Ed25519 sign of message (preceding bytes: from `flags` to `content` included).


## 4. Sync
> WIP