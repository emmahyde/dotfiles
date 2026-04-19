# Layer Conventions Reference

## Bitmask Math Cheat Sheet

| Inspector Layer | Bitmask Value | Code Expression |
|:-:|:-:|:-:|
| 1 | 1 | `1 << 0` |
| 2 | 2 | `1 << 1` |
| 3 | 4 | `1 << 2` |
| 4 | 8 | `1 << 3` |
| 5 | 16 | `1 << 4` |
| 6 | 32 | `1 << 5` |
| 7 | 64 | `1 << 6` |
| 8 | 128 | `1 << 7` |

**Combining layers:** OR the values together.
- Layers 1+3 = `1 | 4` = `5`
- Layers 2+4 = `2 | 8` = `10`
- Layers 1+2+3 = `1 | 2 | 4` = `7`
- All first 8 = `255` (`0xFF`)

## Common Game Configurations

### FPS / Shooter
```
Layer 1: Player         (CharacterBody3D)
Layer 2: Enemies        (CharacterBody3D)
Layer 3: Projectiles    (Area3D)
Layer 4: World/Static   (StaticBody3D)
Layer 5: Triggers       (Area3D, monitoring only)
Layer 6: Pickups        (Area3D)
Layer 7: Destructibles  (RigidBody3D or StaticBody3D)
Layer 8: Navigation     (for nav mesh agents)
```

Interaction matrix:
```
                  Player  Enemy  Bullet  World  Trigger  Pickup  Destruct
Player    L=1     -       M      M       M      M        M       M
Enemy     L=2     M       -      M       M      -        -       -
Bullet    L=4     -       M      -       M      -        -       M
World     L=8     -       -      -       -      -        -       -
Trigger   L=16    M       -      -       -      -        -       -
Pickup    L=32    M       -      -       -      -        -       -
Destruct  L=64    -       -      M       M      -        -       -

M = has in mask (detects), - = no interaction
```

### Platformer
```
Layer 1: Player
Layer 2: Enemies
Layer 3: Platforms/Ground   (one-way via collision_mask_value)
Layer 4: Walls
Layer 5: Hazards            (spikes, lava)
Layer 6: Collectibles
Layer 7: Projectiles
Layer 8: Moving platforms
```

### Roguelike / Dungeon Crawler
```
Layer 1: Player
Layer 2: Enemies
Layer 3: Player projectiles
Layer 4: Enemy projectiles
Layer 5: Walls/obstacles
Layer 6: Doors/triggers
Layer 7: Pickups/loot
Layer 8: Traps
```

Separating player vs enemy projectiles (layers 3 and 4) prevents friendly fire without extra code.

## GDScript Helpers

```gdscript
## Check if a body is on a specific layer (1-indexed)
static func is_on_layer(body: PhysicsBody3D, layer: int) -> bool:
    return body.collision_layer & (1 << (layer - 1)) != 0

## Add a layer to a body's mask
static func add_to_mask(body: PhysicsBody3D, layer: int) -> void:
    body.collision_mask |= 1 << (layer - 1)

## Remove a layer from a body's mask
static func remove_from_mask(body: PhysicsBody3D, layer: int) -> void:
    body.collision_mask &= ~(1 << (layer - 1))

## Set a body to a single layer (clear all others)
static func set_single_layer(body: PhysicsBody3D, layer: int) -> void:
    body.collision_layer = 1 << (layer - 1)

## Decode a bitmask value to layer numbers
static func decode_layers(bitmask: int) -> Array[int]:
    var layers: Array[int] = []
    for i: int in range(32):
        if bitmask & (1 << i):
            layers.append(i + 1)
    return layers

## Encode layer numbers to bitmask value
static func encode_layers(layers: Array[int]) -> int:
    var bitmask: int = 0
    for layer: int in layers:
        bitmask |= 1 << (layer - 1)
    return bitmask
```

## How Layer and Mask Interact

```
Body A (Player)              Body B (Enemy)
┌─────────────┐              ┌─────────────┐
│ layer = 1   │              │ layer = 2   │
│ mask  = 2|8 │              │ mask  = 1|8 │
└──────┬──────┘              └──────┬──────┘
       │                            │
       │  A detects B?              │  B detects A?
       │  A.mask(2) & B.layer(2)   │  B.mask(1) & A.layer(1)
       │  = 2 & 2 = YES           │  = 1 & 1 = YES
       │                            │
       └──── MUTUAL DETECTION ──────┘

Body C (Bullet)              Body B (Enemy)
┌─────────────┐              ┌─────────────┐
│ layer = 4   │              │ layer = 2   │
│ mask  = 2|8 │              │ mask  = 1|8 │
└──────┬──────┘              └──────┬──────┘
       │                            │
       │  C detects B?              │  B detects C?
       │  C.mask(2) & B.layer(2)   │  B.mask(1|8) & C.layer(4)
       │  = 2 & 2 = YES           │  = 9 & 4 = NO
       │                            │
       └── ONE-WAY (bullet→enemy) ──┘
```

One-way detection is useful for projectiles: the bullet detects the enemy hit, but the enemy doesn't need to detect the bullet (damage is applied by the bullet's signal handler).
