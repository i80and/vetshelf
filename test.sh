#!/bin/sh
set -e

NODE_EXE="./tests/node_modules/.bin/babel-node"
NODE="${NODE_EXE} --stage=1"

export NODE_PATH='./server/.node_modules'

if [ ! -x ${NODE_EXE} ]; then
    ( cd tests && npm update )
fi

echo "Building client..."
make -C ./client

echo "Running jstests..."
${NODE} ./tests/harness.js
