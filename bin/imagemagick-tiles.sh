#!/bin/bash

echo "Usage: imagemagick-tiles.sh <convert command> -- <tile1> ..."
echo "Example: imagemagick-tiles.sh -modulate 100,80,100 -- tile-water-*.png"
echo "You may want to run this command from within static/tiles/p9"

convert=""
dash=false
for arg in "$@"
do
  if [ "$arg" = "--" ] ; then
    dash=true
  elif $dash ; then
    echo "Converting $arg..."
    cp $arg /tmp/tile.png
    convert /tmp/tile.png $convert $arg
    rm /tmp/tile.png
  else
    convert="$convert $arg"
  fi
done
echo "Done!"
