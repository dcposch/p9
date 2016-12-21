#!/bin/bash

# Requires ImageMagick
# brew install imagemagick

cd static/tiles/p9

OUT=../../textures/atlas-p9.png
W1=tile-water-1.png
W2=tile-water-2.png
W3=tile-water-3.png
W4=tile-water-4.png
S=tile-stone.png
ST=tile-stripe-wood.png
SP=tile-spiral-wood.png
C1=tile-color-light-purple.png
C2=tile-color-dark-purple.png
C3=tile-color-pink.png
C4=tile-color-red.png
C5=tile-color-light-green.png
C6=tile-color-dark-green.png
C7=tile-color-light-blue.png
C8=tile-color-dark-blue.png
C9=tile-color-yellow.png
C0=tile-color-brown.png
P1=tile-plant-1.png
P2=tile-plant-2.png
P3=tile-plant-3.png

echo Creating $OUT
convert \( \
  \( \( $W1 $W1 +append \) \( $W1 $W1 +append \) -append \) \
  \( \( $W2 $W2 +append \) \( $W2 $W2 +append \) -append \) \
  \( \( $W3 $W3 +append \) \( $W3 $W3 +append \) -append \) \
  \( \( $W4 $W4 +append \) \( $W4 $W4 +append \) -append \) \
  \( \( $S $S +append \) \( $S $S +append \) -append \) \
  \( \( $ST $ST +append \) \( $ST $ST +append \) -append \) \
  \( \( $SP $SP +append \) \( $SP $SP +append \) -append \) \
  \( \( $C1 $C1 +append \) \( $C1 $C1 +append \) -append \) \
  \( \( $C2 $C2 +append \) \( $C2 $C2 +append \) -append \) \
  \( \( $C3 $C3 +append \) \( $C3 $C3 +append \) -append \) \
  \( \( $C4 $C4 +append \) \( $C4 $C4 +append \) -append \) \
  \( \( $C5 $C5 +append \) \( $C5 $C5 +append \) -append \) \
  \( \( $C6 $C6 +append \) \( $C6 $C6 +append \) -append \) \
  \( \( $C7 $C7 +append \) \( $C7 $C7 +append \) -append \) \
  \( \( $C8 $C8 +append \) \( $C8 $C8 +append \) -append \) \
  \( \( $C9 $C9 +append \) \( $C9 $C9 +append \) -append \) \
  +append \) \( \
  \( \( $C0 $C0 +append \) \( $C0 $C0 +append \) -append \) \
  \( \( $P1 $P1 +append \) \( $P1 $P1 +append \) -append \) \
  \( \( $P2 $P2 +append \) \( $P2 $P2 +append \) -append \) \
  \( \( $P3 $P3 +append \) \( $P3 $P3 +append \) -append \) \
  +append \) \
  -append -background transparent -extent 512x512 $OUT
