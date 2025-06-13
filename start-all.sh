#!/bin/bash

echo "🚀 Starting Innocence Protocol Services..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Store the root directory
ROOT_DIR=$(pwd)

# Start backend API
echo -e "${BLUE}Starting Backend API...${NC}"
cd "$ROOT_DIR/backend/InnocenceAPI"
dotnet run &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend API started (PID: $BACKEND_PID)${NC}"

# Wait a bit for backend to start
sleep 3

# Start proof service
echo -e "${BLUE}Starting Proof Service...${NC}"
cd "$ROOT_DIR/proof-service"
npm start &
PROOF_PID=$!
echo -e "${GREEN}✓ Proof Service started (PID: $PROOF_PID)${NC}"

# Wait a bit for proof service to start
sleep 3

# Start frontend
echo -e "${BLUE}Starting Frontend...${NC}"
cd "$ROOT_DIR/frontend/innocence-ui"
npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"

echo -e "\n${GREEN}✅ All services started!${NC}"
echo -e "${YELLOW}📝 Contract Address: 0xacC79fde62224426c90A60ED034D568a235a7983${NC}"
echo -e "${YELLOW}🔗 Backend API: http://localhost:5169${NC}"
echo -e "${YELLOW}🔗 Frontend: http://localhost:3001${NC}"
echo -e "${YELLOW}🔗 Proof Service: http://localhost:3003${NC}"
echo -e "\n${BLUE}Press Ctrl+C to stop all services${NC}"

# Wait for Ctrl+C
trap 'echo -e "\n${YELLOW}Stopping services...${NC}"; kill $BACKEND_PID $PROOF_PID $FRONTEND_PID 2>/dev/null; exit' INT
wait