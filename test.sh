#!/bin/sh
set -e

MYPY=mypy
PROSPECTOR=prospector
NODE_EXE="./tests/node_modules/.bin/babel-node"
NODE="${NODE_EXE} --stage=1"

export MYPYPATH='./server'
export NODE_PATH='./server/.node_modules'

if [ ! -x ${NODE_EXE} ]; then
    ( cd tests && npm update )
fi

if ! which ${MYPY} > /dev/null; then
    echo "Please pip install mypy-lang"
    exit 1
fi

if ! which ${PROSPECTOR} > /dev/null; then
    echo "Please pip install prospector"
    exit 1
fi

echo "Linting server..."
${PROSPECTOR} -M server/

echo "Type-checking server..."
# Our goal is full coverage, but that's not possible just yet
${MYPY} -m vetclix.db

echo "Linting client..."
make -C ./client check

echo "Running jstests..."
${NODE} ./tests/harness.js
