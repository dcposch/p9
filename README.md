<h1 align="center">
  <img src="https://i.imgur.com/EIBCT2F.gif" alt="planet 9" width="200">
  <br>
  planet 9, aka voxelwave, aka ???
  <br>
  <br>
</h1>

![](http://i.imgur.com/OGE3Xgo.jpg)

## art

[voxelwave tumblr](https://voxelwave.tumblr.com)

## tech

check out [client/index.js](src/client/index.js) and [server/index.js](src/server/index.js). both are short and sweet with lots of comments.

### voxel representation and rendering

in memory, the game uses 32x32x32 chunks of voxels. a chunk is in one of two states: flat array or
quads. flat array uses 1 byte per voxel, so 32KB per chunk. quads are packed into a Uint8Array, 8
bytes per quad, often <2KB per chunk, so lots of terrain can be represented very compactly.

the quad representation is used both for rendering and for serialization.

unlike minecraft, which uses 16x16x256 chunks and has a world height limit of 256, p9 worlds can
extend in any direction.

the game uses 0fps' greedy quad meshing algorithm, plus a variant that allows incremental updates.

- [analysis of minecraft-like engines](
  https://0fps.net/2012/01/14/an-analysis-of-minecraft-like-engines/)
- [meshing in a minecraft game](
  https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)
- [texture atlases, wrapping, and mip mapping](
  https://0fps.net/2013/07/09/texture-atlases-wrapping-and-mip-mapping/)

### client server protocol

[protocol](PROTOCOL.md)

### ideas

* embrace the web.

  straight JS + WebGL, no install, no emscripten, no WebAssembly, no Three.js, no voxel.js

* single  world. everyone who visits the page can play.

* voxel level of detail, so you can see to the horizon.

  (Minecraft never lets you see further than ~25 or so 16x16 chunks.)

i think the client modules should be open. unclear whether the server will be open source.

i want to keep things light. no excessive OO. simple, data oriented APIs.
everything that's memory intensive should use typed arrays. reduce allocations, reduce GC.

minecraft has performance issues that limit how big you can build and how many people can share the
same world at the same time. for example, try loading WesterosCraft. people built this amazing city,
but the best way to share it is via [offline rendered screenshots](http://bit.ly/2h4AbzT), since the
client doesn't have the draw distance to let you see the grandeur of it. also, the city is beautiful
but empty because the server can't support that many clients.

for P9, the plan is to keep it simple and make it scale.
