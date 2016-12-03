# planet 9, aka voxel wave

![](http://i.imgur.com/EIBCT2F.gif)

## art

[voxel wave tumblr](https://voxelwave.tumblr.com)

![](http://i.imgur.com/OGE3Xgo.jpg)

## tech

i want to try out some ideas:

* voxel level of detail, so you can see to the horizon.

  (Minecraft never lets you see further than ~25 or so 16x16 chunks

* embrace the web.

  straight JS + WebGL, no install, no emscripten, no WebAssembly, no Three.js, no voxel.js

* single  world. everyone who visits the page can play.

the game will be built on a collection of npm modules that each do just one thing.

i want the client modules to be open. unclear whether the server will be open source.

i want the modules to be lighter than 3js. no excessive OO. simple, data oriented APIs.
everything that's memory intensive should use typed arrays. reduce allocations, reduce GC.

minecraft has performance issues that limit how big you can build and how many people can share the
same world at the same time. for example, try loading WesterosCraft. people built this amazing city,
but the best way to share it is via offline rendered screenshots, since the client doesn't have the
draw distance to let you see the grandeur of it. also, the city is beautiful but empty because the
server can't support that many clients.

for P9, the plan is to keep it simple and make it scale.
