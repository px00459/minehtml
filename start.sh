#!/bin/bash

# Voxel Sandbox - Server Startup Script
# Works on macOS and Linux

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║     🎮 Voxel Sandbox Game Server      ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js found: ${NODE_VERSION}${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: npm is not installed${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm found: v${NPM_VERSION}${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules not found. Installing dependencies...${NC}"
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
fi

# Check if server file exists
if [ ! -f "server/server.js" ]; then
    echo -e "${RED}❌ Error: server/server.js not found${NC}"
    exit 1
fi

# Check if port 8000 is already in use
if command -v lsof &> /dev/null; then
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠ Port 8000 is already in use${NC}"
        echo -e "${YELLOW}  Kill the process with: lsof -ti:8000 | xargs kill -9${NC}"
        echo -e "${YELLOW}  Or use a different port${NC}"
        exit 1
    fi
fi

# Start server
echo ""
echo -e "${BLUE}🚀 Starting server...${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Server will be available at: ${YELLOW}http://localhost:8000${NC}"
echo -e "Press ${YELLOW}Ctrl+C${NC} to stop the server"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run the server
if command -v nodemon &> /dev/null || [ -f "node_modules/.bin/nodemon" ]; then
    echo -e "${GREEN}✓ Starting with nodemon (auto-restart on changes)${NC}"
    npm run dev
else
    echo -e "${YELLOW}⚠ nodemon not found, starting with node${NC}"
    npm start
fi
