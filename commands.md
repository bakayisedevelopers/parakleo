PARAKLEO DEVELOPMENT COMMANDS
=============================

npm install -g @openai/codex

This is a practical command reference for this repository.
Repo root: /workspaces/parakleo

Project structure used by these commands:
- web/      (React + Vite)
- mobile/   (Expo React Native)
- functions/ (Firebase Cloud Functions)
- firebase.json at repo root


0) FIRST-TIME SETUP
-------------------
# Verify tools
node -v
npm -v
git --version
firebase --version

# If Firebase CLI is missing
npm install -g firebase-tools

# Login to Firebase
firebase login

# Confirm active Firebase project (expected: parakleo)
firebase projects:list
firebase use
firebase use parakleo


1) GIT: DAILY WORKFLOW
----------------------
# See current branch and local changes
git status
git branch

# Update main branch
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feat/<short-description>

# Stage, commit, push
git add .
git commit -m "feat: <what changed>"
git push -u origin feat/<short-description>

# Pull latest changes into your current branch
git pull --rebase origin main

# View commit history
git log --oneline --decorate --graph -20

# Compare current branch vs main
git diff main...HEAD

# If needed: stash temporary work
git stash push -m "wip"
git stash list
git stash pop


2) INSTALL DEPENDENCIES (MONOREPO)
----------------------------------
# Root (if needed for root dependencies)
cd /workspaces/parakleo
npm install

# Web app dependencies
cd /workspaces/parakleo/web
npm install

# Mobile app dependencies
cd /workspaces/parakleo/mobile
npm install

# Cloud Functions dependencies
cd /workspaces/parakleo/functions
npm install


3) WEB APP (VITE)
-----------------
cd /workspaces/parakleo/web

# Start development server
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview


4) MOBILE APP (EXPO)
--------------------
cd /workspaces/parakleo/mobile

# Start Expo dev server
npm run start

# Run on Android (requires Android environment)
npm run android

# Run on iOS (requires macOS + Xcode)
npm run ios

# Run app in web mode
npm run web


5) FIREBASE EMULATORS (LOCAL BACKEND/HOSTING)
----------------------------------------------
cd /workspaces/parakleo

# Start all configured emulators (Auth, Firestore, Functions, Hosting, Storage, UI)
firebase emulators:start

# Start only selected emulators (example)
firebase emulators:start --only functions,firestore,hosting

# Run command against emulators and then exit (good for CI-like checks)
firebase emulators:exec --only functions "npm --prefix functions test"


6) FIREBASE DEPLOYMENT
----------------------
cd /workspaces/parakleo

# Deploy everything configured in firebase.json
firebase deploy

# Deploy only Hosting (serves web/dist)
# IMPORTANT: build web first
cd /workspaces/parakleo/web && npm run build && cd ..
firebase deploy --only hosting

# Deploy only Cloud Functions
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Storage rules
firebase deploy --only storage

# Deploy a single function (example)
firebase deploy --only functions:getPricingQuote


7) FIREBASE SECRETS (FUNCTIONS)
-------------------------------
cd /workspaces/parakleo

# Set a secret
firebase functions:secrets:set SECRET_NAME

# Access/version list for a secret
firebase functions:secrets:access SECRET_NAME
firebase functions:secrets:get SECRET_NAME

# Destroy a secret version (example: version 1)
firebase functions:secrets:destroy SECRET_NAME@1

# Destroy an entire secret
firebase functions:secrets:destroy SECRET_NAME

# After changing secrets, redeploy affected functions
firebase deploy --only functions


8) FIREBASE PROJECT/ENVIRONMENT MANAGEMENT
------------------------------------------
cd /workspaces/parakleo

# Show active project alias
firebase use

# Switch project (if you add staging/prod projects later)
firebase use <project-id-or-alias>

# Add a project alias
firebase use --add

# Show Firebase config currently used by web app (if needed)
firebase apps:sdkconfig WEB


9) LOGS, DEBUGGING, AND FUNCTION OPERATIONS
--------------------------------------------
cd /workspaces/parakleo

# Stream function logs
firebase functions:log

# Stream logs for one function (example)
firebase functions:log --only getPricingQuote

# Open Firebase Console for this project
firebase open

# Open Hosting site in browser
firebase hosting:sites:list


10) USEFUL NPM HELPERS
----------------------
# Run scripts without changing directory
npm --prefix /workspaces/parakleo/web run dev
npm --prefix /workspaces/parakleo/web run build
npm --prefix /workspaces/parakleo/mobile run start
npm --prefix /workspaces/parakleo/functions test


11) RECOMMENDED RELEASE FLOW (WEB + FIREBASE)
----------------------------------------------
# 1) Sync latest code
git checkout main
git pull origin main

# 2) Create release branch
git checkout -b release/<date-or-tag>

# 3) Build web app
cd /workspaces/parakleo/web
npm install
npm run build

# 4) Deploy hosting/functions/rules from root
cd /workspaces/parakleo
firebase deploy --only hosting,functions,firestore:rules,storage

# 5) Tag release
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z


12) QUICK HEALTH CHECKS
-----------------------
# Check uncommitted work
git status

# Confirm Firebase project
firebase use

# Confirm web build is generated
ls -la /workspaces/parakleo/web/dist

# Confirm functions dependencies installed
ls -la /workspaces/parakleo/functions/node_modules


NOTES
-----
- Deploy commands must be run from repo root: /workspaces/parakleo
- Hosting expects built assets in web/dist
- If a command fails due to auth/session expiry, run: firebase login --reauth
- iOS commands require macOS; they will not run inside Linux-only environments
