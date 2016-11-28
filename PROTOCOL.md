# voxelwave protocol

## json messages

```
{type, ...}
```

### types

- `handshake`: client sends `{clientVersion}`. server sends `{serverVersion}`
- `login`: client sends `{username, passphrase}`. server sends `{token, error}`
- `player`: update player. server sends `{player}`: position, velocity, inventory, etc
- `actions`: client sends `{player, actions: [{action, time, ...}]}`.
  player specifies position, velocity, etc
  actions include `place-block`, `break-block`

## binary messages

### header

- message type (int32)

### message type 0 (chunk data)

- num chunks (int32)
- for each chunk:
  - x, y, z, numQuads (int32)
  - for each quad:
    - quad x, y, z, v (5 + 5 + 5 + 8 bits, packed into an int32)

example scene:

- 1000 chunks, 10000 total quads, 250k verts (up to 36 verts per quad when drawing all six faces)
- Total message size: (negligible) + 4x4x1000 + 4x10000 = 16k + 40k = 56 KB

...total size to render 1m verts naively: about 200 KB

...total size to render 1m verts with frustum culling: about 800 KB

...total size to render 1m verts with frustum culling and LOD: a few MB

good enough.

## style

everything is camelCased.

the protocol aspires to minimalism.

previous protocol designers have an annoying habit of inventing their own free-formed binary tagged data format. mongodb called theirs bson. minecraft has NDT. bittorrent has bencoding. all are gross one-offs. google has protobufs and facebook has thrift, and at least those are open standards in use beyond a single app or protocol.

voxelwave just uses plain JSON for most message types. the few message types that comprise nearly all of the data transfer use fixed-format binary.
