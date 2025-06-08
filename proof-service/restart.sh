#!/bin/bash
cd /Users/waynedouglas/github/wayne-o/innocence/proof-service
pkill -f "node server.js"
sleep 1

# Set environment variables for native Groth16
export PATH="/opt/homebrew/opt/go@1.22/bin:$PATH"
export SP1_PROVER_DOCKER_DISABLE=1

node server.js