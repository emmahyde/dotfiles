# Search Transcript: nicktindall/cyclon

## Step 1: Parse Input

Input: `nicktindall/cyclon` — repo slug. Action: fetch metadata first.

## Step 2: Fetch Source Repo Metadata

```
gh api graphql ... repository(owner: "nicktindall", name: "cyclon")
```
**Result:** NOT_FOUND. The repo `nicktindall/cyclon` does not exist.

```
gh api "/search/repositories?q=cyclon+user:nicktindall&per_page=5"
```
**Result:** Found `nicktindall/cyclon.p2p` (the intended repo):
- Description: "A Javascript implementation of the Cyclon peer sampling protocol"
- Language: JavaScript
- Stars: 6
- Topics: (none set)
- Last pushed: 2021-08-11

Signal derivation from description:
- Keywords: cyclon, peer, sampling, protocol, javascript
- Derived topics: peer-sampling, gossip, p2p, webrtc (from related repos in ecosystem), distributed

## Step 3: Search Queries

### Query 1 — GraphQL: `peer-sampling gossip protocol javascript language:JavaScript stars:>5`
**Result:** 0 repos

### Query 2 — GraphQL: `topic:p2p topic:gossip language:JavaScript`
**Result:** 0 repos

### Query 3 — GraphQL: `peer sampling protocol javascript p2p gossip`
**Result:** 1 repo: HadiModarres/MeshP2P (13 stars)

### Query 4 — GraphQL: `topic:peer-to-peer topic:gossip`
**Result:** 0 repos

### Query 5 — GraphQL: `gossip protocol peer sampling distributed javascript`
**Result:** 0 repos

### Query 6 — GraphQL: `webrtc p2p peer sampling browser mesh`
**Result:** AmirAbaskohi/Gossip-Protocol (C++, 18⭐), HadiModarres/MeshP2P (JS, 13⭐), HubertLipinski/DumbCoin (archived)

### Query 7 — GraphQL: `gossip protocol implementation p2p stars:>10`
**Result:** 0 repos

### Query 8 — GraphQL: `cyclon peer sampling p2p`
**Result:** nicktindall/cyclon.p2p (6⭐), nicktindall/cyclon.p2p-webrtc-demo (0⭐)

### Query 9 — GraphQL: `topic:webrtc topic:p2p gossip stars:>20`
**Result:** protocol-diver/go-gossip (14⭐)

### Query 10 — REST: `topic:gossip+topic:p2p` sorted by stars
**Result (top hits):**
- nicola/js-gossip-cyclon (46⭐, JS) — DIRECT MATCH
- LoFiRes/ocaml-p2p (26⭐, OCaml) — has cyclon, gossip, random-peer-sampling topics
- DE-labtory/swim (28⭐, Go) — SWIM gossip membership
- graphops/graphcast-sdk (16⭐, Rust)
- protocol-diver/go-gossip (14⭐, Go)
- HadiModarres/MeshP2P (13⭐, JS)
- LoFiRes/lofire (12⭐, TeX)
- tmio/plumtree (3⭐, TS)

### Query 11 — REST: `gossip language:JavaScript` sorted by stars
**Result (relevant):**
- ssbc/ssb-server (1698⭐, JS) — gossip+replication distributed social
- azuqua/notp (167⭐, JS) — gossip protocol distributed systems
- bpot/node-gossip (154⭐, JS) — gossip+failure detection Node.js
- ssbc/epidemic-broadcast-trees (128⭐, JS) — bandwidth efficient broadcast gossip
- tristanls/gossipmonger (50⭐, JS) — gossip p2p replication
- nicola/js-gossip-cyclon (46⭐, JS) — Cyclon implementation
- hackergrrl/secure-gossip (40⭐, JS) — secure transport-agnostic gossip
- dfinity-side-projects/js-libp2p-gossip-discovery (23⭐, JS) — peer discovery gossip

### Query 12 — REST: `p2p membership javascript` sorted by stars
**Result:** nicola/js-gossip-cyclon (46⭐, JS) — top relevant result

### Query 13 — REST: `libp2p gossip javascript` sorted by stars
**Result:** ChainSafe/js-libp2p-gossipsub (165⭐, TS)

## Step 4: Deduplication & Scoring

Unique candidates with scores (JS lang match +2, gossip/p2p topic/desc match +3 each, desc keyword overlap +1, low stars <10 −2, archived −3, inactive >2yr −1):

| Repo | Stars | Lang | Score |
|---|---|---|---|
| nicola/js-gossip-cyclon | 46 | JS | 11 |
| azuqua/notp | 167 | JS | 7 |
| bpot/node-gossip | 154 | JS | 6 |
| tristanls/gossipmonger | 50 | JS | 6 |
| HadiModarres/MeshP2P | 13 | JS | 6 |
| ChainSafe/js-libp2p-gossipsub | 165 | TS | 6 |
| hackergrrl/secure-gossip | 40 | JS | 5 |
| ssbc/epidemic-broadcast-trees | 128 | JS | 6 |
| LoFiRes/ocaml-p2p | 26 | OCaml | 4 |
| DE-labtory/swim | 28 | Go | 4 |

Excluded: ssbc/ssb-server (too large/general — full social platform, not a gossip protocol library).
