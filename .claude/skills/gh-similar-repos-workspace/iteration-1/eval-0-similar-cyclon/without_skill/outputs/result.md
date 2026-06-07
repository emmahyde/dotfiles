# Repos Similar to nicktindall/cyclon

## Context

`nicktindall/cyclon` refers to the `nicktindall/cyclon.p2p` repository — a JavaScript implementation of the **Cyclon peer sampling protocol**, a gossip-based algorithm for random overlay network membership management in P2P systems. The protocol shuffles partial views of the network between peers to maintain a randomized, low-diameter topology. The repo uses WebRTC as its transport layer.

Core traits to match:
- Peer sampling / gossip-based membership management
- Unstructured P2P overlay networks
- JavaScript/TypeScript implementation (preferred, but not required)
- WebRTC or browser-based transport (bonus)

---

## Closest Matches

### 1. `nicola/js-gossip-cyclon` ★46
**URL:** https://github.com/nicola/js-gossip-cyclon
**Language:** JavaScript
**Why similar:** Direct Cyclon gossip implementation in JavaScript. P2P membership management using the same Cyclon protocol. Closest sibling — same algorithm, independent implementation.

### 2. `RAN3D/spray-wrtc` ★39
**URL:** https://github.com/RAN3D/spray-wrtc
**Language:** JavaScript
**Why similar:** Adaptive random peer sampling protocol running on top of WebRTC — same transport layer, same domain (browser-based P2P overlay), different algorithm (Spray instead of Cyclon). Same problem space, same ecosystem.

### 3. `RAN3D/tman-wrtc` ★3
**URL:** https://github.com/RAN3D/tman-wrtc
**Language:** JavaScript
**Why similar:** Peer-sampling protocol over WebRTC building network topologies using ranking functions. Same transport, same domain, from same research group as spray-wrtc.

### 4. `bpot/node-gossip` ★154
**URL:** https://github.com/bpot/node-gossip
**Language:** JavaScript
**Why similar:** Gossip protocol in Node.js with failure detection. Broader scope (cluster membership + failure detection), but same core pattern — decentralized gossip to maintain membership state.

### 5. `ChainSafe/js-libp2p-gossipsub` ★165
**URL:** https://github.com/ChainSafe/js-libp2p-gossipsub
**Language:** TypeScript
**Why similar:** TypeScript gossip protocol (GossipSub) layered on libp2p. Same domain of P2P gossip-based overlay networking in JS/TS, but oriented toward pub/sub message dissemination over membership.

### 6. `libp2p/js-libp2p` ★2548
**URL:** https://github.com/libp2p/js-libp2p
**Language:** TypeScript
**Why similar:** The canonical JavaScript P2P networking stack — includes peer discovery, routing, and transport abstraction. Much larger scope, but the go-to reference for anyone building browser P2P systems.

### 7. `jutanke/cyclon_webrtc` ★0
**URL:** https://github.com/jutanke/cyclon_webrtc
**Language:** JavaScript
**Why similar:** Another Cyclon + WebRTC implementation, directly matching the nicktindall project in both algorithm and transport. Small/experimental.

### 8. `WillKirkmanM/hyparview` ★1
**URL:** https://github.com/WillKirkmanM/hyparview
**Language:** Rust
**Why similar:** HyParView — a related peer-sampling protocol designed for high reliability in large-scale P2P networks. Same academic lineage as Cyclon (partial view gossip protocols). Different language.

### 9. `amark/gun` ★19037
**URL:** https://github.com/amark/gun
**Language:** JavaScript
**Why similar:** Decentralized graph data sync protocol in JavaScript with gossip-based propagation. Mainstream alternative for anyone wanting decentralized JS networking — different use case but same architectural pattern.

### 10. `ayoitssmit/LuminaMesh` ★2
**URL:** https://github.com/ayoitssmit/LuminaMesh
**Language:** TypeScript
**Why similar:** Self-healing P2P content delivery mesh using WebRTC — TypeScript, browser-based, overlay networking. Closer to a use-case implementation on top of primitives like Cyclon.

---

## Summary

The most directly similar repos are:
- `nicola/js-gossip-cyclon` — same algorithm, same language
- `RAN3D/spray-wrtc` — same transport (WebRTC) and domain, research-adjacent
- `bpot/node-gossip` — same gossip membership domain, JS ecosystem

For practical "what do people actually use" alternatives: `libp2p/js-libp2p` and `ChainSafe/js-libp2p-gossipsub` are the production-grade ecosystem answers.
