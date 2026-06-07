## Repos like nicktindall/cyclon.p2p

**Source:** [nicktindall/cyclon.p2p](https://github.com/nicktindall/cyclon.p2p) — A Javascript implementation of the Cyclon peer sampling protocol (⭐6, JavaScript, last pushed 2021). No topics set; signals derived from description: peer-sampling, gossip, P2P, WebRTC, distributed, JavaScript.

---

### Same Ecosystem — JS Gossip / Peer Sampling

1. **nicola/js-gossip-cyclon** ⭐46
   JavaScript · gossip · peer-sampling · p2p-membership
   > Cyclon Gossip: (P2P membership management) in Javascript
   **Why:** Directly implements the same Cyclon algorithm in JavaScript — closest functional equivalent. Different author, complementary implementation.
   https://github.com/nicola/js-gossip-cyclon
   _Score: +3 (gossip match) +3 (peer-sampling match) +2 (JS) +3 (desc: cyclon, p2p, membership) = 11_

2. **azuqua/notp** ⭐167
   JavaScript
   > A library for writing distributed systems that use a gossip protocol to communicate between nodes
   **Why:** JavaScript gossip protocol library targeting distributed node communication — same domain, higher adoption.
   https://github.com/azuqua/notp
   _Score: +3 (gossip) +2 (JS) +2 (desc: distributed, protocol) = 7_

3. **bpot/node-gossip** ⭐154
   JavaScript
   > node-gossip implements a gossip protocol w/failure detection, allowing you to create a cluster of Node.js processes
   **Why:** Node.js gossip with failure detection — peer membership management in JS, same use-case family.
   https://github.com/bpot/node-gossip
   _Score: +3 (gossip) +2 (JS) +2 (desc: protocol, p2p) = 7; -1 (no activity since 2020) = 6_

4. **tristanls/gossipmonger** ⭐50
   JavaScript
   > Gossip protocol endpoint for real-time peer-to-peer replication
   **Why:** JS gossip P2P endpoint library — peer-to-peer gossip dissemination, very similar niche.
   https://github.com/tristanls/gossipmonger
   _Score: +3 (gossip) +2 (JS) +2 (desc: p2p, protocol) = 7; -1 (inactive 2013) = 6_

5. **hackergrrl/secure-gossip** ⭐40
   JavaScript
   > Secure, transport agnostic, message gossip protocol.
   **Why:** Transport-agnostic JS gossip protocol — shares the peer messaging/gossip core with cyclon.p2p.
   https://github.com/hackergrrl/secure-gossip
   _Score: +3 (gossip) +2 (JS) +1 (desc: protocol) = 6; -1 (inactive 2016) = 5_

---

### Alternative Approach — Gossip / Peer Overlay (Other Languages)

6. **ChainSafe/js-libp2p-gossipsub** ⭐165
   TypeScript · gossip · p2p · libp2p
   > TypeScript implementation of Gossipsub — production-grade gossip overlay used in Ethereum 2.0 and IPFS
   **Why:** TypeScript, shares gossip+p2p topics; more structured/production-oriented but the same foundational concept.
   https://github.com/ChainSafe/js-libp2p-gossipsub
   _Score: +3 (gossip) +1 (TS/JS adjacent) +2 (desc: p2p, protocol) = 6_

7. **LoFiRes/ocaml-p2p** ⭐26
   OCaml · cyclon · gossip · p2p · random-peer-sampling · vicinity · poldercast
   > Collection of composable P2P libraries — includes Cyclon, Vicinity, RingCast gossip protocols
   **Why:** Directly implements Cyclon and related gossip protocols; different language (OCaml) but exact same academic protocol space.
   https://github.com/LoFiRes/ocaml-p2p
   _Score: +3 (cyclon/gossip topics) +3 (random-peer-sampling, p2p) -2 (different language) = 4_

8. **DE-labtory/swim** ⭐28
   Go · gossip · gossip-protocol · p2p · failure-detection
   > SWIM — Scalable Weakly-consistent Infection-style Process Group Membership Protocol
   **Why:** SWIM is a gossip-based membership protocol (the class Cyclon belongs to); different language but same membership/peer-sampling domain.
   https://github.com/DE-labtory/swim
   _Score: +3 (gossip) +3 (p2p, membership) -2 (Go not JS) = 4_

---

### Adjacent Tooling — WebRTC Browser P2P

9. **HadiModarres/MeshP2P** ⭐13
   JavaScript · webrtc · p2p · gossip · mesh-networks · browser
   > Create P2P apps between browsers — gossip-based mesh networking over WebRTC
   **Why:** Browser-based WebRTC P2P with gossip — closest to the WebRTC comms layer cyclon.p2p uses.
   https://github.com/HadiModarres/MeshP2P
   _Score: +3 (gossip) +3 (p2p, webrtc) +2 (JS) = 8; -2 (13 stars) = 6_

10. **ssbc/epidemic-broadcast-trees** ⭐128
    JavaScript · gossip · p2p
    > Bandwidth efficient broadcast gossip (Plumtree/EBT algorithm)
    **Why:** JS epidemic broadcast/gossip dissemination — different algorithm (Plumtree vs Cyclon) but same peer gossip dissemination problem.
    https://github.com/ssbc/epidemic-broadcast-trees
    _Score: +3 (gossip) +2 (JS) +1 (desc: broadcast, peer) = 6_

---

**Why these?** Recommendations were driven by three signals from `cyclon.p2p`: (1) the Cyclon peer-sampling algorithm itself — a randomized gossip overlay for P2P membership management; (2) JavaScript/Node.js as the implementation language; (3) WebRTC as the transport layer. Repos matching gossip + p2p + JS scored highest; Cyclon-specific implementations in other languages were included for completeness. The space is niche — most academic gossip protocol work is in Java/Go/OCaml rather than JavaScript.
